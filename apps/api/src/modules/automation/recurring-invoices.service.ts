import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { assertInvoiceQuantity, assertKoboAmount } from "../../common/money-limits";
import { anchorFromStartDate } from "../../common/recurrence";
import { DatabaseService, type AppDatabase } from "../../database/database.service";
import { calculateInvoiceTotals } from "../../common/invoice-totals";
import {
  automationJobs,
  auditLogs,
  communications,
  customers,
  invoices,
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
import { isValidBusinessDate } from "../../common/business-date";
import type { RecurringLineItemDto } from "./dto/recurring-invoice.dto";

function normalizeLineItems(items: RecurringLineItemDto[]) {
  if (!items?.length) throw new BadRequestException("At least one line item is required.");
  return items.map((item) => {
    const description = item.description?.trim();
    if (!description) throw new BadRequestException("Line item description is required.");
    assertInvoiceQuantity(item.quantity);
    assertKoboAmount(item.unitPriceKobo, "Unit price");
    return {
      catalogueItemId: item.catalogueItemId ?? null,
      description,
      quantity: item.quantity,
      unitPriceKobo: item.unitPriceKobo
    };
  });
}

type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

function assertBusinessDate(value: string, label: string) {
  if (typeof value !== "string" || !isValidBusinessDate(value))
    throw new BadRequestException(`${label} must be a valid YYYY-MM-DD date.`);
}

function toSafeSchedule(row: typeof recurringInvoiceSchedules.$inferSelect, amountKobo: number) {
  return { ...row, amountKobo };
}

@Injectable()
export class RecurringInvoicesService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService
  ) {}

  private async lockScheduleJobs(tx: Transaction, orgId: string, id: string) {
    const jobs = await tx
      .select({ id: automationJobs.id, status: automationJobs.status })
      .from(automationJobs)
      .where(
        and(
          eq(automationJobs.organisationId, orgId),
          eq(automationJobs.resourceType, "recurring_schedule"),
          eq(automationJobs.resourceId, id),
          eq(automationJobs.kind, "recurring_invoice_generate"),
          inArray(automationJobs.status, ["pending", "running", "sending", "cancelled"])
        )
      )
      .orderBy(automationJobs.id)
      .for("update");
    if (jobs.some((job) => job.status === "sending")) {
      throw new ConflictException("An invoice email is already being sent for this schedule.");
    }
  }

  private async cancelScheduleJobs(tx: Transaction, orgId: string, id: string) {
    await tx.execute(sql`update automation_jobs set status = 'cancelled', claim_token = null, claimed_at = null,
      skipped_at = now(), updated_at = now() where organisation_id = ${orgId}
      and resource_type = 'recurring_schedule' and resource_id = ${id}
      and kind = 'recurring_invoice_generate' and status in ('pending', 'running')`);
  }

  private async lockSchedule(
    tx: Transaction,
    orgId: string,
    existing: typeof recurringInvoiceSchedules.$inferSelect
  ) {
    const [locked] = await tx
      .select()
      .from(recurringInvoiceSchedules)
      .where(
        and(
          eq(recurringInvoiceSchedules.id, existing.id),
          eq(recurringInvoiceSchedules.organisationId, orgId)
        )
      )
      .for("update");
    if (
      !locked ||
      locked.updatedAt.getTime() !== existing.updatedAt.getTime() ||
      locked.status !== existing.status
    ) {
      throw new ConflictException(
        "Schedule changed while it was being edited. Reload and try again."
      );
    }
    return locked;
  }

  async listSchedules(context: ActiveOrganisationContext, status?: string) {
    const orgId = context.activeOrganisation.id;
    const rows = await this.databaseService.db
      .select()
      .from(recurringInvoiceSchedules)
      .where(
        status
          ? and(
              eq(recurringInvoiceSchedules.organisationId, orgId),
              eq(recurringInvoiceSchedules.status, status)
            )
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
    if (!dto.name?.trim()) throw new BadRequestException("Schedule name is required.");
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, dto.customerId), eq(customers.organisationId, orgId)))
      .limit(1);
    if (!customer || customer.archivedAt) {
      throw new BadRequestException("Customer is not eligible for a recurring schedule.");
    }
    const items = normalizeLineItems(dto.lineItems);
    calculateInvoiceTotals({
      lineItems: items,
      discountKobo: dto.discountKobo ?? 0,
      taxKobo: dto.taxKobo ?? 0
    });
    const to = dto.toRecipients?.length ? dto.toRecipients : [customer.email];
    let recipients: { to: string[]; cc: string[] };
    try {
      recipients = validateSendRecipients(to, dto.ccRecipients ?? []);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Recipients are invalid."
      );
    }
    assertBusinessDate(dto.startDate, "Start date");
    if (dto.startDate < businessDate())
      throw new BadRequestException("Start date cannot be in the past.");
    if (dto.endDate !== undefined && dto.endDate !== null)
      assertBusinessDate(dto.endDate, "End date");
    if (dto.endDate && dto.endDate < dto.startDate) {
      throw new BadRequestException("End date must be on or after the start date.");
    }
    const { anchorDay, anchorMonth } = anchorFromStartDate(dto.startDate);
    const schedule = await this.databaseService.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(recurringInvoiceSchedules)
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
      await tx.insert(recurringInvoiceScheduleLineItems).values(
        items.map((item, index) => ({
          organisationId: orgId,
          scheduleId: created!.id,
          catalogueItemId: item.catalogueItemId,
          description: item.description,
          quantity: String(item.quantity),
          unitPriceKobo: item.unitPriceKobo,
          sortOrder: index
        }))
      );
      await tx.insert(auditLogs).values({
        organisationId: orgId,
        actorUserId: userId,
        action: "recurring_schedule_created",
        entityType: "recurring_schedule",
        entityId: created!.id,
        metadataRedacted: { name: created!.name, frequency: created!.frequency }
      });
      return created!;
    });
    return this.getSchedule(context, schedule.id);
  }

  async getSchedule(context: ActiveOrganisationContext, id: string) {
    const orgId = context.activeOrganisation.id;
    const [schedule] = await this.databaseService.db
      .select()
      .from(recurringInvoiceSchedules)
      .where(
        and(
          eq(recurringInvoiceSchedules.id, id),
          eq(recurringInvoiceSchedules.organisationId, orgId)
        )
      )
      .limit(1);
    if (!schedule) throw new NotFoundException("Recurring schedule was not found.");
    const [lineItems, occurrences, jobs, customerRows] = await Promise.all([
      this.databaseService.db
        .select()
        .from(recurringInvoiceScheduleLineItems)
        .where(eq(recurringInvoiceScheduleLineItems.scheduleId, id)),
      this.databaseService.db
        .select({ occurrence: recurringInvoiceOccurrences, invoice: invoices })
        .from(recurringInvoiceOccurrences)
        .leftJoin(invoices, eq(recurringInvoiceOccurrences.invoiceId, invoices.id))
        .where(
          and(
            eq(recurringInvoiceOccurrences.scheduleId, id),
            eq(recurringInvoiceOccurrences.organisationId, orgId)
          )
        )
        .orderBy(desc(recurringInvoiceOccurrences.scheduledFor)),
      this.databaseService.db
        .select({
          id: automationJobs.id,
          status: automationJobs.status,
          lastError: automationJobs.lastError,
          scheduledFor: automationJobs.scheduledFor
        })
        .from(automationJobs)
        .where(
          and(
            eq(automationJobs.organisationId, orgId),
            eq(automationJobs.resourceId, id),
            eq(automationJobs.resourceType, "recurring_schedule")
          )
        )
        .orderBy(desc(automationJobs.scheduledFor)),
      this.databaseService.db
        .select({ name: customers.name })
        .from(customers)
        .where(and(eq(customers.id, schedule.customerId), eq(customers.organisationId, orgId)))
        .limit(1)
    ]);
    const recentOccurrences = occurrences.slice(0, 20);
    const invoiceIds = recentOccurrences.flatMap(({ invoice }) => (invoice ? [invoice.id] : []));
    const deliveries = invoiceIds.length
      ? await this.databaseService.db
          .select({ invoiceId: communications.invoiceId, status: communications.status })
          .from(communications)
          .where(
            and(
              eq(communications.organisationId, orgId),
              eq(communications.purpose, "invoice_delivery"),
              inArray(communications.invoiceId, invoiceIds)
            )
          )
          .orderBy(desc(communications.createdAt))
      : [];
    const deliveryByInvoice = new Map(
      deliveries.reverse().map((delivery) => [delivery.invoiceId, delivery.status])
    );
    const amount = lineItems.reduce(
      (sum, item) => sum + Math.round(Number(item.quantity) * item.unitPriceKobo),
      0
    );
    return {
      schedule: {
        ...schedule,
        customerName: customerRows[0]?.name ?? null,
        amountKobo: amount + schedule.taxKobo - schedule.discountKobo
      },
      lineItems,
      occurrences: recentOccurrences.map(({ occurrence, invoice }) => ({
        ...occurrence,
        invoice: invoice
          ? {
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              status: invoice.status,
              issueDate: invoice.issueDate,
              dueDate: invoice.dueDate,
              totalKobo: invoice.totalKobo,
              deliveryStatus: deliveryByInvoice.get(invoice.id) ?? null
            }
          : null
      })),
      automation: jobs.slice(0, 10)
    };
  }

  async updateSchedule(
    context: ActiveOrganisationContext,
    id: string,
    dto: UpdateRecurringInvoiceDto
  ) {
    const orgId = context.activeOrganisation.id;
    const current = await this.getSchedule(context, id);
    const existing = current.schedule;
    if (!["active", "paused"].includes(existing.status)) {
      throw new BadRequestException("Only active or paused schedules can be edited.");
    }
    if (dto.name !== undefined && !dto.name.trim())
      throw new BadRequestException("Schedule name is required.");
    const replacementItems =
      dto.lineItems === undefined ? undefined : normalizeLineItems(dto.lineItems);
    calculateInvoiceTotals({
      lineItems:
        replacementItems ??
        normalizeLineItems(
          current.lineItems.map((item) => ({ ...item, quantity: Number(item.quantity) }))
        ),
      discountKobo: dto.discountKobo ?? existing.discountKobo,
      taxKobo: dto.taxKobo ?? existing.taxKobo
    });
    if (dto.endDate !== undefined && dto.endDate !== null) {
      assertBusinessDate(dto.endDate, "End date");
      if (dto.endDate < businessDate())
        throw new BadRequestException("End date cannot be in the past.");
      if (dto.endDate < existing.startDate)
        throw new BadRequestException("End date must be on or after the start date.");
      if (dto.endDate < existing.nextIssueDate)
        throw new BadRequestException("End date cannot be before the next issue date.");
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.frequency !== undefined) patch.frequency = dto.frequency;
    if (dto.endDate !== undefined) patch.endDate = dto.endDate;
    if (dto.dueTermsDays !== undefined) patch.dueTermsDays = dto.dueTermsDays;
    if (dto.autoSend !== undefined) patch.autoSend = dto.autoSend;
    if (dto.toRecipients !== undefined || dto.ccRecipients !== undefined) {
      try {
        const r = validateSendRecipients(
          dto.toRecipients ?? existing.toRecipients,
          dto.ccRecipients ?? existing.ccRecipients
        );
        patch.toRecipients = r.to;
        patch.ccRecipients = r.cc;
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : "Recipients are invalid."
        );
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
    // Keep the original anchor when the frequency changes.
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
    const effectiveEndDate = dto.endDate === undefined ? existing.endDate : dto.endDate;
    if (
      effectiveEndDate &&
      typeof patch.nextIssueDate === "string" &&
      effectiveEndDate < patch.nextIssueDate
    ) {
      throw new BadRequestException("End date cannot be before the next issue date.");
    }
    await this.databaseService.db.transaction(async (tx) => {
      await this.lockScheduleJobs(tx, orgId, id);
      await this.lockSchedule(tx, orgId, existing);
      await this.cancelScheduleJobs(tx, orgId, id);
      await tx
        .update(recurringInvoiceSchedules)
        .set(patch)
        .where(
          and(
            eq(recurringInvoiceSchedules.id, id),
            eq(recurringInvoiceSchedules.organisationId, orgId)
          )
        );
      if (replacementItems !== undefined) {
        await tx
          .delete(recurringInvoiceScheduleLineItems)
          .where(eq(recurringInvoiceScheduleLineItems.scheduleId, id));
        await tx.insert(recurringInvoiceScheduleLineItems).values(
          replacementItems.map((item, index) => ({
            organisationId: orgId,
            scheduleId: id,
            catalogueItemId: item.catalogueItemId,
            description: item.description,
            quantity: String(item.quantity),
            unitPriceKobo: item.unitPriceKobo,
            sortOrder: index
          }))
        );
      }
      await tx.insert(auditLogs).values({
        organisationId: orgId,
        actorUserId: context.user.id,
        action: "recurring_schedule_edited",
        entityType: "recurring_schedule",
        entityId: id,
        metadataRedacted: {}
      });
    });
    return this.getSchedule(context, id);
  }

  async pauseSchedule(context: ActiveOrganisationContext, id: string) {
    const orgId = context.activeOrganisation.id;
    const existing = (await this.getSchedule(context, id)).schedule;
    if (existing.status !== "active")
      throw new BadRequestException("Only active schedules can be paused.");
    await this.databaseService.db.transaction(async (tx) => {
      await this.lockScheduleJobs(tx, orgId, id);
      await this.lockSchedule(tx, orgId, existing);
      await this.cancelScheduleJobs(tx, orgId, id);
      await tx
        .update(recurringInvoiceSchedules)
        .set({ status: "paused", updatedAt: new Date() })
        .where(
          and(
            eq(recurringInvoiceSchedules.id, id),
            eq(recurringInvoiceSchedules.organisationId, orgId)
          )
        );
      await tx.insert(auditLogs).values({
        organisationId: orgId,
        actorUserId: context.user.id,
        action: "recurring_schedule_paused",
        entityType: "recurring_schedule",
        entityId: id,
        metadataRedacted: {}
      });
    });
    return this.getSchedule(context, id);
  }

  async resumeSchedule(context: ActiveOrganisationContext, id: string) {
    const orgId = context.activeOrganisation.id;
    const existing = (await this.getSchedule(context, id)).schedule;
    if (existing.status !== "paused")
      throw new BadRequestException("Only paused schedules can be resumed.");
    // Advance to first occurrence on/after today; missed periods are skipped
    const today = businessDate();
    const nextIssueDate = firstIssueAfterOrOn({
      frequency: existing.frequency as "weekly" | "monthly" | "quarterly" | "yearly",
      anchorDay: existing.anchorDay,
      anchorMonth: existing.anchorMonth,
      startDate: existing.startDate,
      fromDate: today
    });
    await this.databaseService.db.transaction(async (tx) => {
      await this.lockScheduleJobs(tx, orgId, id);
      await this.lockSchedule(tx, orgId, existing);
      const completed = !!existing.endDate && nextIssueDate > existing.endDate;
      await tx
        .update(recurringInvoiceSchedules)
        .set({ status: completed ? "completed" : "active", nextIssueDate, updatedAt: new Date() })
        .where(
          and(
            eq(recurringInvoiceSchedules.id, id),
            eq(recurringInvoiceSchedules.organisationId, orgId)
          )
        );
      if (!completed) {
        await tx.execute(sql`update automation_jobs set status = 'pending', claim_token = null, claimed_at = null,
          skipped_at = null, next_attempt_at = null, last_error = null, updated_at = now()
          where organisation_id = ${orgId} and resource_type = 'recurring_schedule' and resource_id = ${id}
          and kind = 'recurring_invoice_generate' and scheduled_for = ${nextIssueDate}
          and status = 'cancelled'`);
      }
      await tx.insert(auditLogs).values({
        organisationId: orgId,
        actorUserId: context.user.id,
        action: "recurring_schedule_resumed",
        entityType: "recurring_schedule",
        entityId: id,
        metadataRedacted: { nextIssueDate }
      });
    });
    return this.getSchedule(context, id);
  }

  async cancelSchedule(context: ActiveOrganisationContext, id: string) {
    const orgId = context.activeOrganisation.id;
    const existing = (await this.getSchedule(context, id)).schedule;
    if (["completed", "cancelled"].includes(existing.status)) {
      throw new BadRequestException("Schedule is already ended.");
    }
    await this.databaseService.db.transaction(async (tx) => {
      await this.lockScheduleJobs(tx, orgId, id);
      await this.lockSchedule(tx, orgId, existing);
      await this.cancelScheduleJobs(tx, orgId, id);
      await tx
        .update(recurringInvoiceSchedules)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          and(
            eq(recurringInvoiceSchedules.id, id),
            eq(recurringInvoiceSchedules.organisationId, orgId)
          )
        );
      await tx.execute(sql`update recurring_invoice_occurrences set status = 'skipped', updated_at = now()
        where organisation_id = ${orgId} and schedule_id = ${id} and status = 'pending'`);
      await tx.insert(auditLogs).values({
        organisationId: orgId,
        actorUserId: context.user.id,
        action: "recurring_schedule_cancelled",
        entityType: "recurring_schedule",
        entityId: id,
        metadataRedacted: {}
      });
    });
    return this.getSchedule(context, id);
  }
}
