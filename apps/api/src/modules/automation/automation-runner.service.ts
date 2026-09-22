import { randomBytes, randomUUID } from "crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, lte, sql } from "drizzle-orm";

import { businessDate } from "../../common/business-date";
import { assertKoboAmount } from "../../common/money-limits";
import { nextRecurrenceDate } from "../../common/recurrence";
import { DatabaseService } from "../../database/database.service";
import {
  automationJobs,
  businessProfiles,
  customers,
  invoiceLineItems,
  invoiceStatusEvents,
  invoices,

  organisationReminderSettings,
  recurringInvoiceOccurrences,
  recurringInvoiceScheduleLineItems,
  recurringInvoiceSchedules,
  reminderSteps,
  type AutomationJob
} from "../../database/schema";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CommunicationsService } from "../communications/communications.service";
import { EmailUncertainError } from "../communications/email-provider";
import { formatKoboToNairaText, renderReminderHtml, renderReminderTemplate } from "./reminder-template";

const CLAIM_BATCH_SIZE = 25;
const CLAIM_LEASE_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 3;

export type AutomationSummary = {
  date: string;
  claimed: number;
  completed: number;
  skipped: number;
  needsAttention: number;
  failed: number;
};

function addDaysISO(dateOnly: string, days: number): string {
  const parts = dateOnly.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function diffDays(fromDateOnly: string, toDateOnly: string): number {
  const f = fromDateOnly.split("-").map(Number);
  const t = toDateOnly.split("-").map(Number);
  const fy = f[0] ?? 1970;
  const fm = f[1] ?? 1;
  const fd = f[2] ?? 1;
  const ty = t[0] ?? 1970;
  const tm = t[1] ?? 1;
  const td = t[2] ?? 1;
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

@Injectable()
export class AutomationRunnerService {
  private readonly logger = new Logger(AutomationRunnerService.name);

  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(CommunicationsService) private readonly communicationsService: CommunicationsService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService
  ) {}

  async run(asOfDate?: string): Promise<AutomationSummary> {
    const date = asOfDate ?? businessDate();
    await this.materializeRecurringJobs(date);
    await this.materializeScheduledSendJobs(date);
    await this.materializeReminderJobs(date);
    await this.reclaimStaleJobs();
    const claimed = await this.claimBatch(date);
    let completed = 0;
    let skipped = 0;
    let needsAttention = 0;
    let failed = 0;
    for (const job of claimed) {
      try {
        const outcome = await this.processJob(job, date);
        if (outcome === "completed") completed += 1;
        else if (outcome === "skipped") skipped += 1;
        else if (outcome === "needs_attention") needsAttention += 1;
        else failed += 1;
      } catch (error) {
        this.logger.warn(`Automation job ${job.id} failed: ${String(error)}`);
        await this.markOutcome(job, "failed", error instanceof Error ? error.message.slice(0, 500) : "Job failed.");
        failed += 1;
      }
    }
    return { date, claimed: claimed.length, completed, skipped, needsAttention, failed };
  }

  private async materializeRecurringJobs(date: string): Promise<void> {
    const due = await this.databaseService.db
      .select()
      .from(recurringInvoiceSchedules)
      .where(
        and(eq(recurringInvoiceSchedules.status, "active"), lte(recurringInvoiceSchedules.nextIssueDate, date))
      );
    for (const schedule of due) {
      if (schedule.endDate && schedule.nextIssueDate > schedule.endDate) {
        await this.databaseService.db
          .update(recurringInvoiceSchedules)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(recurringInvoiceSchedules.id, schedule.id));
        continue;
      }
      await this.databaseService.db
        .insert(recurringInvoiceOccurrences)
        .values({
          organisationId: schedule.organisationId,
          scheduleId: schedule.id,
          scheduledFor: schedule.nextIssueDate,
          status: "pending"
        })
        .onConflictDoNothing();
      await this.databaseService.db
        .insert(automationJobs)
        .values({
          organisationId: schedule.organisationId,
          kind: "recurring_invoice_generate",
          resourceType: "recurring_schedule",
          resourceId: schedule.id,
          scheduledFor: schedule.nextIssueDate,
          idempotencyKey: `recurring:${schedule.id}:${schedule.nextIssueDate}`,
          status: "pending",
          maxAttempts: MAX_ATTEMPTS,
          payloadRedacted: { scheduleId: schedule.id, scheduledFor: schedule.nextIssueDate }
        })
        .onConflictDoNothing();
    }
  }

  private async materializeScheduledSendJobs(date: string): Promise<void> {
    const rows = await this.databaseService.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.status, "draft"), lte(invoices.scheduledSendDate, date)));
    for (const invoice of rows) {
      if (!invoice.scheduledSendDate) continue;
      await this.databaseService.db
        .insert(automationJobs)
        .values({
          organisationId: invoice.organisationId,
          kind: "invoice_scheduled_send",
          resourceType: "invoice",
          resourceId: invoice!.id,
          scheduledFor: invoice.scheduledSendDate,
          idempotencyKey: `scheduled:${invoice!.id}:${invoice.scheduledSendDate}`,
          status: "pending",
          maxAttempts: MAX_ATTEMPTS,
          payloadRedacted: { invoiceId: invoice!.id }
        })
        .onConflictDoNothing();
    }
  }

  private async materializeReminderJobs(date: string): Promise<void> {
    const enabledOrgs = await this.databaseService.db
      .select()
      .from(organisationReminderSettings)
      .where(eq(organisationReminderSettings.enabled, true));
    if (enabledOrgs.length === 0) return;
    const enabledOrgIds = new Set(enabledOrgs.map((r) => r.organisationId));
    // Candidate invoices: issued-ish, unpaid, opted in. Balance is authoritative at send time.
    const candidateStatuses = ["sent", "viewed", "overdue", "partially_paid"];
    for (const orgId of enabledOrgIds) {
      const steps = await this.databaseService.db
        .select()
        .from(reminderSteps)
        .where(and(eq(reminderSteps.organisationId, orgId), eq(reminderSteps.enabled, true)));
      if (steps.length === 0) continue;
      const candidateInvoices = await this.databaseService.db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.organisationId, orgId),
            eq(invoices.automaticRemindersEnabled, true)
          )
        );
      for (const invoice of candidateInvoices) {
        if (!candidateStatuses.includes(invoice.status)) continue;
        if ((invoice.balanceDueKobo ?? 0) <= 0) continue;
        if (!invoice.publicAccessEnabled) continue;
        const [customer] = await this.databaseService.db
          .select()
          .from(customers)
          .where(and(eq(customers.id, invoice.customerId), eq(customers.organisationId, orgId)))
          .limit(1);
        if (!customer || customer.archivedAt || !customer.automaticRemindersEnabled) continue;
        const daysOverdue = diffDays(invoice!.dueDate, date);
        // Applicable steps: scheduled date (dueDate + relativeDays) <= today
        const applicable = steps.filter((s) => diffDays(addDaysISO(invoice!.dueDate, s.relativeDays), date) >= 0);
        if (applicable.length === 0) continue;
        // Skip stale pre-due: if invoice now due/overdue, drop before-due steps
        const timely = daysOverdue >= 0 ? applicable.filter((s) => s.relativeDays >= 0) : applicable;
        if (timely.length === 0) {
          continue;
        }
        // Latest applicable only; older missed become skipped/superseded implicitly
        const latest = timely.sort((a, b) => b.relativeDays - a.relativeDays)[0]!;
        const key = `reminder:${invoice!.id}:${latest.relativeDays}:${invoice!.dueDate}`;
        await this.databaseService.db
          .insert(automationJobs)
          .values({
            organisationId: orgId,
            kind: "invoice_reminder_send",
            resourceType: "invoice",
            resourceId: invoice!.id,
            scheduledFor: date,
            idempotencyKey: key,
            status: "pending",
            maxAttempts: MAX_ATTEMPTS,
            payloadRedacted: { invoiceId: invoice!.id, relativeDays: latest.relativeDays, stepId: latest.id }
          })
          .onConflictDoNothing();
      }
    }
  }

  private async reclaimStaleJobs(): Promise<void> {
    const cutoff = new Date(Date.now() - CLAIM_LEASE_MS);
    await this.databaseService.db.execute(
      sql`update automation_jobs set status = 'pending', claim_token = null, claimed_at = null, updated_at = now() where status = 'running' and claimed_at < ${cutoff.toISOString()}`
    );
  }

  private async claimBatch(date: string): Promise<AutomationJob[]> {
    // Claim first, commit claim, perform side effect later in a new txn.
    // Raw SQL returns snake_case columns; map back to camelCase Drizzle shape.
    const result = await this.databaseService.db.execute(
      sql`update automation_jobs set status = 'running', claim_token = ${randomUUID()}, claimed_at = now(), attempt_count = attempt_count + 1, updated_at = now() where id in (select id from automation_jobs where status = 'pending' and scheduled_for <= ${date} and (next_attempt_at is null or next_attempt_at <= now()) order by scheduled_for asc limit ${CLAIM_BATCH_SIZE} for update skip locked) returning *`
    );
    const rows = ((result as unknown as { rows: Record<string, unknown>[] }).rows ?? []) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r.id,
      organisationId: r.organisation_id,
      kind: r.kind,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      scheduledFor: typeof r.scheduled_for === "string" ? r.scheduled_for : new Date(r.scheduled_for as string).toISOString().slice(0, 10),
      runAt: r.run_at,
      idempotencyKey: r.idempotency_key,
      status: r.status,
      attemptCount: r.attempt_count,
      maxAttempts: r.max_attempts,
      claimToken: r.claim_token,
      claimedAt: r.claimed_at,
      nextAttemptAt: r.next_attempt_at,
      lastError: r.last_error,
      payloadRedacted: r.payload_redacted,
      completedAt: r.completed_at,
      skippedAt: r.skipped_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    })) as AutomationJob[];
  }

  private async processJob(job: AutomationJob, _date: string): Promise<"completed" | "skipped" | "failed" | "needs_attention"> {
    if (job.kind === "recurring_invoice_generate") return this.processRecurringGenerate(job);
    if (job.kind === "invoice_scheduled_send") return this.processScheduledSend(job);
    if (job.kind === "invoice_reminder_send") return this.processReminder(job);
    await this.markOutcome(job, "skipped", "Unknown job kind.");
    return "skipped";
  }

  private async processRecurringGenerate(job: AutomationJob): Promise<"completed" | "skipped" | "failed" | "needs_attention"> {
    const [schedule] = await this.databaseService.db
      .select()
      .from(recurringInvoiceSchedules)
      .where(eq(recurringInvoiceSchedules.id, job.resourceId))
      .limit(1);
    if (!schedule || schedule.organisationId !== job.organisationId) {
      await this.markOutcome(job, "skipped", "Schedule is no longer available.");
      return "skipped";
    }
    if (schedule.status !== "active") {
      await this.markOutcome(job, "skipped", `Schedule is ${schedule.status}.`);
      await this.markOccurrence(job.organisationId, schedule.id, job.scheduledFor, "skipped", null);
      return "skipped";
    }
    if (schedule.nextIssueDate !== job.scheduledFor) {
      await this.markOutcome(job, "skipped", "Schedule advanced past this occurrence.");
      return "skipped";
    }
    // Occurrence uniqueness is the second defense (UNIQUE schedule+date).
    const [existingOccurrence] = await this.databaseService.db
      .select()
      .from(recurringInvoiceOccurrences)
      .where(
        and(
          eq(recurringInvoiceOccurrences.scheduleId, schedule.id),
          eq(recurringInvoiceOccurrences.scheduledFor, job.scheduledFor)
        )
      )
      .limit(1);
    if (existingOccurrence?.status === "generated" && existingOccurrence.invoiceId) {
      await this.markOutcome(job, "completed", null);
      return "completed";
    }
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, schedule.customerId), eq(customers.organisationId, schedule.organisationId)))
      .limit(1);
    if (!customer || customer.archivedAt) {
      await this.markOutcome(job, "needs_attention", "Customer is archived or missing.");
      await this.markOccurrence(job.organisationId, schedule.id, job.scheduledFor, "failed", "Customer ineligible.");
      return "needs_attention";
    }
    const lineItems = await this.databaseService.db
      .select()
      .from(recurringInvoiceScheduleLineItems)
      .where(eq(recurringInvoiceScheduleLineItems.scheduleId, schedule.id));
    if (lineItems.length === 0) {
      await this.markOutcome(job, "needs_attention", "Schedule has no line items.");
      return "needs_attention";
    }
    try {
      const invoice = await this.createInvoiceFromSchedule(schedule, lineItems, job.scheduledFor, customer.id);
      await this.markOccurrence(job.organisationId, schedule.id, job.scheduledFor, "generated", null, invoice!.id);
      const nextDate = nextRecurrenceDate({
        frequency: schedule.frequency as "weekly" | "monthly" | "quarterly" | "yearly",
        previousScheduledFor: job.scheduledFor,
        anchorDay: schedule.anchorDay,
        anchorMonth: schedule.anchorMonth
      });
      if (schedule.endDate && nextDate > schedule.endDate) {
        await this.databaseService.db
          .update(recurringInvoiceSchedules)
          .set({ status: "completed", lastGeneratedAt: new Date(), lastInvoiceId: invoice!.id, updatedAt: new Date() })
          .where(eq(recurringInvoiceSchedules.id, schedule.id));
      } else {
        await this.databaseService.db
          .update(recurringInvoiceSchedules)
          .set({ nextIssueDate: nextDate, lastGeneratedAt: new Date(), lastInvoiceId: invoice!.id, lastError: null, updatedAt: new Date() })
          .where(eq(recurringInvoiceSchedules.id, schedule.id));
      }
      await this.auditLogService.create({
        organisationId: schedule.organisationId,
        actorUserId: null,
        action: "recurring_invoice_generated",
        entityType: "invoice",
        entityId: invoice!.id,
        metadataRedacted: { scheduleId: schedule.id, scheduledFor: job.scheduledFor }
      });
      if (schedule.autoSend) {
        return this.autoSendGeneratedInvoice(schedule, invoice, job);
      }
      await this.markOutcome(job, "completed", null);
      return "completed";
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Generation failed.";
      await this.markOccurrence(job.organisationId, schedule.id, job.scheduledFor, "failed", message);
      await this.markOutcome(job, "failed", message);
      return "failed";
    }
  }

  private async createInvoiceFromSchedule(
    schedule: typeof recurringInvoiceSchedules.$inferSelect,
    lineItems: (typeof recurringInvoiceScheduleLineItems.$inferSelect)[],
    issueDate: string,
    customerId: string
  ) {
    const dueDate = addDaysISO(issueDate, schedule.dueTermsDays);
    const items = lineItems.map((item) => ({
      quantity: Number(item.quantity),
      unitPriceKobo: item.unitPriceKobo
    }));
    const lineTotals = items.map((item) => assertKoboAmount(Math.round(item.quantity * item.unitPriceKobo), "Line total"));
    const subtotal = lineTotals.reduce((s, t) => assertKoboAmount(s + t, "Subtotal"), 0);
    const total = assertKoboAmount(subtotal - schedule.discountKobo + schedule.taxKobo, "Total");
    const invoiceNumber = await this.nextInvoiceNumber(schedule.organisationId);
    const publicToken = randomBytes(32).toString("hex");
    const db = this.databaseService.db;
    const [invoice] = await db
      .insert(invoices)
      .values({
        organisationId: schedule.organisationId,
        customerId,
        invoiceNumber,
        publicToken,
        publicAccessEnabled: false,
        status: "draft",
        currency: "NGN",
        issueDate,
        dueDate,
        customerReference: schedule.customerReference,
        notes: schedule.notes,
        subtotalKobo: subtotal,
        discountKobo: schedule.discountKobo,
        taxKobo: schedule.taxKobo,
        totalKobo: total,
        amountPaidKobo: 0,
        balanceDueKobo: total,
        createdByUserId: schedule.createdByUserId
      })
      .returning();
    await db.insert(invoiceLineItems).values(
      lineItems.map((item, index) => ({
        organisationId: schedule.organisationId,
        invoiceId: invoice!.id,
        description: item.description,
        quantity: String(item.quantity),
        unitPriceKobo: item.unitPriceKobo,
        lineTotalKobo: lineTotals[index]!,
        sortOrder: item.sortOrder ?? index
      }))
    );
    await db.insert(invoiceStatusEvents).values({
      organisationId: schedule.organisationId,
      invoiceId: invoice!.id,
      fromStatus: null,
      toStatus: "draft",
      reason: "invoice_created"
    });
    return invoice!;
  }

  private async nextInvoiceNumber(organisationId: string): Promise<string> {
    // Row-level lock on the org sequence so concurrent generators never collide.
    const result = await this.databaseService.db.execute<{ next_number: number }>(
      sql`insert into invoice_number_sequences (organisation_id, next_number) values (${organisationId}, 1) on conflict (organisation_id) do update set next_number = invoice_number_sequences.next_number + 1, updated_at = now() returning invoice_number_sequences.next_number - 1 as next_number`
    );
    const rows = (result as unknown as { rows: { next_number: number }[] }).rows;
    const seq = Number(rows?.[0]?.next_number ?? 1);
    return `INV-${String(seq).padStart(6, "0")}`;
  }

  private async autoSendGeneratedInvoice(
    schedule: typeof recurringInvoiceSchedules.$inferSelect,
    invoice: typeof invoices.$inferSelect,
    job: AutomationJob
  ): Promise<"completed" | "needs_attention" | "failed"> {
    // Issue first (CAS draft->sent), then email through T021 infra.
    const now = new Date();
    const issued = await this.databaseService.db
      .update(invoices)
      .set({ status: "sent", publicAccessEnabled: true, sentAt: now, updatedAt: now })
      .where(and(eq(invoices.id, invoice!.id), eq(invoices.status, "draft")))
      .returning();
    if (issued.length === 0) {
      await this.markOutcome(job, "failed", "Generated invoice could not be issued.");
      return "failed";
    }
    const frontendUrl = (this.configService.get<string>("FRONTEND_APP_URL") ?? "http://localhost:3000").replace(/\/$/, "");
    const [profile] = await this.databaseService.db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.organisationId, schedule.organisationId))
      .limit(1);
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(eq(customers.id, schedule.customerId))
      .limit(1);
    try {
      const result = await this.communicationsService.sendInvoiceEmail(
        {
          organisationId: schedule.organisationId,
          userId: schedule.createdByUserId ?? schedule.organisationId,
          invoice: { id: invoice!.id, invoiceNumber: invoice!.invoiceNumber },
          customerId: schedule.customerId,
          content: {
            customerEmail: customer?.email ?? "",
            customerName: customer?.name ?? "",
            businessName: profile?.businessName ?? "Your business",
            businessEmail: profile?.email,
            invoiceNumber: invoice!.invoiceNumber,
            amountDueKobo: invoice!.totalKobo,
            dueDate: invoice!.dueDate,
            publicUrl: `${frontendUrl}/invoice/${invoice!.publicToken}`,
            to: schedule.toRecipients,
            cc: schedule.ccRecipients ?? [],
            subject: schedule.emailSubject ?? undefined
          }
        },
        { idempotencyKey: `auto:${job.idempotencyKey}`, purpose: "invoice_delivery" }
      );
      if (result.outcome === "uncertain") {
        await this.markOutcome(job, "needs_attention", "Email submission uncertain; kept for recovery.");
        return "needs_attention";
      }
      await this.markOutcome(job, "completed", null);
      return "completed";
    } catch (error) {
      if (error instanceof EmailUncertainError) {
        await this.markOutcome(job, "needs_attention", "Email submission uncertain; kept for recovery.");
        return "needs_attention";
      }
      const message = error instanceof Error ? error.message.slice(0, 500) : "Auto-send failed.";
      // Partial success: invoice is issued; never fake delivered.
      await this.databaseService.db
        .update(recurringInvoiceSchedules)
        .set({ lastError: message, updatedAt: new Date() })
        .where(eq(recurringInvoiceSchedules.id, schedule.id));
      await this.markOutcome(job, "needs_attention", message);
      return "needs_attention";
    }
  }

  private async processScheduledSend(job: AutomationJob): Promise<"completed" | "skipped" | "failed" | "needs_attention"> {
    const [invoice] = await this.databaseService.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, job.resourceId), eq(invoices.organisationId, job.organisationId)))
      .limit(1);
    if (!invoice) {
      await this.markOutcome(job, "skipped", "Invoice no longer exists.");
      return "skipped";
    }
    if (invoice.status !== "draft" || !invoice.scheduledSendDate) {
      await this.markOutcome(job, "skipped", "Invoice is no longer a scheduled draft.");
      return "skipped";
    }
    if (invoice.scheduledSendDate !== job.scheduledFor) {
      await this.markOutcome(job, "skipped", "Scheduled date changed; superseded.");
      return "skipped";
    }
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(eq(customers.id, invoice.customerId))
      .limit(1);
    if (!customer || customer.archivedAt) {
      await this.markOutcome(job, "needs_attention", "Customer is archived or missing.");
      return "needs_attention";
    }
    const now = new Date();
    const issued = await this.databaseService.db
      .update(invoices)
      .set({
        status: "sent",
        publicAccessEnabled: true,
        sentAt: now,
        scheduledSendDate: null,
        scheduledSendTo: null,
        scheduledSendCc: null,
        scheduledSendSubject: null,
        updatedAt: now
      })
      .where(and(eq(invoices.id, invoice!.id), eq(invoices.status, "draft")))
      .returning();
    if (issued.length === 0) {
      await this.markOutcome(job, "skipped", "Invoice was sent or changed concurrently.");
      return "skipped";
    }
    const frontendUrl = (this.configService.get<string>("FRONTEND_APP_URL") ?? "http://localhost:3000").replace(/\/$/, "");
    const [profile] = await this.databaseService.db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.organisationId, invoice.organisationId))
      .limit(1);
    try {
      const result = await this.communicationsService.sendInvoiceEmail(
        {
          organisationId: invoice.organisationId,
          userId: invoice.createdByUserId ?? invoice.organisationId,
          invoice: { id: invoice!.id, invoiceNumber: invoice!.invoiceNumber },
          customerId: invoice.customerId,
          content: {
            customerEmail: customer.email,
            customerName: customer.name,
            businessName: profile?.businessName ?? "Your business",
            businessEmail: profile?.email,
            invoiceNumber: invoice!.invoiceNumber,
            amountDueKobo: invoice!.totalKobo,
            dueDate: invoice!.dueDate,
            publicUrl: `${frontendUrl}/invoice/${issued[0]!.publicToken}`,
            to: invoice.scheduledSendTo ?? [customer.email],
            cc: invoice.scheduledSendCc ?? [],
            subject: invoice.scheduledSendSubject ?? undefined
          }
        },
        { idempotencyKey: `auto:${job.idempotencyKey}`, purpose: "invoice_delivery" }
      );
      if (result.outcome === "uncertain") {
        await this.markOutcome(job, "needs_attention", "Email submission uncertain; kept for recovery.");
        return "needs_attention";
      }
      await this.auditLogService.create({
        organisationId: invoice.organisationId,
        actorUserId: null,
        action: "scheduled_send_completed",
        entityType: "invoice",
        entityId: invoice!.id,
        metadataRedacted: {}
      });
      await this.markOutcome(job, "completed", null);
      return "completed";
    } catch (error) {
      if (error instanceof EmailUncertainError) {
        await this.markOutcome(job, "needs_attention", "Email submission uncertain; kept for recovery.");
        return "needs_attention";
      }
      const message = error instanceof Error ? error.message.slice(0, 500) : "Scheduled send failed.";
      await this.markOutcome(job, "needs_attention", message);
      return "needs_attention";
    }
  }

  private async processReminder(job: AutomationJob): Promise<"completed" | "skipped" | "failed" | "needs_attention"> {
    const payload = (job.payloadRedacted ?? {}) as { relativeDays?: number; stepId?: string; invoiceId?: string };
    const [invoice] = await this.databaseService.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, job.resourceId), eq(invoices.organisationId, job.organisationId)))
      .limit(1);
    if (!invoice) {
      await this.markOutcome(job, "skipped", "Invoice no longer exists.");
      return "skipped";
    }
    // Re-check authoritative state immediately before send.
    const [settings] = await this.databaseService.db
      .select()
      .from(organisationReminderSettings)
      .where(eq(organisationReminderSettings.organisationId, job.organisationId))
      .limit(1);
    if (!settings?.enabled) {
      await this.markOutcome(job, "skipped", "Reminder automation is disabled.");
      return "skipped";
    }
    if (!invoice.automaticRemindersEnabled) {
      await this.markOutcome(job, "skipped", "Reminders are off for this invoice.");
      return "skipped";
    }
    if (!["sent", "viewed", "overdue", "partially_paid"].includes(invoice.status)) {
      await this.markOutcome(job, "skipped", `Invoice is ${invoice.status}.`);
      return "skipped";
    }
    if ((invoice.balanceDueKobo ?? 0) <= 0) {
      await this.markOutcome(job, "skipped", "Invoice is paid.");
      return "skipped";
    }
    if (!invoice.publicAccessEnabled) {
      await this.markOutcome(job, "skipped", "Invoice is not publicly shareable.");
      return "skipped";
    }
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(eq(customers.id, invoice.customerId))
      .limit(1);
    if (!customer || customer.archivedAt || !customer.automaticRemindersEnabled) {
      await this.markOutcome(job, "skipped", "Customer is ineligible for reminders.");
      return "skipped";
    }
    const [step] = payload.stepId
      ? await this.databaseService.db
          .select()
          .from(reminderSteps)
          .where(and(eq(reminderSteps.id, payload.stepId), eq(reminderSteps.organisationId, job.organisationId)))
          .limit(1)
      : [];
    if (!step || !step.enabled) {
      await this.markOutcome(job, "skipped", "Reminder step is disabled or removed.");
      return "skipped";
    }
    const frontendUrl = (this.configService.get<string>("FRONTEND_APP_URL") ?? "http://localhost:3000").replace(/\/$/, "");
    const [profile] = await this.databaseService.db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.organisationId, job.organisationId))
      .limit(1);
    const context = {
      businessName: profile?.businessName ?? "Your business",
      customerName: customer.name,
      invoiceNumber: invoice!.invoiceNumber,
      amountDue: formatKoboToNairaText(invoice.balanceDueKobo),
      dueDate: invoice!.dueDate,
      publicInvoiceUrl: `${frontendUrl}/invoice/${invoice!.publicToken}`
    };
    let subject: string;
    let textBody: string;
    try {
      subject = renderReminderTemplate(step.subjectTemplate, context);
      textBody = renderReminderTemplate(step.bodyTemplate, context);
    } catch (error) {
      await this.markOutcome(job, "failed", error instanceof Error ? error.message.slice(0, 500) : "Template invalid.");
      return "failed";
    }
    try {
      const result = await this.communicationsService.sendPaymentReminderEmail(
        {
          organisationId: job.organisationId,
          userId: invoice.createdByUserId ?? job.organisationId,
          invoice: { id: invoice!.id, invoiceNumber: invoice!.invoiceNumber },
          customerId: invoice.customerId,
          content: {
            customerEmail: customer.email,
            customerName: customer.name,
            businessName: context.businessName,
            businessEmail: profile?.email,
            invoiceNumber: invoice!.invoiceNumber,
            amountDueKobo: invoice.balanceDueKobo,
            dueDate: invoice!.dueDate,
            publicUrl: context.publicInvoiceUrl,
            to: [customer.email],
            cc: []
          },
          subject,
          htmlContent: renderReminderHtml(step.bodyTemplate, context),
          textContent: textBody
        },
        { idempotencyKey: `auto:${job.idempotencyKey}` }
      );
      if (result.outcome === "uncertain") {
        // Do NOT create a second send; preserve uncertain communication.
        await this.markOutcome(job, "needs_attention", "Reminder submission uncertain; kept for recovery.");
        return "needs_attention";
      }
      await this.markOutcome(job, "completed", null);
      return "completed";
    } catch (error) {
      if (error instanceof EmailUncertainError) {
        await this.markOutcome(job, "needs_attention", "Reminder submission uncertain; kept for recovery.");
        return "needs_attention";
      }
      const message = error instanceof Error ? error.message.slice(0, 500) : "Reminder failed.";
      await this.markOutcome(job, "failed", message);
      return "failed";
    }
  }

  private async markOccurrence(
    organisationId: string,
    scheduleId: string,
    scheduledFor: string,
    status: "pending" | "generated" | "failed" | "skipped",
    errorSummary: string | null,
    invoiceId?: string
  ): Promise<void> {
    await this.databaseService.db
      .insert(recurringInvoiceOccurrences)
      .values({ organisationId, scheduleId, scheduledFor, status, errorSummary, invoiceId: invoiceId ?? null, generatedAt: status === "generated" ? new Date() : null })
      .onConflictDoUpdate({
        target: [recurringInvoiceOccurrences.scheduleId, recurringInvoiceOccurrences.scheduledFor],
        set: { status, errorSummary, invoiceId: invoiceId ?? null, generatedAt: status === "generated" ? new Date() : null, updatedAt: new Date() }
      });
  }

  private async markOutcome(job: AutomationJob, status: "completed" | "skipped" | "failed" | "needs_attention", lastError: string | null): Promise<void> {
    const now = new Date();
    const attemptCount = job.attemptCount ?? 1;
    if (status === "completed" || status === "skipped") {
      await this.databaseService.db
        .update(automationJobs)
        .set({
          status,
          lastError: lastError?.slice(0, 500) ?? null,
          completedAt: status === "completed" ? now : null,
          skippedAt: status === "skipped" ? now : null,
          claimToken: null,
          claimedAt: null,
          updatedAt: now
        })
        .where(eq(automationJobs.id, job.id));
      return;
    }
    if (status === "needs_attention") {
      await this.databaseService.db
        .update(automationJobs)
        .set({ status: "needs_attention", lastError: lastError?.slice(0, 500) ?? null, claimToken: null, claimedAt: null, updatedAt: now })
        .where(eq(automationJobs.id, job.id));
      return;
    }
    if (attemptCount >= (job.maxAttempts ?? MAX_ATTEMPTS)) {
      await this.databaseService.db
        .update(automationJobs)
        .set({ status: "needs_attention", lastError: lastError?.slice(0, 500) ?? null, claimToken: null, claimedAt: null, updatedAt: now })
        .where(eq(automationJobs.id, job.id));
      return;
    }
    await this.databaseService.db
      .update(automationJobs)
      .set({
        status: "pending",
        lastError: lastError?.slice(0, 500) ?? null,
        nextAttemptAt: new Date(Date.now() + 15 * 60 * 1000 * attemptCount),
        claimToken: null,
        claimedAt: null,
        updatedAt: now
      })
      .where(eq(automationJobs.id, job.id));
  }
}










