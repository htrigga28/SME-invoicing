import { ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq, sql } from "drizzle-orm";
import { Client } from "pg";

import type { AppDatabase } from "../../database/database.service";
import {
  automationJobs, communicationRecipients, communications, customers,
  invoices, organisations, organisationReminderSettings, recurringInvoiceScheduleLineItems,
  recurringInvoiceSchedules, recurringInvoiceOccurrences, reminderSteps, users, type AutomationJob
} from "../../database/schema";
import { requiredRow, startApiTestPool, uniqueSlug, type ApiTestPool } from "../../test/postgres-test-helper";
import { CommunicationsService } from "../communications/communications.service";
import { EmailUncertainError, type SendEmailInput } from "../communications/email-provider";
import { InvoicesService } from "../invoices/invoices.service";
import { AutomationRunnerService } from "./automation-runner.service";
import { RecurringInvoicesService } from "./recurring-invoices.service";
import { ReminderSettingsService } from "./reminder-settings.service";

jest.setTimeout(180000);

let pool: ApiTestPool;
let db: AppDatabase;
const date = "2099-09-30";
const config = { get: (key: string) => key === "FRONTEND_APP_URL" ? "https://app.example.test" : undefined } as ConfigService;
const audit = { create: jest.fn().mockResolvedValue({}) };

beforeAll(async () => { pool = await startApiTestPool(); db = pool.db; });
beforeEach(async () => {
  await db.execute(sql`truncate organisations, users cascade`);
  jest.clearAllMocks();
});
afterAll(async () => { await pool?.stop(); });

async function fixture() {
  const slug = uniqueSlug("automation-persistence");
  const organisation = requiredRow(await db.insert(organisations).values({ name: "Northstar", slug }).returning(), "organisation");
  const user = requiredRow(await db.insert(users).values({ email: `${slug}@example.test`, passwordHash: "x", name: "Owner" }).returning(), "user");
  const customer = requiredRow(await db.insert(customers).values({ organisationId: organisation.id, name: "Customer", email: "accounts@example.test" }).returning(), "customer");
  return { organisation, user, customer, context: { activeOrganisation: organisation, user } as never };
}

async function scheduleFor(orgId: string, customerId: string, autoSend = false) {
  const schedule = requiredRow(await db.insert(recurringInvoiceSchedules).values({
    organisationId: orgId, customerId, name: "Retainer", status: "active", frequency: "monthly",
    startDate: date, nextIssueDate: date, anchorDay: 30, anchorMonth: 9, dueTermsDays: 14,
    autoSend, toRecipients: ["accounts@example.test"], ccRecipients: [], discountKobo: 0, taxKobo: 0
  }).returning(), "schedule");
  await db.insert(recurringInvoiceScheduleLineItems).values({
    organisationId: orgId, scheduleId: schedule.id, description: "Original item", quantity: "1", unitPriceKobo: 50000, sortOrder: 0
  });
  return schedule;
}

async function invoiceFor(orgId: string, customerId: string, scheduled = true) {
  return requiredRow(await db.insert(invoices).values({
    organisationId: orgId, customerId, invoiceNumber: "INV-000010", publicToken: uniqueSlug("public"),
    status: scheduled ? "draft" : "partially_paid", currency: "NGN", issueDate: "2099-09-01", dueDate: "2099-09-29",
    publicAccessEnabled: !scheduled, subtotalKobo: 50000, totalKobo: 50000,
    amountPaidKobo: scheduled ? 0 : 25000, balanceDueKobo: scheduled ? 50000 : 25000,
    scheduledSendDate: scheduled ? date : null, scheduledSendTo: scheduled ? ["accounts@example.test"] : null
  }).returning(), "invoice");
}

function runnerWith(communicationsService: unknown) {
  return new AutomationRunnerService(pool.databaseService(), config, communicationsService as never);
}

type RunnerInternals = {
  claimBatch(date: string): Promise<AutomationJob[]>;
  reclaimStaleJobs(): Promise<void>;
  processRecurringGenerate(job: AutomationJob): Promise<string>;
  processScheduledSend(job: AutomationJob): Promise<string>;
};

