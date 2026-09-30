import { randomBytes } from "crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, lte, sql } from "drizzle-orm";

import { businessDate } from "../../common/business-date";
import { nextInvoiceNumber } from "../../common/invoice-number";
import { transitionInvoiceInTransaction } from "../invoices/invoice-transition";
import { calculateInvoiceTotals } from "../../common/invoice-totals";
import { nextRecurrenceDate } from "../../common/recurrence";
import { DatabaseService, type AppDatabase } from "../../database/database.service";
import {
  automationJobs,
  auditLogs,
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
import { CommunicationsService } from "../communications/communications.service";
import { EmailUncertainError } from "../communications/email-provider";
import {
  formatKoboToNairaText,
  renderReminderHtml,
  renderReminderTemplate
} from "./reminder-template";

const CLAIM_BATCH_SIZE = 25;
const CLAIM_LEASE_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const MAX_BATCHES_PER_RUN = 8;
const RUN_BUDGET_MS = 60_000;
type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

function reactivatedJobValues() {
  return {
    status: "pending",
    attemptCount: 0,
    claimToken: null,
    claimedAt: null,
    nextAttemptAt: null,
    lastError: null,
    completedAt: null,
    skippedAt: null,
    updatedAt: new Date()
  };
}

export type AutomationSummary = {
  date: string;
  claimed: number;
  completed: number;
  skipped: number;
  needsAttention: number;
  failed: number;
  pendingDue: number;
  needsAttentionBacklog: number;
  budgetExhausted: boolean;
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
    @Inject(CommunicationsService) private readonly communicationsService: CommunicationsService
  ) {}

  async run(asOfDate?: string): Promise<AutomationSummary> {
    const deadline = Date.now() + RUN_BUDGET_MS;
    const date = asOfDate ?? businessDate();
    const materializationDeadline = deadline - RUN_BUDGET_MS / 2;
    await this.materializeRecurringJobs(date, materializationDeadline);
    await this.materializeScheduledSendJobs(date, materializationDeadline);
    await this.materializeReminderJobs(date, materializationDeadline);
    const materializationBudgetExhausted = Date.now() >= materializationDeadline;
    await this.reclaimStaleJobs();
    let claimedCount = 0;
    let completed = 0;
    let skipped = 0;
    let needsAttention = 0;
    let failed = 0;
    let batchCount = 0;
    while (batchCount < MAX_BATCHES_PER_RUN && Date.now() < deadline) {
      const claimed = await this.claimBatch(date);
      if (claimed.length === 0) break;
      batchCount += 1;
      claimedCount += claimed.length;
      for (const job of claimed) {
        if (Date.now() >= deadline) {
          await this.databaseService.db
            .update(automationJobs)
            .set({ status: "pending", claimToken: null, claimedAt: null, updatedAt: new Date() })
            .where(
              and(
                eq(automationJobs.id, job.id),
                eq(automationJobs.status, "running"),
                eq(automationJobs.claimToken, job.claimToken!)
              )
            );
          continue;
        }
        try {
          const outcome = await this.processJob(job, date);
          if (outcome === "completed") completed += 1;
          else if (outcome === "skipped") skipped += 1;
          else if (outcome === "needs_attention") needsAttention += 1;
          else failed += 1;
        } catch (error) {
          this.logger.warn(`Automation job ${job.id} failed: ${String(error)}`);
          if (
            await this.markOutcome(
              job,
              "failed",
              error instanceof Error ? error.message.slice(0, 500) : "Job failed."
            )
          )
            failed += 1;
        }
      }
    }
    const pendingDue = await this.countPendingDue(date);
    const [attentionRow] = await this.databaseService.db
      .select({ count: sql<number>`count(*)::int` })
      .from(automationJobs)
      .where(eq(automationJobs.status, "needs_attention"));
    const needsAttentionBacklog = attentionRow?.count ?? 0;
    const budgetExhausted =
      materializationBudgetExhausted ||
      (pendingDue > 0 && (batchCount >= MAX_BATCHES_PER_RUN || Date.now() >= deadline));
    if (pendingDue > 0 || needsAttentionBacklog > 0)
      this.logger.warn(
        `Automation backlog: ${pendingDue} due pending, ${needsAttentionBacklog} need attention.`
      );
    return {
      date,
      claimed: claimedCount,
      completed,
      skipped,
      needsAttention,
      failed,
      pendingDue,
      needsAttentionBacklog,
      budgetExhausted
    };
  }

  private async countPendingDue(date: string): Promise<number> {
    const [row] = await this.databaseService.db
      .select({ count: sql<number>`count(*)::int` })
      .from(automationJobs)
      .where(
        and(
          eq(automationJobs.status, "pending"),
          lte(automationJobs.scheduledFor, date),
          sql`(${automationJobs.nextAttemptAt} is null or ${automationJobs.nextAttemptAt} <= now())`
        )
      );
    return row?.count ?? 0;
  }

  private async materializeRecurringJobs(
    date: string,
    deadline = Number.POSITIVE_INFINITY
  ): Promise<void> {
    if (Date.now() >= deadline) return;
    const due = await this.databaseService.db
      .select()
      .from(recurringInvoiceSchedules)
      .where(
        and(
          eq(recurringInvoiceSchedules.status, "active"),
          lte(recurringInvoiceSchedules.nextIssueDate, date)
        )
      );
    for (const schedule of due) {
      if (Date.now() >= deadline) return;
      await this.databaseService.db.transaction(async (tx) => {
        const key = `recurring:${schedule.id}:${schedule.nextIssueDate}`;
        await tx
          .select({ id: automationJobs.id })
          .from(automationJobs)
          .where(eq(automationJobs.idempotencyKey, key))
          .for("update");
        const [current] = await tx
          .select()
          .from(recurringInvoiceSchedules)
          .where(eq(recurringInvoiceSchedules.id, schedule.id))
          .for("update");
        if (
          !current ||
          current.status !== "active" ||
          current.nextIssueDate !== schedule.nextIssueDate
        )
          return;
        if (current.endDate && current.nextIssueDate > current.endDate) {
          await tx
            .update(recurringInvoiceSchedules)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(recurringInvoiceSchedules.id, current.id));
          return;
        }
        await tx
          .insert(recurringInvoiceOccurrences)
          .values({
            organisationId: schedule.organisationId,
            scheduleId: schedule.id,
            scheduledFor: schedule.nextIssueDate,
            status: "pending"
          })
          .onConflictDoNothing();
        await tx
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
          .onConflictDoUpdate({
            target: automationJobs.idempotencyKey,
            set: reactivatedJobValues(),
            setWhere: eq(automationJobs.status, "cancelled")
          });
      });
    }
  }

  private async materializeScheduledSendJobs(
    date: string,
    deadline = Number.POSITIVE_INFINITY
  ): Promise<void> {
    if (Date.now() >= deadline) return;
    const rows = await this.databaseService.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.status, "draft"), lte(invoices.scheduledSendDate, date)));
    for (const invoice of rows) {
      if (Date.now() >= deadline) return;
      const scheduledSendDate = invoice.scheduledSendDate;
      if (!scheduledSendDate) continue;
      await this.databaseService.db.transaction(async (tx) => {
        const key = `scheduled:${invoice.id}:${scheduledSendDate}`;
        await tx
          .select({ id: automationJobs.id })
          .from(automationJobs)
          .where(eq(automationJobs.idempotencyKey, key))
          .for("update");
        const [current] = await tx
          .select()
          .from(invoices)
          .where(eq(invoices.id, invoice.id))
          .for("update");
        if (
          !current ||
          current.status !== "draft" ||
          current.scheduledSendDate !== scheduledSendDate
        )
          return;
        await tx
          .insert(automationJobs)
          .values({
            organisationId: invoice.organisationId,
            kind: "invoice_scheduled_send",
            resourceType: "invoice",
            resourceId: invoice!.id,
            scheduledFor: scheduledSendDate,
            idempotencyKey: `scheduled:${invoice!.id}:${scheduledSendDate}`,
            status: "pending",
            maxAttempts: MAX_ATTEMPTS,
            payloadRedacted: { invoiceId: invoice!.id }
          })
          .onConflictDoUpdate({
            target: automationJobs.idempotencyKey,
            set: reactivatedJobValues(),
            setWhere: eq(automationJobs.status, "cancelled")
          });
      });
    }
  }

  private async materializeReminderJobs(
    date: string,
    deadline = Number.POSITIVE_INFINITY
  ): Promise<void> {
    if (Date.now() >= deadline) return;
    const enabledOrgs = await this.databaseService.db
      .select()
      .from(organisationReminderSettings)
      .where(eq(organisationReminderSettings.enabled, true));
    if (enabledOrgs.length === 0) return;
    const enabledOrgIds = new Set(enabledOrgs.map((r) => r.organisationId));
    // Candidate invoices: issued-ish, unpaid, opted in. Balance is authoritative at send time.
    const candidateStatuses = ["sent", "viewed", "overdue", "partially_paid"];
    for (const orgId of enabledOrgIds) {
      if (Date.now() >= deadline) return;
      const steps = await this.databaseService.db
        .select()
        .from(reminderSteps)
        .where(and(eq(reminderSteps.organisationId, orgId), eq(reminderSteps.enabled, true)));
      if (steps.length === 0) continue;
      const candidateInvoices = await this.databaseService.db
        .select()
        .from(invoices)
        .where(
          and(eq(invoices.organisationId, orgId), eq(invoices.automaticRemindersEnabled, true))
        );
      const existingJobs = await this.databaseService.db
        .select({ key: automationJobs.idempotencyKey, status: automationJobs.status })
        .from(automationJobs)
        .where(
          and(
            eq(automationJobs.organisationId, orgId),
            eq(automationJobs.kind, "invoice_reminder_send")
          )
        );
      const existingJobStatus = new Map(existingJobs.map((job) => [job.key, job.status]));
      for (const invoice of candidateInvoices) {
        if (Date.now() >= deadline) return;
        if (!candidateStatuses.includes(invoice.status)) continue;
        if ((invoice.balanceDueKobo ?? 0) <= 0) continue;
        if (!invoice.publicAccessEnabled) continue;
        const daysOverdue = diffDays(invoice!.dueDate, date);
        // Applicable steps: scheduled date (dueDate + relativeDays) <= today
        const applicable = steps.filter(
          (s) => diffDays(addDaysISO(invoice!.dueDate, s.relativeDays), date) >= 0
        );
        if (applicable.length === 0) continue;
        // Skip stale pre-due: if invoice now due/overdue, drop before-due steps
        const timely =
          daysOverdue >= 0 ? applicable.filter((s) => s.relativeDays >= 0) : applicable;
        if (timely.length === 0) {
          continue;
        }
        // Latest applicable only; older missed become skipped/superseded implicitly
        const latest = timely.sort((a, b) => b.relativeDays - a.relativeDays)[0]!;
        const key = `reminder:${invoice!.id}:${latest.relativeDays}:${invoice!.dueDate}`;
        const existingStatus = existingJobStatus.get(key);
        if (existingStatus && existingStatus !== "cancelled") continue;
        const [customer] = await this.databaseService.db
          .select()
          .from(customers)
          .where(and(eq(customers.id, invoice.customerId), eq(customers.organisationId, orgId)))
          .limit(1);
        if (!customer || customer.archivedAt || !customer.automaticRemindersEnabled) continue;
        await this.databaseService.db.transaction(async (tx) => {
          await tx
            .select({ id: automationJobs.id })
            .from(automationJobs)
            .where(eq(automationJobs.idempotencyKey, key))
            .for("update");
          const [currentSettings] = await tx
            .select()
            .from(organisationReminderSettings)
            .where(eq(organisationReminderSettings.organisationId, orgId))
            .for("update");
          const [currentInvoice] = await tx
            .select()
            .from(invoices)
            .where(eq(invoices.id, invoice.id))
            .for("update");
          const [currentCustomer] = await tx
            .select()
            .from(customers)
            .where(eq(customers.id, invoice.customerId))
            .for("no key update");
          const [currentStep] = await tx
            .select()
            .from(reminderSteps)
            .where(eq(reminderSteps.id, latest.id))
            .for("update");
          if (
            !currentSettings?.enabled ||
            !currentInvoice?.automaticRemindersEnabled ||
            !currentInvoice.publicAccessEnabled ||
            currentInvoice.balanceDueKobo <= 0 ||
            !candidateStatuses.includes(currentInvoice.status) ||
            currentInvoice.dueDate !== invoice.dueDate ||
            !currentCustomer ||
            currentCustomer.archivedAt ||
            !currentCustomer.automaticRemindersEnabled ||
            !currentStep?.enabled ||
            currentStep.relativeDays !== latest.relativeDays
          )
            return;
          await tx
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
              payloadRedacted: {
                invoiceId: invoice!.id,
                relativeDays: latest.relativeDays,
                stepId: latest.id
              }
            })
            .onConflictDoUpdate({
              target: automationJobs.idempotencyKey,
              set: {
                ...reactivatedJobValues(),
                scheduledFor: date,
                payloadRedacted: {
                  invoiceId: invoice.id,
                  relativeDays: latest.relativeDays,
                  stepId: latest.id
                }
              },
              setWhere: eq(automationJobs.status, "cancelled")
            });
        });
      }
    }
  }

  private async reclaimStaleJobs(): Promise<void> {
    const cutoff = new Date(Date.now() - CLAIM_LEASE_MS);
    await this.databaseService.db.execute(
      sql`update automation_jobs set status = 'pending', claim_token = null, claimed_at = null, updated_at = now() where status = 'running' and claimed_at < ${cutoff.toISOString()}`
    );
    // A provider call may have succeeded before a worker died. Never retry it automatically.
    await this.databaseService.db.execute(
      sql`update automation_jobs set status = 'needs_attention', claim_token = null, claimed_at = null,
        last_error = 'Send reservation expired; verify provider delivery before retrying.', updated_at = now()
        where status = 'sending' and claimed_at < ${cutoff.toISOString()}`
    );
  }

  private async claimBatch(date: string): Promise<AutomationJob[]> {
    // Claim first, commit claim, perform side effect later in a new txn.
    // Raw SQL returns snake_case columns; map back to camelCase Drizzle shape.
    const result = await this.databaseService.db.execute(
      sql`update automation_jobs set status = 'running', claim_token = gen_random_uuid()::text, claimed_at = now(), attempt_count = attempt_count + 1, updated_at = now() where id in (select id from automation_jobs where status = 'pending' and scheduled_for <= ${date} and (next_attempt_at is null or next_attempt_at <= now()) order by scheduled_for asc limit ${CLAIM_BATCH_SIZE} for update skip locked) returning *`
    );
    const rows = ((result as unknown as { rows: Record<string, unknown>[] }).rows ?? []) as Record<
      string,
      unknown
    >[];
    return rows.map((r) => ({
      id: r.id,
      organisationId: r.organisation_id,
      kind: r.kind,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      scheduledFor:
        typeof r.scheduled_for === "string"
          ? r.scheduled_for
          : new Date(r.scheduled_for as string).toISOString().slice(0, 10),
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

  private async processJob(
    job: AutomationJob,
    _date: string
  ): Promise<"completed" | "skipped" | "failed" | "needs_attention"> {
    if (job.kind === "recurring_invoice_generate") return this.processRecurringGenerate(job);
    if (job.kind === "invoice_scheduled_send") return this.processScheduledSend(job);
    if (job.kind === "invoice_reminder_send") return this.processReminder(job);
    await this.markOutcome(job, "skipped", "Unknown job kind.");
    return "skipped";
  }

  private async processRecurringGenerate(
    job: AutomationJob
  ): Promise<"completed" | "skipped" | "failed" | "needs_attention"> {
    const [schedule] = await this.databaseService.db
      .select()
      .from(recurringInvoiceSchedules)
      .where(eq(recurringInvoiceSchedules.id, job.resourceId))
      .limit(1);
    if (!schedule || schedule.organisationId !== job.organisationId) {
      await this.markOutcome(job, "skipped", "Schedule is no longer available.");
      return "skipped";
    }
    // A worker can crash after generation commits but before delivery or outcome update.
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
      if (schedule.autoSend && (schedule.status === "active" || schedule.status === "completed")) {
        const [existingInvoice] = await this.databaseService.db
          .select()
          .from(invoices)
          .where(eq(invoices.id, existingOccurrence.invoiceId))
          .limit(1);
        if (
          existingInvoice &&
          (existingInvoice.status === "draft" || existingInvoice.status === "sent")
        ) {
          return this.autoSendGeneratedInvoice(schedule, existingInvoice, job);
        }
      }
      await this.markOutcome(job, "completed", null);
      return "completed";
    }
    if (schedule.status !== "active") {
      await this.markOutcome(job, "skipped", `Schedule is ${schedule.status}.`);
      return "skipped";
    }
    if (schedule.nextIssueDate !== job.scheduledFor) {
      await this.markOutcome(job, "skipped", "Schedule advanced past this occurrence.");
      return "skipped";
    }
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, schedule.customerId),
          eq(customers.organisationId, schedule.organisationId)
        )
      )
      .limit(1);
    if (!customer || customer.archivedAt) {
      await this.markOutcome(job, "needs_attention", "Customer is archived or missing.");
      return "needs_attention";
    }
    try {
      const result = await this.databaseService.db.transaction(async (tx) => {
        // Lock the claim and schedule until the invoice, occurrence, and next date commit together.
        const [owned] = await tx
          .select({ id: automationJobs.id })
          .from(automationJobs)
          .where(
            and(
              eq(automationJobs.id, job.id),
              eq(automationJobs.claimToken, job.claimToken!),
              eq(automationJobs.status, "running")
            )
          )
          .for("update");
        if (!owned) return { kind: "stale" as const };
        const [current] = await tx
          .select()
          .from(recurringInvoiceSchedules)
          .where(eq(recurringInvoiceSchedules.id, schedule.id))
          .for("update");
        if (!current || current.status !== "active" || current.nextIssueDate !== job.scheduledFor)
          return { kind: "stale" as const };
        const [currentCustomer] = await tx
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.id, current.customerId),
              eq(customers.organisationId, current.organisationId)
            )
          )
          .for("no key update");
        if (!currentCustomer || currentCustomer.archivedAt) return { kind: "customer" as const };
        const lineItems = await tx
          .select()
          .from(recurringInvoiceScheduleLineItems)
          .where(eq(recurringInvoiceScheduleLineItems.scheduleId, current.id));
        if (lineItems.length === 0) return { kind: "empty" as const };
        await tx
          .insert(recurringInvoiceOccurrences)
          .values({
            organisationId: job.organisationId,
            scheduleId: schedule.id,
            scheduledFor: job.scheduledFor,
            status: "pending"
          })
          .onConflictDoNothing();
        const [occurrence] = await tx
          .select()
          .from(recurringInvoiceOccurrences)
          .where(
            and(
              eq(recurringInvoiceOccurrences.scheduleId, schedule.id),
              eq(recurringInvoiceOccurrences.scheduledFor, job.scheduledFor)
            )
          )
          .for("update");
        if (occurrence?.invoiceId)
          return { kind: "existing" as const, invoiceId: occurrence.invoiceId };
        const invoice = await this.createInvoiceFromSchedule(
          tx,
          current,
          lineItems,
          job.scheduledFor,
          currentCustomer.id
        );
        await tx
          .update(recurringInvoiceOccurrences)
          .set({
            status: "generated",
            invoiceId: invoice.id,
            generatedAt: new Date(),
            errorSummary: null,
            updatedAt: new Date()
          })
          .where(eq(recurringInvoiceOccurrences.id, occurrence!.id));
        const nextDate = nextRecurrenceDate({
          frequency: current.frequency as "weekly" | "monthly" | "quarterly" | "yearly",
          previousScheduledFor: job.scheduledFor,
          anchorDay: current.anchorDay,
          anchorMonth: current.anchorMonth
        });
        await tx
          .update(recurringInvoiceSchedules)
          .set(
            current.endDate && nextDate > current.endDate
              ? {
                  status: "completed",
                  lastGeneratedAt: new Date(),
                  lastInvoiceId: invoice.id,
                  updatedAt: new Date()
                }
              : {
                  nextIssueDate: nextDate,
                  lastGeneratedAt: new Date(),
                  lastInvoiceId: invoice.id,
                  lastError: null,
                  updatedAt: new Date()
                }
          )
          .where(eq(recurringInvoiceSchedules.id, current.id));
        await tx.insert(auditLogs).values({
          organisationId: current.organisationId,
          actorUserId: null,
          action: "recurring_invoice_generated",
          entityType: "invoice",
          entityId: invoice.id,
          metadataRedacted: { scheduleId: current.id, scheduledFor: job.scheduledFor }
        });
        return { kind: "created" as const, invoice, schedule: current };
      });
      if (result.kind === "stale") {
        await this.markOutcome(job, "skipped", "Claim or schedule changed before generation.");
        return "skipped";
      }
      if (result.kind === "customer") {
        await this.markOutcome(job, "needs_attention", "Customer is archived or missing.");
        return "needs_attention";
      }
      if (result.kind === "empty") {
        await this.markOutcome(job, "needs_attention", "Schedule has no line items.");
        return "needs_attention";
      }
      if (result.kind === "existing") {
        if (schedule.autoSend) {
          const [existingInvoice] = await this.databaseService.db
            .select()
            .from(invoices)
            .where(eq(invoices.id, result.invoiceId))
            .limit(1);
          if (
            existingInvoice &&
            (existingInvoice.status === "draft" || existingInvoice.status === "sent")
          ) {
            return this.autoSendGeneratedInvoice(schedule, existingInvoice, job);
          }
        }
        await this.markOutcome(job, "completed", null);
        return "completed";
      }
      const invoice = result.invoice;
      if (result.schedule.autoSend) {
        return this.autoSendGeneratedInvoice(result.schedule, invoice, job);
      }
      await this.markOutcome(job, "completed", null);
      return "completed";
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Generation failed.";
      await this.markOutcome(job, "failed", message);
      return "failed";
    }
  }

  private async createInvoiceFromSchedule(
    db: Transaction,
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
    const totals = calculateInvoiceTotals({
      lineItems: items,
      discountKobo: schedule.discountKobo,
      taxKobo: schedule.taxKobo
    });
    const lineTotals = totals.lineTotalsKobo;
    const subtotal = totals.subtotalKobo;
    const total = totals.totalKobo;
    const invoiceNumber = await nextInvoiceNumber(db, schedule.organisationId);
    const publicToken = randomBytes(32).toString("hex");
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

  private async autoSendGeneratedInvoice(
    schedule: typeof recurringInvoiceSchedules.$inferSelect,
    invoice: typeof invoices.$inferSelect,
    job: AutomationJob
  ): Promise<"completed" | "needs_attention" | "failed" | "skipped"> {
    // Issue first (CAS draft->sent), then email through T021 infra.
    const alreadySent = invoice.status === "sent";
    const issued = alreadySent
      ? [invoice]
      : await this.databaseService.db.transaction(async (tx) => {
          const [owned] = await tx
            .select({ id: automationJobs.id })
            .from(automationJobs)
            .where(
              and(
                eq(automationJobs.id, job.id),
                eq(automationJobs.claimToken, job.claimToken!),
                eq(automationJobs.status, "running")
              )
            )
            .for("update");
          if (!owned) return [];
          const [currentSchedule] = await tx
            .select()
            .from(recurringInvoiceSchedules)
            .where(eq(recurringInvoiceSchedules.id, schedule.id))
            .for("update");
          if (
            !currentSchedule ||
            !["active", "completed"].includes(currentSchedule.status) ||
            !currentSchedule.autoSend
          )
            return [];
          const [currentCustomer] = await tx
            .select({ archivedAt: customers.archivedAt })
            .from(customers)
            .where(eq(customers.id, currentSchedule.customerId))
            .for("no key update");
          if (!currentCustomer || currentCustomer.archivedAt) return [];
          const now = new Date();
          const updated = await transitionInvoiceInTransaction(tx, invoice, {
            actorUserId: null,
            action: "invoice_sent",
            reason: "recurring_auto_send",
            metadata: { source: "recurring_auto_send", invoiceNumber: invoice.invoiceNumber },
            patch: { status: "sent", publicAccessEnabled: true, sentAt: now, updatedAt: now },
            toStatus: "sent",
            expectedFromStatuses: ["draft"]
          });
          const rows = updated ? [updated] : [];
          if (updated) {
            await tx
              .update(automationJobs)
              .set({ status: "sending", claimedAt: now, updatedAt: now })
              .where(eq(automationJobs.id, job.id));
          }
          return rows;
        });
    if (issued.length === 0) {
      await this.markOutcome(job, "skipped", "Generated invoice was changed before auto-send.");
      return "skipped";
    }
    const frontendUrl = (
      this.configService.get<string>("FRONTEND_APP_URL") ?? "http://localhost:3000"
    ).replace(/\/$/, "");
    const [profile] = await this.databaseService.db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.organisationId, schedule.organisationId))
      .limit(1);
    try {
      if (alreadySent && !(await this.reserveSend(job, schedule.id, invoice.id))) {
        await this.markOutcome(job, "skipped", "Claim or schedule changed before delivery.");
        return "skipped";
      }
      // A schedule edit after reservation reports a conflict, so this snapshot stays valid through delivery.
      const [deliverySchedule] = await this.databaseService.db
        .select()
        .from(recurringInvoiceSchedules)
        .where(eq(recurringInvoiceSchedules.id, schedule.id))
        .limit(1);
      if (!deliverySchedule) return "skipped";
      const [deliveryCustomer] = await this.databaseService.db
        .select()
        .from(customers)
        .where(eq(customers.id, deliverySchedule.customerId))
        .limit(1);
      if (!deliveryCustomer) return "skipped";
      const result = await this.communicationsService.sendInvoiceEmail(
        {
          organisationId: deliverySchedule.organisationId,
          userId: deliverySchedule.createdByUserId,
          invoice: { id: invoice!.id, invoiceNumber: invoice!.invoiceNumber },
          customerId: deliverySchedule.customerId,
          content: {
            customerEmail: deliveryCustomer.email,
            customerName: deliveryCustomer.name,
            businessName: profile?.businessName ?? "Your business",
            businessEmail: profile?.email,
            invoiceNumber: invoice!.invoiceNumber,
            amountDueKobo: invoice!.totalKobo,
            dueDate: invoice!.dueDate,
            publicUrl: `${frontendUrl}/invoice/${invoice!.publicToken}`,
            to: deliverySchedule.toRecipients,
            cc: deliverySchedule.ccRecipients ?? [],
            subject: deliverySchedule.emailSubject ?? undefined
          }
        },
        { idempotencyKey: `auto:${job.idempotencyKey}`, purpose: "invoice_delivery" }
      );
      if (result.outcome === "uncertain") {
        await this.markOutcome(
          job,
          "needs_attention",
          "Email submission uncertain; kept for recovery."
        );
        return "needs_attention";
      }
      await this.markOutcome(job, "completed", null);
      return "completed";
    } catch (error) {
      if (error instanceof EmailUncertainError) {
        await this.markOutcome(
          job,
          "needs_attention",
          "Email submission uncertain; kept for recovery."
        );
        return "needs_attention";
      }
      const message = error instanceof Error ? error.message.slice(0, 500) : "Auto-send failed.";
      // Partial success: invoice is issued; never fake delivered.
      await this.databaseService.db.transaction(async (tx) => {
        const [owned] = await tx
          .select({ id: automationJobs.id })
          .from(automationJobs)
          .where(
            and(
              eq(automationJobs.id, job.id),
              eq(automationJobs.claimToken, job.claimToken!),
              sql`${automationJobs.status} in ('running', 'sending')`
            )
          )
          .for("update");
        if (owned)
          await tx
            .update(recurringInvoiceSchedules)
            .set({ lastError: message, updatedAt: new Date() })
            .where(eq(recurringInvoiceSchedules.id, schedule.id));
      });
      await this.markOutcome(job, "needs_attention", message);
      return "needs_attention";
    }
  }

  private async processScheduledSend(
    job: AutomationJob
  ): Promise<"completed" | "skipped" | "failed" | "needs_attention"> {
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
    const issued = await this.databaseService.db.transaction(async (tx) => {
      const [owned] = await tx
        .select({ id: automationJobs.id })
        .from(automationJobs)
        .where(
          and(
            eq(automationJobs.id, job.id),
            eq(automationJobs.claimToken, job.claimToken!),
            eq(automationJobs.status, "running")
          )
        )
        .for("update");
      if (!owned) return [];
      const now = new Date();
      const updated = await transitionInvoiceInTransaction(tx, invoice, {
        actorUserId: null,
        action: "invoice_sent",
        reason: "scheduled_send",
        metadata: { source: "scheduled_send", invoiceNumber: invoice.invoiceNumber },
        patch: {
          status: "sent",
          publicAccessEnabled: true,
          sentAt: now,
          scheduledSendDate: null,
          scheduledSendTo: null,
          scheduledSendCc: null,
          scheduledSendSubject: null,
          updatedAt: now
        },
        toStatus: "sent",
        expectedFromStatuses: ["draft"],
        condition: eq(invoices.scheduledSendDate, job.scheduledFor)
      });
      if (updated) {
        await tx
          .update(automationJobs)
          .set({ status: "sending", claimedAt: now, updatedAt: now })
          .where(eq(automationJobs.id, job.id));
      }
      return updated ? [updated] : [];
    });
    if (issued.length === 0) {
      await this.markOutcome(job, "skipped", "Invoice was sent or changed concurrently.");
      return "skipped";
    }
    const frontendUrl = (
      this.configService.get<string>("FRONTEND_APP_URL") ?? "http://localhost:3000"
    ).replace(/\/$/, "");
    const [profile] = await this.databaseService.db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.organisationId, invoice.organisationId))
      .limit(1);
    try {
      const result = await this.communicationsService.sendInvoiceEmail(
        {
          organisationId: invoice.organisationId,
          userId: invoice.createdByUserId,
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
        await this.markOutcome(
          job,
          "needs_attention",
          "Email submission uncertain; kept for recovery."
        );
        return "needs_attention";
      }
      await this.markOutcome(job, "completed", null);
      return "completed";
    } catch (error) {
      if (error instanceof EmailUncertainError) {
        await this.markOutcome(
          job,
          "needs_attention",
          "Email submission uncertain; kept for recovery."
        );
        return "needs_attention";
      }
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "Scheduled send failed.";
      await this.markOutcome(job, "needs_attention", message);
      return "needs_attention";
    }
  }

  private async processReminder(
    job: AutomationJob
  ): Promise<"completed" | "skipped" | "failed" | "needs_attention"> {
    const payload = (job.payloadRedacted ?? {}) as {
      relativeDays?: number;
      stepId?: string;
      invoiceId?: string;
    };
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
          .where(
            and(
              eq(reminderSteps.id, payload.stepId),
              eq(reminderSteps.organisationId, job.organisationId)
            )
          )
          .limit(1)
      : [];
    if (!step || !step.enabled) {
      await this.markOutcome(job, "skipped", "Reminder step is disabled or removed.");
      return "skipped";
    }
    const frontendUrl = (
      this.configService.get<string>("FRONTEND_APP_URL") ?? "http://localhost:3000"
    ).replace(/\/$/, "");
    const [profile] = await this.databaseService.db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.organisationId, job.organisationId))
      .limit(1);
    let context = {
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
      await this.markOutcome(
        job,
        "failed",
        error instanceof Error ? error.message.slice(0, 500) : "Template invalid."
      );
      return "failed";
    }
    try {
      const reserved = await this.databaseService.db.transaction(async (tx) => {
        const [owned] = await tx
          .select({ id: automationJobs.id })
          .from(automationJobs)
          .where(
            and(
              eq(automationJobs.id, job.id),
              eq(automationJobs.status, "running"),
              eq(automationJobs.claimToken, job.claimToken!)
            )
          )
          .for("update");
        if (!owned) return null;
        const [latestSettings] = await tx
          .select()
          .from(organisationReminderSettings)
          .where(eq(organisationReminderSettings.organisationId, job.organisationId))
          .for("update");
        const [latestInvoice] = await tx
          .select()
          .from(invoices)
          .where(eq(invoices.id, invoice.id))
          .for("update");
        if (!latestInvoice) return null;
        const [latestCustomer] = await tx
          .select()
          .from(customers)
          .where(eq(customers.id, latestInvoice.customerId))
          .for("no key update");
        const [latestStep] = await tx
          .select()
          .from(reminderSteps)
          .where(eq(reminderSteps.id, step.id))
          .for("update");
        if (
          !latestSettings?.enabled ||
          !latestInvoice.automaticRemindersEnabled ||
          !latestInvoice.publicAccessEnabled ||
          (latestInvoice.balanceDueKobo ?? 0) <= 0 ||
          !["sent", "viewed", "overdue", "partially_paid"].includes(latestInvoice.status) ||
          !latestCustomer ||
          latestCustomer.archivedAt ||
          !latestCustomer.automaticRemindersEnabled ||
          !latestStep?.enabled
        )
          return null;
        await tx
          .update(automationJobs)
          .set({ status: "sending", claimedAt: new Date(), updatedAt: new Date() })
          .where(eq(automationJobs.id, job.id));
        return { invoice: latestInvoice, customer: latestCustomer, step: latestStep };
      });
      if (!reserved) {
        await this.markOutcome(job, "skipped", "Reminder eligibility changed before send.");
        return "skipped";
      }
      context = {
        ...context,
        customerName: reserved.customer.name,
        invoiceNumber: reserved.invoice.invoiceNumber,
        amountDue: formatKoboToNairaText(reserved.invoice.balanceDueKobo),
        dueDate: reserved.invoice.dueDate,
        publicInvoiceUrl: `${frontendUrl}/invoice/${reserved.invoice.publicToken}`
      };
      subject = renderReminderTemplate(reserved.step.subjectTemplate, context);
      textBody = renderReminderTemplate(reserved.step.bodyTemplate, context);
      const result = await this.communicationsService.sendPaymentReminderEmail(
        {
          organisationId: job.organisationId,
          userId: reserved.invoice.createdByUserId,
          invoice: { id: reserved.invoice.id, invoiceNumber: reserved.invoice.invoiceNumber },
          customerId: reserved.invoice.customerId,
          content: {
            customerEmail: reserved.customer.email,
            customerName: reserved.customer.name,
            businessName: context.businessName,
            businessEmail: profile?.email,
            invoiceNumber: reserved.invoice.invoiceNumber,
            amountDueKobo: reserved.invoice.balanceDueKobo,
            dueDate: reserved.invoice.dueDate,
            publicUrl: context.publicInvoiceUrl,
            to: [reserved.customer.email],
            cc: []
          },
          subject,
          htmlContent: renderReminderHtml(reserved.step.bodyTemplate, context),
          textContent: textBody
        },
        { idempotencyKey: `auto:${job.idempotencyKey}` }
      );
      if (result.outcome === "uncertain") {
        // Do NOT create a second send; preserve uncertain communication.
        await this.markOutcome(
          job,
          "needs_attention",
          "Reminder submission uncertain; kept for recovery."
        );
        return "needs_attention";
      }
      await this.markOutcome(job, "completed", null);
      return "completed";
    } catch (error) {
      if (error instanceof EmailUncertainError) {
        await this.markOutcome(
          job,
          "needs_attention",
          "Reminder submission uncertain; kept for recovery."
        );
        return "needs_attention";
      }
      const message = error instanceof Error ? error.message.slice(0, 500) : "Reminder failed.";
      await this.markOutcome(job, "needs_attention", message);
      return "needs_attention";
    }
  }

  private async markOutcome(
    job: AutomationJob,
    status: "completed" | "skipped" | "failed" | "needs_attention",
    lastError: string | null
  ): Promise<boolean> {
    const now = new Date();
    const attemptCount = job.attemptCount ?? 1;
    const nextStatus =
      status === "failed"
        ? attemptCount >= (job.maxAttempts ?? MAX_ATTEMPTS)
          ? "needs_attention"
          : "pending"
        : status;
    const updated = await this.databaseService.db
      .update(automationJobs)
      .set({
        status: nextStatus,
        lastError: lastError?.slice(0, 500) ?? null,
        nextAttemptAt:
          nextStatus === "pending" ? new Date(Date.now() + 15 * 60 * 1000 * attemptCount) : null,
        completedAt: nextStatus === "completed" ? now : null,
        skippedAt: nextStatus === "skipped" ? now : null,
        claimToken: null,
        claimedAt: null,
        updatedAt: now
      })
      .where(
        and(
          eq(automationJobs.id, job.id),
          sql`${automationJobs.status} in ('running', 'sending')`,
          eq(automationJobs.claimToken, job.claimToken!)
        )
      )
      .returning({ id: automationJobs.id });
    if (updated.length === 0)
      this.logger.warn(`Automation job ${job.id} lost its claim before outcome ${status}.`);
    return updated.length > 0;
  }

  private async reserveSend(
    job: AutomationJob,
    scheduleId: string,
    invoiceId: string
  ): Promise<boolean> {
    return this.databaseService.db.transaction(async (tx) => {
      const [owned] = await tx
        .select({ id: automationJobs.id })
        .from(automationJobs)
        .where(
          and(
            eq(automationJobs.id, job.id),
            eq(automationJobs.status, "running"),
            eq(automationJobs.claimToken, job.claimToken!)
          )
        )
        .for("update");
      if (!owned) return false;
      {
        const [schedule] = await tx
          .select()
          .from(recurringInvoiceSchedules)
          .where(eq(recurringInvoiceSchedules.id, scheduleId))
          .for("update");
        if (!schedule || !["active", "completed"].includes(schedule.status) || !schedule.autoSend)
          return false;
        const [currentInvoice] = await tx
          .select()
          .from(invoices)
          .where(and(eq(invoices.id, invoiceId), eq(invoices.organisationId, job.organisationId)))
          .for("update");
        if (
          !currentInvoice ||
          currentInvoice.status !== "sent" ||
          !currentInvoice.publicAccessEnabled
        )
          return false;
        const [customer] = await tx
          .select({ archivedAt: customers.archivedAt })
          .from(customers)
          .where(eq(customers.id, schedule.customerId))
          .for("no key update");
        if (!customer || customer.archivedAt) return false;
      }
      await tx
        .update(automationJobs)
        .set({ status: "sending", claimedAt: new Date(), updatedAt: new Date() })
        .where(eq(automationJobs.id, job.id));
      return true;
    });
  }
}
