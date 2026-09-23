import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { businessDate, isValidBusinessDate } from "../../common/business-date";
import { DatabaseService } from "../../database/database.service";
import { automationJobs, customers, invoices } from "../../database/schema";
import { AuditLogService } from "../audit-log/audit-log.service";
import { validateSendRecipients } from "../communications/email-provider";
import type { ScheduleSendDto } from "./dto/reminder-settings.dto";

@Injectable()
export class ScheduledSendService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService
  ) {}

  async scheduleSend(context: ActiveOrganisationContext, invoiceId: string, dto: ScheduleSendDto) {
    const orgId = context.activeOrganisation.id;
    const [invoice] = await this.databaseService.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.organisationId, orgId)))
      .limit(1);
    if (!invoice) throw new NotFoundException("Invoice was not found.");
    if (invoice.status !== "draft") throw new BadRequestException("Only draft invoices can be scheduled.");
    if (!dto.scheduledSendDate || !isValidBusinessDate(dto.scheduledSendDate)) {
      throw new BadRequestException("A valid scheduled date (YYYY-MM-DD) is required.");
    }
    if (dto.scheduledSendDate < businessDate()) {
      throw new BadRequestException("Scheduled date cannot be in the past.");
    }
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(eq(customers.id, invoice.customerId))
      .limit(1);
    const to = dto.to?.length ? dto.to : [customer?.email ?? ""];
    try {
      validateSendRecipients(to, dto.cc ?? []);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Recipients are invalid.");
    }
    const normalized = validateSendRecipients(to, dto.cc ?? []);
    await this.databaseService.db.transaction(async (tx) => {
    const [scheduled] = await tx
      .update(invoices)
      .set({
        scheduledSendDate: dto.scheduledSendDate,
        scheduledSendTo: normalized.to,
        scheduledSendCc: normalized.cc,
        scheduledSendSubject: dto.subject ?? null,
        updatedAt: new Date()
      })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.organisationId, orgId), eq(invoices.status, "draft")))
      .returning({ id: invoices.id });
    if (!scheduled) throw new BadRequestException("Only draft invoices can be scheduled.");
    // Upsert one job per invoice+date; rescheduling replaces the pending job.
    await tx
      .update(automationJobs)
      .set({ status: "cancelled", claimToken: null, skippedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(automationJobs.organisationId, orgId),
          eq(automationJobs.resourceId, invoiceId),
          eq(automationJobs.kind, "invoice_scheduled_send"),
          eq(automationJobs.status, "pending")
        )
      );
    await tx
      .insert(automationJobs)
      .values({
        organisationId: orgId,
        kind: "invoice_scheduled_send",
        resourceType: "invoice",
        resourceId: invoiceId,
        scheduledFor: dto.scheduledSendDate,
        idempotencyKey: `scheduled:${invoiceId}:${dto.scheduledSendDate}`,
        status: "pending",
        maxAttempts: 3,
        payloadRedacted: { invoiceId }
      })
      .onConflictDoUpdate({
        target: automationJobs.idempotencyKey,
        set: { status: "pending", scheduledFor: dto.scheduledSendDate, attemptCount: 0, claimToken: null, claimedAt: null, skippedAt: null, completedAt: null, lastError: null, updatedAt: new Date() },
        setWhere: eq(automationJobs.status, "cancelled")
      });
    });
    await this.auditLogService.create({
      organisationId: orgId,
      actorUserId: context.user.id,
      action: "scheduled_send_created",
      entityType: "invoice",
      entityId: invoiceId,
      metadataRedacted: { scheduledSendDate: dto.scheduledSendDate }
    });
    return { invoiceId, scheduledSendDate: dto.scheduledSendDate };
  }

  async cancelScheduledSend(context: ActiveOrganisationContext, invoiceId: string) {
    const orgId = context.activeOrganisation.id;
    const [invoice] = await this.databaseService.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.organisationId, orgId)))
      .limit(1);
    if (!invoice) throw new NotFoundException("Invoice was not found.");
    await this.databaseService.db.transaction(async (tx) => {
    const [cancelled] = await tx
      .update(invoices)
      .set({ scheduledSendDate: null, scheduledSendTo: null, scheduledSendCc: null, scheduledSendSubject: null, updatedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.organisationId, orgId), eq(invoices.status, "draft")))
      .returning({ id: invoices.id });
    if (!cancelled) throw new BadRequestException("Only draft invoices can have a scheduled send cancelled.");
    await tx
      .update(automationJobs)
      .set({ status: "cancelled", claimToken: null, skippedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(automationJobs.organisationId, orgId),
          eq(automationJobs.resourceId, invoiceId),
          eq(automationJobs.kind, "invoice_scheduled_send"),
          eq(automationJobs.status, "running")
        )
      );
    await tx.update(automationJobs).set({ status: "cancelled", skippedAt: new Date(), updatedAt: new Date() }).where(and(eq(automationJobs.organisationId, orgId), eq(automationJobs.resourceId, invoiceId), eq(automationJobs.kind, "invoice_scheduled_send"), eq(automationJobs.status, "pending")));
    });
    await this.auditLogService.create({
      organisationId: orgId,
      actorUserId: context.user.id,
      action: "scheduled_send_cancelled",
      entityType: "invoice",
      entityId: invoiceId,
      metadataRedacted: {}
    });
    return { invoiceId, cancelled: true };
  }
}