async function prepareDelivery(kind: "scheduled" | "recurring" | "reminder") {
  const seeded = await fixture();
  if (kind === "recurring") {
    await scheduleFor(seeded.organisation.id, seeded.customer.id, true);
  } else {
    await invoiceFor(seeded.organisation.id, seeded.customer.id, kind === "scheduled");
    if (kind === "reminder") {
      await db.insert(organisationReminderSettings).values({ organisationId: seeded.organisation.id, enabled: true });
      await db.insert(reminderSteps).values({
        organisationId: seeded.organisation.id, relativeDays: 1,
        subjectTemplate: "Balance {{amountDue}}", bodyTemplate: "Pay {{amountDue}} at {{publicInvoiceUrl}}", enabled: true
      });
    }
  }
  return seeded;
}

function realCommunications(uncertain: boolean) {
  const sendEmail = jest.fn(async (request: SendEmailInput) => {
    const stored = requiredRow(await db.select().from(communications).where(eq(communications.id, request.correlationId)), "communication before provider");
    expect(["pending", "submission_uncertain"]).toContain(stored.status);
    expect(stored.providerIdempotencyKey).toBe(request.idempotencyKey);
    expect(stored.providerIdempotencyKey.length).toBeLessThanOrEqual(36);
    expect(stored.createdByUserId).toBeNull();
    const { idempotencyKey: _key, ...snapshot } = request;
    expect(stored.providerRequestSnapshot).toEqual(snapshot);
    expect(await db.select().from(communicationRecipients).where(eq(communicationRecipients.communicationId, stored.id))).toHaveLength(1);
    if (uncertain) throw new EmailUncertainError("Injected provider timeout");
    return { providerMessageId: `provider-${request.correlationId}` };
  });
  const service = new CommunicationsService(pool.databaseService(), config, {
    isConfigured: () => true, getFromEmail: () => "billing@example.test", sendEmail
  } as never, audit as never);
  return { service, sendEmail };
}

describe("automation and real communications persistence", () => {
  it.each(["scheduled", "recurring", "reminder"] as const)("persists and sends %s once across repeated runner calls", async (kind) => {
    await prepareDelivery(kind);
    const { service, sendEmail } = realCommunications(false);
    const runner = runnerWith(service);
    const first = await runner.run(date);
    expect(first).toMatchObject({ completed: 1, failed: 0, needsAttention: 0 });
    await runner.run(date);
    await runner.run(date);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const rows = await db.select().from(communications);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "accepted", createdByUserId: null,
      purpose: kind === "reminder" ? "payment_reminder" : "invoice_delivery" });
    expect(rows[0]!.acceptedAt).not.toBeNull();
    if (kind === "reminder") expect(rows[0]!.subject).toBe("Balance ₦250.00");
  });

  it.each(["scheduled", "recurring", "reminder"] as const)("keeps an uncertain %s attempt without submitting again", async (kind) => {
    const seeded = await prepareDelivery(kind);
    const { service, sendEmail } = realCommunications(true);
    const runner = runnerWith(service);
    expect(await runner.run(date)).toMatchObject({ needsAttention: 1 });
    await runner.run(date);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const rows = await db.select().from(communications);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "submission_uncertain" });
    const retryInput = { organisationId: seeded.organisation.id, userId: seeded.user.id,
      invoice: { id: rows[0]!.invoiceId, invoiceNumber: "ignored for snapshot replay" }, communicationId: rows[0]!.id };
    await service.retryUncertainAttempt(retryInput);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[1]![0]).toEqual(sendEmail.mock.calls[0]![0]);
    expect(await db.select().from(communications)).toHaveLength(1);
    await db.update(communications).set({ idempotencyExpiresAt: new Date(Date.now() - 1000) }).where(eq(communications.id, rows[0]!.id));
    await expect(service.retryUncertainAttempt(retryInput)).rejects.toBeInstanceOf(ConflictException);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
});

