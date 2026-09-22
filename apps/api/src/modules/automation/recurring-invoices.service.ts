import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { assertKoboAmount } from "../../common/money-limits";
import { anchorFromStartDate } from "../../common/recurrence";
import { DatabaseService } from "../../database/database.service";
import {
  automationJobs,
  customers,
  recurringInvoiceScheduleLineItems,
  recurringInvoiceSchedules,
  recurringInvoiceOccurrences
} from "../../database/schema";
import { AuditLogService } from "../audit-log/audit-log.service";
import { validateSendRecipients } from "../communications/email-provider";
import type {
  CreateRecurringInvoiceDto,
  UpdateRecurringInvoiceDto
} from "./dto/recurring-invoice.dto";
import { firstIssueAfterOrOn } from "../../common/recurrence";
import { businessDate } from "../../common/business-date";

function toSafeSchedule(row: typeof recurringInvoiceSchedules.$inferSelect, amountKobo: number) {
  return { ...row, amountKobo };
}

@Injectable()
export class RecurringInvoicesService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService
  ) {}

  async listSchedules(context: ActiveOrganisationContext, status?: string) {
    const orgId = context.activeOrganisation.id;
    const rows = await this.databaseService.db
      .select()
      .from(recurringInvoiceSchedules)
      .where(
        status
          ? and(eq(recurringInvoiceSchedules.organisationId, orgId), eq(recurringInvoiceSchedules.status, status))
          : eq(recurringInvoiceSchedules.organisationId, orgId)
      )
      .orderBy(desc(recurringInvoiceSchedules.nextIssueDate));

    const withAmounts = await Promise.all(
      rows.map(async (row) => {
        const items = await this.databaseService.db
          .select()
          .from(recurringInvoiceScheduleLineItems)
          .where(eq(recurringInvoiceScheduleLineItems.scheduleId, row.id));
        const amount = items.reduce(
          (sum, item) => sum + Math.round(Number(item.quantity) * item.unitPriceKobo),
          0
        );
        return toSafeSchedule(row, amount + (row.taxKobo ?? 0) - (row.discountKobo ?? 0));
      })
    );
    return { schedules: withAmounts };
  }

  async createSchedule(context: ActiveOrganisationContext, dto: CreateRecurringInvoiceDto) {
    const orgId = context.activeOrganisation.id;
    const userId = context.user.id;
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, dto.customerId), eq(customers.organisationId, orgId)))
      .limit(1);
    if (!customer || customer.archivedAt) {
      throw new BadRequestException("Customer is not eligible for a recurring schedule.");
    }
    if (dto.lineItems.length === 0) {
      throw new BadRequestException("At least one line item is required.");
    }
    const to = dto.toRecipients?.length ? dto.toRecipients : [customer.email];
    let recipients: { to: string[]; cc: string[] };
    try {
      recipients = validateSendRecipients(to, dto.ccRecipients ?? []);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Recipients are invalid.");
    }
    if (dto.endDate && dto.endDate < dto.startDate) {
      throw new BadRequestException("End date must be on or after the start date.");
    }
    assertKoboAmount(dto.discountKobo ?? 0, "Discount");
    assertKoboAmount(dto.taxKobo ?? 0, "Tax");
    for (const item of dto.lineItems) {
      if (!item.description?.trim()) throw new BadRequestException("Line item description is required.");
      if (!(Number(item.quantity) > 0)) throw new BadRequestException("Line item quantity must be positive.");
      assertKoboAmount(item.unitPriceKobo, "Unit price");
    }
    const { anchorDay, anchorMonth } = anchorFromStartDate(dto.startDate);
    const [schedule] = await this.databaseService.db.insert(recurringInvoiceSchedules)
      .values({
        organisationId: orgId,
        customerId: dto.customerId,
        name: dto.name.trim(),
        status: "active",
        frequency: dto.frequency,
        anchorDay,
        anchorMonth,
        startDate: dto.startDate,
        nextIssueDate: dto.startDate,
        endDate: dto.endDate ?? null,
        dueTermsDays: dto.dueTermsDays ?? 14,
        autoSend: dto.autoSend ?? false,
        toRecipients: recipients.to,
        ccRecipients: recipients.cc,
        emailSubject: dto.emailSubject ?? null,
        customerReference: dto.customerReference ?? null,
        notes: dto.notes ?? null,
        discountKobo: dto.discountKobo ?? 0,
        taxKobo: dto.taxKobo ?? 0,
        createdByUserId: userId
      })
      .returning();
    await this.databaseService.db.insert(recurringInvoiceScheduleLineItems).values(
      dto.lineItems.map((item, index) => ({
        organisationId: orgId,
        scheduleId: schedule!.id,
        catalogueItemId: item.catalogueItemId ?? null,
        description: item.description.trim(),
        quantity: String(item.quantity),
        unitPriceKobo: item.unitPriceKobo,
        sortOrder: index
      }))
    );
    await this.auditLogService.create({
      organisationId: orgId,
      actorUserId: userId,
      action: "recurring_schedule_created",
      entityType: "recurring_schedule",
      entityId: schedule!.id,
      metadataRedacted: { name: schedule!.name, frequency: schedule!.frequency }
    });
    return this.getSchedule(context, schedule!.id);
  }

  async getSchedule(context: ActiveOrganisationContext, id: string) {
    const orgId = context.activeOrganisation.id;
    const [schedule] = await this.databaseService.db
      .select()
      .from(recurringInvoiceSchedules)
      .where(and(eq(recurringInvoiceSchedules.id, id), eq(recurringInvoiceSchedules.organisationId, orgId)))
      .limit(1);
    if (!schedule) throw new NotFoundException("Recurring schedule was not found.");
    const [lineItems, occurrences, jobs] = await Promise.all([
      this.databaseService.db
        .select()
        .from(recurringInvoiceScheduleLineItems)
        .where(eq(recurringInvoiceScheduleLineItems.scheduleId, id)),
      this.databaseService.db
        .select()
        .from(recurringInvoiceOccurrences)
        .where(eq(recurringInvoiceOccurrences.scheduleId, id))
        .orderBy(desc(recurringInvoiceOccurrences.scheduledFor)),
      this.databaseService.db
        .select({ id: automationJobs.id, status: automationJobs.status, lastError: automationJobs.lastError, scheduledFor: automationJobs.scheduledFor })
        .from(automationJobs)
        .where(and(eq(automationJobs.organisationId, orgId), eq(automationJobs.resourceId, id)))
        .orderBy(desc(automationJobs.scheduledFor))
    ]);
    const amount = lineItems.reduce((sum, item) => sum + Math.round(Number(item.quantity) * item.unitPriceKobo), 0);
    return {
      schedule: { ...schedule, amountKobo: amount + schedule.taxKobo - schedule.discountKobo },
      lineItems,
      occurrences: occurrences.slice(0, 20),
      automation: jobs.slice(0, 10)
    };
  }

  async updateSchedule(context: ActiveOrganisationContext, id: string, dto: UpdateRecurringInvoiceDto) {
    const orgId = context.activeOrganisation.id;
    const existing = (await this.getSchedule(context, id)).schedule;
    if (!["active", "paused"].includes(existing.status)) {
      throw new BadRequestException("Only active or paused schedules can be edited.");
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.frequency !== undefined) patch.frequency = dto.frequency;
    if (dto.endDate !== undefined) patch.endDate = dto.endDate;
    if (dto.dueTermsDays !== undefined) patch.dueTermsDays = dto.dueTermsDays;
    if (dto.autoSend !== undefined) patch.autoSend = dto.autoSend;
    if (dto.toRecipients !== undefined || dto.ccRecipients !== undefined) {
      try {
        const r = validateSendRecipients(dto.toRecipients ?? existing.toRecipients, dto.ccRecipients ?? existing.ccRecipients);
        patch.toRecipients = r.to;
        patch.ccRecipients = r.cc;
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : "Recipients are invalid.");
      }
    }
    if (dto.emailSubject !== undefined) patch.emailSubject = dto.emailSubject;
    if (dto.customerReference !== undefined) patch.customerReference = dto.customerReference;
    if (dto.notes !== undefined) patch.notes = dto.notes;
    if (dto.discountKobo !== undefined) {
      assertKoboAmount(dto.discountKobo, "Discount");
      patch.discountKobo = dto.discountKobo;
    }
    if (dto.taxKobo !== undefined) {
      assertKoboAmount(dto.taxKobo, "Tax");
      patch.taxKobo = dto.taxKobo;
    }
    // ponytail: frequency edit keeps anchor, advances next date only if behind today
    if (dto.frequency !== undefined && dto.frequency !== existing.frequency) {
      const today = businessDate();
      patch.nextIssueDate = firstIssueAfterOrOn({
        frequency: dto.frequency,
        anchorDay: existing.anchorDay,
        anchorMonth: existing.anchorMonth,
        startDate: existing.startDate,
        fromDate: today > existing.nextIssueDate ? today : existing.nextIssueDate
      });
    }
    await this.databaseService.db
      .update(recurringInvoiceSchedules)
      .set(patch)
      .where(and(eq(recurringInvoiceSchedules.id, id), eq(recurringInvoiceSchedules.organisationId, orgId)));
    if (dto.lineItems !== undefined) {
      if (dto.lineItems.length === 0) throw new BadRequestException("At least one line item is required.");
      await this.databaseService.db
        .delete(recurringInvoiceScheduleLineItems)
        .where(eq(recurringInvoiceScheduleLineItems.scheduleId, id));
      await this.databaseService.db.insert(recurringInvoiceScheduleLineItems).values(
        dto.lineItems.map((item, index) => ({
          organisationId: orgId,
          scheduleId: id,
          catalogueItemId: item.catalogueItemId ?? null,
          description: item.description.trim(),
          quantity: String(item.quantity),
          unitPriceKobo: item.unitPriceKobo,
          sortOrder: index
        }))
      );
    }
    await this.auditLogService.create({
      organisationId: orgId,
      actorUserId: context.user.id,
      action: "recurring_schedule_edited",
      entityType: "recurring_schedule",
      entityId: id,
      metadataRedacted: {}
    });
    return this.getSchedule(context, id);
  }

  async pauseSchedule(context: ActiveOrganisationContext, id: string) {
    const orgId = context.activeOrganisation.id;
    const existing = (await this.getSchedule(context, id)).schedule;
    if (existing.status !== "active") throw new BadRequestException("Only active schedules can be paused.");
    await this.databaseService.db
      .update(recurringInvoiceSchedules)
      .set({ status: "paused", updatedAt: new Date() })
      .where(and(eq(recurringInvoiceSchedules.id, id), eq(recurringInvoiceSchedules.organisationId, orgId)));
    // Cancel pending jobs safely; preserve nextIssueDate for display
    await this.databaseService.db
      .update(automationJobs)
      .set({ status: "cancelled", skippedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(automationJobs.organisationId, orgId),
          eq(automationJobs.resourceId, id),
          eq(automationJobs.status, "pending")
        )
      );
    await this.auditLogService.create({
      organisationId: orgId,
      actorUserId: context.user.id,
      action: "recurring_schedule_paused",
      entityType: "recurring_schedule",
      entityId: id,
      metadataRedacted: {}
    });
    return this.getSchedule(context, id);
  }

  async resumeSchedule(context: ActiveOrganisationContext, id: string) {
    const orgId = context.activeOrganisation.id;
    const existing = (await this.getSchedule(context, id)).schedule;
    if (existing.status !== "paused") throw new BadRequestException("Only paused schedules can be resumed.");
    // Advance to first occurrence on/after today; missed periods are skipped
    const today = businessDate();
    const nextIssueDate = firstIssueAfterOrOn({
      frequency: existing.frequency as "weekly" | "monthly" | "quarterly" | "yearly",
      anchorDay: existing.anchorDay,
      anchorMonth: existing.anchorMonth,
      startDate: existing.startDate,
      fromDate: today
    });
    if (existing.endDate && nextIssueDate > existing.endDate) {
      await this.databaseService.db
        .update(recurringInvoiceSchedules)
        .set({ status: "completed", nextIssueDate, updatedAt: new Date() })
        .where(and(eq(recurringInvoiceSchedules.id, id), eq(recurringInvoiceSchedules.organisationId, orgId)));
    } else {
      await this.databaseService.db
        .update(recurringInvoiceSchedules)
        .set({ status: "active", nextIssueDate, updatedAt: new Date() })
        .where(and(eq(recurringInvoiceSchedules.id, id), eq(recurringInvoiceSchedules.organisationId, orgId)));
    }
    await this.auditLogService.create({
      organisationId: orgId,
      actorUserId: context.user.id,
      action: "recurring_schedule_resumed",
      entityType: "recurring_schedule",
      entityId: id,
      metadataRedacted: { nextIssueDate }
    });
    return this.getSchedule(context, id);
  }

  async cancelSchedule(context: ActiveOrganisationContext, id: string) {
    const orgId = context.activeOrganisation.id;
    const existing = (await this.getSchedule(context, id)).schedule;
    if (["completed", "cancelled"].includes(existing.status)) {
      throw new BadRequestException("Schedule is already ended.");
    }
    await this.databaseService.db
      .update(recurringInvoiceSchedules)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(recurringInvoiceSchedules.id, id), eq(recurringInvoiceSchedules.organisationId, orgId)));
    await this.databaseService.db
      .update(automationJobs)
      .set({ status: "cancelled", skippedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(automationJobs.organisationId, orgId),
          eq(automationJobs.resourceId, id),
          eq(automationJobs.status, "pending")
        )
      );
    // Mark future pending occurrences skipped
    await this.databaseService.db.execute(
      sql`update recurring_invoice_occurrences set status = 'skipped', updated_at = now() where schedule_id = ${id} and status = 'pending'`
    );
    await this.auditLogService.create({
      organisationId: orgId,
      actorUserId: context.user.id,
      action: "recurring_schedule_cancelled",
      entityType: "recurring_schedule",
      entityId: id,
      metadataRedacted: {}
    });
    return this.getSchedule(context, id);
  }
}