describe("automation services and business mutation fences", () => {
  it.each(["cancelled", "void"] as const)("does not recover-send a cached sent recurring invoice after it becomes %s", async (status) => {
    const seeded = await fixture();
    const schedule = await scheduleFor(seeded.organisation.id, seeded.customer.id, true);
    const invoice = await invoiceFor(seeded.organisation.id, seeded.customer.id);
    const cached = requiredRow(await db.update(invoices).set({
      status: "sent", publicAccessEnabled: true, scheduledSendDate: null
    }).where(eq(invoices.id, invoice.id)).returning(), "cached sent invoice");
    await db.insert(recurringInvoiceOccurrences).values({
      organisationId: seeded.organisation.id, scheduleId: schedule.id, scheduledFor: date,
      status: "generated", invoiceId: invoice.id, generatedAt: new Date()
    });
    await db.insert(automationJobs).values({
      organisationId: seeded.organisation.id, kind: "recurring_invoice_generate", resourceType: "recurring_schedule",
      resourceId: schedule.id, scheduledFor: date, idempotencyKey: `recurring:${schedule.id}:${date}`
    });
    const { service, sendEmail } = realCommunications(false);
    const runner = runnerWith(service);
    const claimed = requiredRow(await (runner as unknown as RunnerInternals).claimBatch(date), "recovery claim");
    await db.update(invoices).set({ status, publicAccessEnabled: false }).where(eq(invoices.id, invoice.id));
    const recovery = runner as unknown as {
      autoSendGeneratedInvoice(scheduleInput: typeof schedule, invoiceInput: typeof cached, job: AutomationJob): Promise<string>
    };
    expect(await recovery.autoSendGeneratedInvoice(schedule, cached, claimed)).toBe("skipped");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await db.select().from(communications)).toHaveLength(0);
    expect(requiredRow(await db.select().from(invoices), "cancelled invoice")).toMatchObject({ status, publicAccessEnabled: false });
  });

  it("lets manual creation and recurring generation share the customer and invoice sequence without a deadlock", async () => {
    const seeded = await fixture();
    await scheduleFor(seeded.organisation.id, seeded.customer.id);
    const { service: communicationsService } = realCommunications(false);
    const payments = { getInvoiceFinancialSummary: jest.fn().mockResolvedValue({ balanceDueKobo: 50000, netReceivedKobo: 0 }) };
    const manual = new InvoicesService(pool.databaseService(), audit as never, config, {} as never, payments as never, communicationsService);
    const runner = runnerWith(communicationsService);
    const coordinator = new Client({ connectionString: pool.connectionString });
    await coordinator.connect();
    await coordinator.query("select pg_advisory_lock(29002)");
    await db.execute(sql.raw(`create function hold_manual_invoice() returns trigger language plpgsql as $$
      begin if NEW.created_by_user_id is not null then perform pg_advisory_xact_lock(29002); end if; return NEW; end $$`));
    await db.execute(sql.raw(`create trigger hold_manual_invoice_trigger before insert on invoices
      for each row execute function hold_manual_invoice()`));

    let manualHasSequence!: () => void;
    const manualReady = new Promise<void>((resolve) => { manualHasSequence = resolve; });
    const manualInternals = manual as unknown as { generatePublicToken(): string };
    const originalToken = manualInternals.generatePublicToken.bind(manual);
    const tokenSpy = jest.spyOn(manualInternals, "generatePublicToken").mockImplementation(() => {
      manualHasSequence();
      return originalToken();
    });
    let recurringHasCustomer!: () => void;
    const recurringReady = new Promise<void>((resolve) => { recurringHasCustomer = resolve; });
    const recurringInternals = runner as unknown as { createInvoiceFromSchedule(...args: unknown[]): Promise<unknown> };
    const originalGeneration = recurringInternals.createInvoiceFromSchedule.bind(runner);
    const generationSpy = jest.spyOn(recurringInternals, "createInvoiceFromSchedule").mockImplementation(async (...args) => {
      recurringHasCustomer();
      return originalGeneration(...args);
    });
    let manualWork: ReturnType<InvoicesService["createInvoice"]> | undefined;
    let recurringWork: ReturnType<AutomationRunnerService["run"]> | undefined;
    try {
      manualWork = manual.createInvoice(seeded.context, {
        customerId: seeded.customer.id, issueDate: date, dueDate: "2099-10-14",
        lineItems: [{ description: "Manual item", quantity: 1, unitPriceKobo: 50000 }]
      });
      await Promise.race([manualReady, manualWork.then(() => { throw new Error("Manual invoice completed before its sequence barrier."); })]);
      recurringWork = runner.run(date);
      await Promise.race([recurringReady, recurringWork.then(() => { throw new Error("Recurring generation did not reach the customer barrier."); })]);
      await coordinator.query("select pg_advisory_unlock(29002)");
      const [created, summary] = await Promise.all([manualWork, recurringWork]);
      expect(created.invoice.invoiceNumber).toBe("INV-000001");
      expect(summary).toMatchObject({ completed: 1, failed: 0, needsAttention: 0 });
      const rows = await db.select().from(invoices);
      expect(rows).toHaveLength(2);
      expect(rows.map((invoice) => invoice.invoiceNumber).sort()).toEqual(["INV-000001", "INV-000002"]);
    } finally {
      await coordinator.query("select pg_advisory_unlock(29002)");
      await Promise.allSettled([manualWork, recurringWork]);
      tokenSpy.mockRestore();
      generationSpy.mockRestore();
      await coordinator.end();
      await db.execute(sql.raw("drop trigger hold_manual_invoice_trigger on invoices"));
      await db.execute(sql.raw("drop function hold_manual_invoice()"));
    }
  });

  it("stops materialization at its clock cutoff and uses the remaining budget for pending jobs", async () => {
    const seeded = await fixture();
    await scheduleFor(seeded.organisation.id, seeded.customer.id);
    await scheduleFor(seeded.organisation.id, seeded.customer.id);
    await db.insert(automationJobs).values({
      organisationId: seeded.organisation.id, kind: "unknown", resourceType: "invoice",
      resourceId: seeded.organisation.id, scheduledFor: date, idempotencyKey: "already-pending"
    });
    const database = pool.databaseService();
    const runner = new AutomationRunnerService(database, config, {} as never);
    const start = Date.now();
    let currentTime = start;
    let transactionCount = 0;
    const originalTransaction = database.db.transaction.bind(database.db);
    type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];
    const transactionSpy = jest.spyOn(database.db, "transaction").mockImplementation(async <T>(
      callback: (tx: Transaction) => Promise<T>, transactionConfig?: Parameters<AppDatabase["transaction"]>[1]
    ): Promise<T> => {
      const result = await originalTransaction<T>(callback, transactionConfig);
      transactionCount += 1;
      if (transactionCount === 1) currentTime = start + 30_000;
      return result;
    });
    const clock = jest.spyOn(Date, "now").mockImplementation(() => currentTime);
    try {
      expect(await runner.run(date)).toMatchObject({
        claimed: 2, completed: 1, skipped: 1, failed: 0, pendingDue: 0, budgetExhausted: true
      });
      expect(await db.select().from(invoices)).toHaveLength(1);
      expect(await db.select().from(automationJobs)).toHaveLength(2);
    } finally {
      clock.mockRestore();
      transactionSpy.mockRestore();
    }
    expect(await runner.run(date)).toMatchObject({ completed: 1, pendingDue: 0, budgetExhausted: false });
    expect(await db.select().from(invoices)).toHaveLength(2);
  });

  it("refreshes the replaced reminder step when reactivating its cancelled logical job", async () => {
    const seeded = await prepareDelivery("reminder");
    const originalStep = requiredRow(await db.select().from(reminderSteps), "original reminder step");
    const { service, sendEmail } = realCommunications(false);
    const runner = runnerWith(service);
    await (runner as unknown as { materializeReminderJobs(date: string): Promise<void> })
      .materializeReminderJobs(date);
    const originalJob = requiredRow(await db.select().from(automationJobs), "pending reminder job");
    expect(originalJob).toMatchObject({
      status: "pending", payloadRedacted: { stepId: originalStep.id, relativeDays: 1 }
    });

    const settings = new ReminderSettingsService(pool.databaseService(), audit as never);
    await settings.putSettings(seeded.context, {
      enabled: true,
      steps: [{ relativeDays: 1, subjectTemplate: "Updated balance {{amountDue}}", bodyTemplate: "Pay {{amountDue}}" }]
    });
    const replacementStep = requiredRow(await db.select().from(reminderSteps), "replacement reminder step");
    expect(replacementStep.id).not.toBe(originalStep.id);
    expect(requiredRow(await db.select().from(automationJobs), "cancelled reminder job")).toMatchObject({
      id: originalJob.id, status: "cancelled"
    });

    expect(await runner.run(date)).toMatchObject({ completed: 1, failed: 0, needsAttention: 0 });
    const jobs = await db.select().from(automationJobs);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: originalJob.id, status: "completed", attemptCount: 1,
      payloadRedacted: { stepId: replacementStep.id, relativeDays: 1, invoiceId: originalJob.resourceId }
    });
    const attempts = await db.select().from(communications);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ status: "accepted", subject: "Updated balance ₦250.00" });
    await runner.run(date);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(await db.select().from(communications)).toHaveLength(1);
  });

  it("enables the suggested default reminder sequence for a fresh organisation", async () => {
    const seeded = await fixture();
    const service = new ReminderSettingsService(pool.databaseService(), audit as never);
    const initial = await service.getSettings(seeded.organisation.id);
    expect(initial.enabled).toBe(false);
    expect(initial.steps).toHaveLength(0);
    expect(initial.suggestedSteps.length).toBeGreaterThan(0);
    const enabled = await service.putSettings(seeded.context, { enabled: true });
    expect(enabled.enabled).toBe(true);
    expect(enabled.steps.map(({ relativeDays, subjectTemplate, bodyTemplate, enabled: stepEnabled }) => ({
      relativeDays, subjectTemplate, bodyTemplate, enabled: stepEnabled
    }))).toEqual(initial.suggestedSteps.map((step) => ({ ...step, enabled: true })));
  });

  it.each(["invoice opt-out", "customer opt-out", "paid invoice"])("does not persist or send reminders for %s", async (state) => {
    const seeded = await prepareDelivery("reminder");
    if (state === "customer opt-out") {
      await db.update(customers).set({ automaticRemindersEnabled: false }).where(eq(customers.id, seeded.customer.id));
    } else {
      await db.update(invoices).set(state === "invoice opt-out"
        ? { automaticRemindersEnabled: false }
        : { status: "paid", amountPaidKobo: 50000, balanceDueKobo: 0 });
    }
    const { service, sendEmail } = realCommunications(false);
    await runnerWith(service).run(date);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await db.select().from(communications)).toHaveLength(0);
  });

  it("pauses a claimed worker and resumes the same logical date without duplicate invoices", async () => {
    const seeded = await fixture();
    const schedule = await scheduleFor(seeded.organisation.id, seeded.customer.id);
    const comms = { sendInvoiceEmail: jest.fn(), sendPaymentReminderEmail: jest.fn() };
    const runner = runnerWith(comms);
    const internals = runner as unknown as RunnerInternals;
    const job = requiredRow(await db.insert(automationJobs).values({
      organisationId: seeded.organisation.id, kind: "recurring_invoice_generate", resourceType: "recurring_schedule",
      resourceId: schedule.id, scheduledFor: date, idempotencyKey: `recurring:${schedule.id}:${date}`
    }).returning(), "job");
    const claimed = requiredRow(await internals.claimBatch(date), "claim");
    const schedules = new RecurringInvoicesService(pool.databaseService(), audit as never);
    await schedules.pauseSchedule(seeded.context, schedule.id);
    expect(await internals.processRecurringGenerate(claimed)).toBe("skipped");
    expect(await db.select().from(invoices)).toHaveLength(0);
    await schedules.resumeSchedule(seeded.context, schedule.id);
    expect(requiredRow(await db.select().from(automationJobs).where(eq(automationJobs.id, job.id)), "resumed job").status).toBe("pending");
    await runner.run(date);
    await runner.run(date);
    expect(await db.select().from(invoices)).toHaveLength(1);
    expect(await db.select().from(automationJobs)).toHaveLength(1);
  });

  it("rejects a stale scheduled worker after another worker reclaims and sends", async () => {
    const seeded = await fixture();
    const invoice = await invoiceFor(seeded.organisation.id, seeded.customer.id);
    const job = requiredRow(await db.insert(automationJobs).values({
      organisationId: seeded.organisation.id, kind: "invoice_scheduled_send", resourceType: "invoice",
      resourceId: invoice.id, scheduledFor: date, idempotencyKey: `scheduled:${invoice.id}:${date}`
    }).returning(), "job");
    const { service, sendEmail } = realCommunications(false);
    const first = runnerWith(service) as unknown as RunnerInternals;
    const second = runnerWith(service) as unknown as RunnerInternals;
    const stale = requiredRow(await first.claimBatch(date), "stale claim");
    await db.update(automationJobs).set({ claimedAt: new Date(Date.now() - 11 * 60 * 1000) }).where(eq(automationJobs.id, job.id));
    await second.reclaimStaleJobs();
    const current = requiredRow(await second.claimBatch(date), "reclaimed job");
    expect(current.claimToken).not.toBe(stale.claimToken);
    expect(await second.processScheduledSend(current)).toBe("completed");
    expect(await first.processScheduledSend(stale)).toBe("skipped");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(await db.select().from(communications)).toHaveLength(1);
    expect(requiredRow(await db.select().from(automationJobs), "job").status).toBe("completed");
  });

  it.each(["pending", "running"])("manual send supersedes a %s scheduled job", async (status) => {
    const seeded = await fixture();
    const invoice = await invoiceFor(seeded.organisation.id, seeded.customer.id);
    await db.insert(automationJobs).values({
      organisationId: seeded.organisation.id, kind: "invoice_scheduled_send", resourceType: "invoice", resourceId: invoice.id,
      scheduledFor: date, idempotencyKey: `scheduled:${invoice.id}:${date}`, status,
      claimToken: status === "running" ? "old-claim" : null, claimedAt: status === "running" ? new Date() : null
    });
    const sendEmail = jest.fn(async (request: SendEmailInput) => ({ providerMessageId: `manual-${request.correlationId}` }));
    const comms = new CommunicationsService(pool.databaseService(), config, {
      isConfigured: () => true, getFromEmail: () => "billing@example.test", sendEmail
    } as never, audit as never);
    const payments = { getInvoiceFinancialSummary: jest.fn().mockResolvedValue({ balanceDueKobo: 50000, netReceivedKobo: 0 }) };
    const service = new InvoicesService(pool.databaseService(), audit as never, config, {} as never, payments as never, comms);
    await service.sendInvoice(seeded.context, invoice.id);
    const persisted = requiredRow(await db.select().from(automationJobs), "superseded job");
    expect(persisted).toMatchObject({ status: "cancelled", claimToken: null, claimedAt: null });
    const runner = runnerWith(comms);
    await runner.run(date);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(requiredRow(await db.select().from(invoices), "sent invoice")).toMatchObject({ status: "sent", scheduledSendDate: null });
  });

  it("stops at the batch bound, leaves observable backlog and drains it on the next run", async () => {
    const { organisation } = await fixture();
    await db.insert(automationJobs).values(Array.from({ length: 201 }, (_, index) => ({
      organisationId: organisation.id, kind: "unknown", resourceType: "invoice", resourceId: organisation.id,
      scheduledFor: date, idempotencyKey: `budget:${index}`
    })));
    const runner = runnerWith({});
    const first = await runner.run(date);
    expect(first).toMatchObject({ claimed: 200, skipped: 200, pendingDue: 1, budgetExhausted: true });
    expect(await runner.run(date)).toMatchObject({ claimed: 1, skipped: 1, pendingDue: 0, budgetExhausted: false });
    expect((await db.select().from(automationJobs)).every((job) => job.attemptCount === 1)).toBe(true);
  });

  it("rolls back schedule metadata and existing items when replacement insertion fails", async () => {
    const seeded = await fixture();
    const schedule = await scheduleFor(seeded.organisation.id, seeded.customer.id);
    const originalItems = await db.select().from(recurringInvoiceScheduleLineItems);
    await db.execute(sql.raw(`create function fail_schedule_items() returns trigger language plpgsql as $$ begin raise exception 'injected replacement failure'; end $$`));
    await db.execute(sql.raw(`create trigger fail_schedule_items_trigger before insert on recurring_invoice_schedule_line_items for each row execute function fail_schedule_items()`));
    try {
      const service = new RecurringInvoicesService(pool.databaseService(), audit as never);
      await expect(service.updateSchedule(seeded.context, schedule.id, {
        name: "Changed", lineItems: [{ description: "Replacement", quantity: 2, unitPriceKobo: 15000 }]
      })).rejects.toThrow();
      expect(await db.select().from(recurringInvoiceScheduleLineItems)).toEqual(originalItems);
      expect(requiredRow(await db.select().from(recurringInvoiceSchedules), "unchanged schedule").name).toBe("Retainer");
    } finally {
      await db.execute(sql.raw("drop trigger fail_schedule_items_trigger on recurring_invoice_schedule_line_items"));
      await db.execute(sql.raw("drop function fail_schedule_items()"));
    }
  });

  it("rolls back enabled settings and the original reminder sequence when replacement insertion fails", async () => {
    const seeded = await fixture();
    const service = new ReminderSettingsService(pool.databaseService(), audit as never);
    await service.putSettings(seeded.context, { enabled: false, steps: [{ relativeDays: 1, subjectTemplate: "Original", bodyTemplate: "Pay {{amountDue}}" }] });
    const original = await service.getSettings(seeded.organisation.id);
    await db.execute(sql.raw(`create function fail_reminder_steps() returns trigger language plpgsql as $$ begin raise exception 'injected sequence failure'; end $$`));
    await db.execute(sql.raw(`create trigger fail_reminder_steps_trigger before insert on reminder_steps for each row execute function fail_reminder_steps()`));
    try {
      await expect(service.putSettings(seeded.context, { enabled: true, steps: [{ relativeDays: 3, subjectTemplate: "Replacement", bodyTemplate: "Pay {{amountDue}}" }] })).rejects.toThrow();
      expect(await service.getSettings(seeded.organisation.id)).toEqual(original);
    } finally {
      await db.execute(sql.raw("drop trigger fail_reminder_steps_trigger on reminder_steps"));
      await db.execute(sql.raw("drop function fail_reminder_steps()"));
    }
  });
});
