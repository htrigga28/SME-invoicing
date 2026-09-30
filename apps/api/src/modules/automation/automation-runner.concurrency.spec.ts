import { ConfigService } from "@nestjs/config";
import { ConflictException } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import type { AppDatabase } from "../../database/database.service";
import { DatabaseService } from "../../database/database.service";
import {
  automationJobs,
  customers,
  invoices,
  organisations,
  recurringInvoiceOccurrences,
  recurringInvoiceScheduleLineItems,
  recurringInvoiceSchedules,
  invoiceLineItems,
  invoiceStatusEvents,
  invoiceNumberSequences,
  organisationReminderSettings,
  reminderSteps,
  users,
  type AutomationJob
} from "../../database/schema";
import { AutomationRunnerService } from "./automation-runner.service";
import { ReminderSettingsService } from "./reminder-settings.service";
import { RecurringInvoicesService } from "./recurring-invoices.service";
import {
  requiredRow,
  startApiTestPool,
  uniqueSlug,
  type ApiTestPool
} from "../../test/postgres-test-helper";

jest.setTimeout(180000);

let pool: ApiTestPool;
let db: AppDatabase;
let databaseService: () => DatabaseService;

function configStub() {
  return {
    get: jest.fn((key: string) => {
      if (key === "FRONTEND_APP_URL") return "http://localhost:3000";
      return undefined;
    })
  } as unknown as ConfigService;
}

function runnerWithComms(communications: unknown) {
  return new AutomationRunnerService(
    databaseService(),
    configStub(),
    communications as never
  );
}

const noEmailComms = {
  sendInvoiceEmail: jest.fn(),
  sendPaymentReminderEmail: jest.fn()
};

beforeAll(async () => {
  pool = await startApiTestPool();
  db = pool.db;
  databaseService = pool.databaseService;
});

afterAll(async () => {
  await pool.stop();
});

async function seedOrg() {
  const slug = uniqueSlug("t022");
  const organisation = requiredRow(
    await db.insert(organisations).values({ name: "T022 Org", slug }).returning(),
    "organisation"
  );
  const user = requiredRow(
    await db
      .insert(users)
      .values({ email: `${slug}@example.com`, passwordHash: "x", name: "Owner" })
      .returning(),
    "user"
  );
  const customer = requiredRow(
    await db
      .insert(customers)
      .values({ organisationId: organisation.id, name: "Northstar", email: "accounts@northstar.example" })
      .returning(),
    "customer"
  );
  return { organisation, user, customer };
}

async function seedSchedule(orgId: string, customerId: string, overrides: Record<string, unknown> = {}) {
  const schedule = requiredRow(
    await db
      .insert(recurringInvoiceSchedules)
      .values({
        organisationId: orgId,
        customerId,
        name: "Northstar retainer",
        status: "active",
        frequency: "monthly",
        anchorDay: 30,
        anchorMonth: 9,
        startDate: "2026-09-30",
        nextIssueDate: "2026-09-30",
        dueTermsDays: 14,
        autoSend: false,
        toRecipients: ["accounts@northstar.example"],
        ccRecipients: [],
        discountKobo: 0,
        taxKobo: 0,
        ...overrides
      })
      .returning(),
    "schedule"
  );
  await db.insert(recurringInvoiceScheduleLineItems).values({
    organisationId: orgId,
    scheduleId: schedule.id,
    description: "Retainer",
    quantity: "1",
    unitPriceKobo: 78400,
    sortOrder: 0
  });
  return schedule;
}

describe("automation runner idempotency", () => {
  it("does not let a stale claim overwrite a reclaimed job", async () => {
    const { organisation } = await seedOrg();
    const [job] = await db.insert(automationJobs).values({
      organisationId: organisation.id, kind: "unknown", resourceType: "invoice",
      resourceId: organisation.id, scheduledFor: "2026-09-30",
      idempotencyKey: `fence:${organisation.id}`, status: "pending"
    }).returning();
    const runner = runnerWithComms(noEmailComms) as unknown as {
      claimBatch(date: string): Promise<AutomationJob[]>;
      markOutcome(job: AutomationJob, status: "completed", error: null): Promise<boolean>;
    };
    const [first] = await runner.claimBatch("2026-09-30");
    await db.update(automationJobs).set({ status: "pending", claimToken: null, claimedAt: null })
      .where(eq(automationJobs.id, job!.id));
    const [second] = await runner.claimBatch("2026-09-30");
    expect(first!.claimToken).not.toBe(second!.claimToken);
    expect(await runner.markOutcome(second!, "completed", null)).toBe(true);
    expect(await runner.markOutcome(first!, "completed", null)).toBe(false);
    const [persisted] = await db.select().from(automationJobs).where(eq(automationJobs.id, job!.id));
    expect(persisted!.status).toBe("completed");
  });

  it("reactivates a cancelled recurring job for the same date", async () => {
    const { organisation, customer } = await seedOrg();
    const schedule = await seedSchedule(organisation.id, customer.id, {
      status: "paused", startDate: "2026-10-20", nextIssueDate: "2026-10-20"
    });
    const [job] = await db.insert(automationJobs).values({
      organisationId: organisation.id, kind: "recurring_invoice_generate",
      resourceType: "recurring_schedule", resourceId: schedule.id,
      scheduledFor: "2026-10-20", idempotencyKey: `recurring:${schedule.id}:2026-10-20`,
      status: "cancelled", attemptCount: 2
    }).returning();
    await db.update(recurringInvoiceSchedules).set({ status: "active" })
      .where(eq(recurringInvoiceSchedules.id, schedule.id));
    const summary = await runnerWithComms(noEmailComms).run("2026-10-20");
    expect(summary.completed).toBeGreaterThanOrEqual(1);
    const [rearmed] = await db.select().from(automationJobs).where(eq(automationJobs.id, job!.id));
    expect(rearmed!.status).toBe("completed");
    expect(rearmed!.attemptCount).toBe(1);
  });

  it("drains more than one claim batch", async () => {
    const { organisation } = await seedOrg();
    await db.insert(automationJobs).values(Array.from({ length: 27 }, (_, index) => ({
      organisationId: organisation.id, kind: "unknown", resourceType: "invoice",
      resourceId: organisation.id, scheduledFor: "2026-09-30",
      idempotencyKey: `batch:${organisation.id}:${index}`, status: "pending"
    })));
    const summary = await runnerWithComms(noEmailComms).run("2026-09-30");
    expect(summary.claimed).toBeGreaterThanOrEqual(27);
    expect(summary.pendingDue).toBe(0);
  });

  it("does not issue a scheduled invoice after cancellation wins", async () => {
    const { organisation, customer } = await seedOrg();
    const [invoice] = await db.insert(invoices).values({
      organisationId: organisation.id, customerId: customer.id,
      invoiceNumber: `CANCEL-${Date.now()}`, publicToken: `cancel-${Date.now()}`,
      status: "draft", currency: "NGN", issueDate: "2026-09-20", dueDate: "2026-10-20",
      subtotalKobo: 1000, totalKobo: 1000, balanceDueKobo: 1000,
      scheduledSendDate: "2026-09-30", scheduledSendTo: [customer.email]
    }).returning();
    const [job] = await db.insert(automationJobs).values({
      organisationId: organisation.id, kind: "invoice_scheduled_send", resourceType: "invoice",
      resourceId: invoice!.id, scheduledFor: "2026-09-30",
      idempotencyKey: `scheduled:${invoice!.id}:2026-09-30`, status: "pending"
    }).returning();
    const comms = { sendInvoiceEmail: jest.fn(), sendPaymentReminderEmail: jest.fn() };
    const runner = runnerWithComms(comms) as unknown as {
      claimBatch(date: string): Promise<AutomationJob[]>;
      processScheduledSend(job: AutomationJob): Promise<string>;
    };
    const [claimed] = await runner.claimBatch("2026-09-30");
    await db.update(invoices).set({ scheduledSendDate: null }).where(eq(invoices.id, invoice!.id));
    await db.update(automationJobs).set({ status: "cancelled", claimToken: null, claimedAt: null })
      .where(eq(automationJobs.id, job!.id));
    expect(await runner.processScheduledSend(claimed!)).toBe("skipped");
    const [persisted] = await db.select().from(invoices).where(eq(invoices.id, invoice!.id));
    expect(persisted!.status).toBe("draft");
    expect(comms.sendInvoiceEmail).not.toHaveBeenCalled();
  });

  it("generates exactly one invoice for a due schedule across duplicate runs", async () => {
    const { organisation, customer } = await seedOrg();
    const schedule = await seedSchedule(organisation.id, customer.id);
    const runner = runnerWithComms(noEmailComms);

    const first = await runner.run("2026-09-30");
    expect(first.claimed).toBeGreaterThanOrEqual(1);
    const second = await runner.run("2026-09-30");
    const occurrenceRows = await db
      .select()
      .from(recurringInvoiceOccurrences)
      .where(eq(recurringInvoiceOccurrences.scheduleId, schedule.id));
    expect(occurrenceRows.filter((r) => r.status === "generated")).toHaveLength(1);
    const invoiceRows = await db.select().from(invoices).where(eq(invoices.organisationId, organisation.id));
    expect(invoiceRows).toHaveLength(1);
    expect(invoiceRows[0]!.status).toBe("draft");
    expect(second.completed + second.skipped).toBeGreaterThanOrEqual(0);
  });

  it("survives concurrent runners without duplicate invoices", async () => {
    const { organisation, customer } = await seedOrg();
    await seedSchedule(organisation.id, customer.id, { startDate: "2026-10-15", nextIssueDate: "2026-10-15" });
    const runnerA = runnerWithComms(noEmailComms);
    const runnerB = runnerWithComms(noEmailComms);
    await Promise.all([runnerA.run("2026-10-15"), runnerB.run("2026-10-15")]);
    const invoiceRows = await db.select().from(invoices).where(eq(invoices.organisationId, organisation.id));
    expect(invoiceRows).toHaveLength(1);
  });

  it("skips paused schedules and marks jobs skipped", async () => {
    const { organisation, customer } = await seedOrg();
    const schedule = await seedSchedule(organisation.id, customer.id, {
      status: "paused",
      startDate: "2026-11-01",
      nextIssueDate: "2026-11-01"
    });
    await db.insert(automationJobs).values({
      organisationId: organisation.id,
      kind: "recurring_invoice_generate",
      resourceType: "recurring_schedule",
      resourceId: schedule.id,
      scheduledFor: "2026-11-01",
      idempotencyKey: `recurring:${schedule.id}:2026-11-01`,
      status: "pending",
      maxAttempts: 3
    }).onConflictDoNothing();
    const runner = runnerWithComms(noEmailComms);
    const summary = await runner.run("2026-11-01");
    expect(summary.skipped + summary.completed).toBeGreaterThanOrEqual(1);
    const invoiceRows = await db.select().from(invoices).where(eq(invoices.organisationId, organisation.id));
    expect(invoiceRows).toHaveLength(0);
  });

  it("keeps uncertain email as needs_attention without a second send", async () => {
    const { organisation, customer } = await seedOrg();
    await seedSchedule(organisation.id, customer.id, {
      autoSend: true,
      startDate: "2026-12-01",
      nextIssueDate: "2026-12-01"
    });
    const { EmailUncertainError } = await import("../communications/email-provider");
    const comms = {
      sendInvoiceEmail: jest.fn().mockRejectedValue(new EmailUncertainError()),
      sendPaymentReminderEmail: jest.fn()
    };
    const runner = runnerWithComms(comms);
    const summary = await runner.run("2026-12-01");
    expect(summary.needsAttention).toBeGreaterThanOrEqual(1);
    expect(comms.sendInvoiceEmail).toHaveBeenCalledTimes(1);
    // Second run must not mint a second email attempt for the same occurrence.
    const summary2 = await runner.run("2026-12-01");
    expect(comms.sendInvoiceEmail).toHaveBeenCalledTimes(1);
    expect(summary2.needsAttention + summary2.skipped + summary2.completed).toBeGreaterThanOrEqual(0);
  });

  it("sends only the latest applicable reminder and skips stale pre-due", async () => {
    const { organisation, customer } = await seedOrg();
    const { organisationReminderSettings, reminderSteps } = await import("../../database/schema");
    await db.insert(organisationReminderSettings).values({ organisationId: organisation.id, enabled: true }).onConflictDoNothing();
    await db.insert(reminderSteps).values([
      { organisationId: organisation.id, relativeDays: -3, subjectTemplate: "Due soon {{invoiceNumber}}", bodyTemplate: "Hi {{customerName}} {{invoiceNumber}} {{amountDue}} {{dueDate}} {{businessName}} {{publicInvoiceUrl}}", enabled: true },
      { organisationId: organisation.id, relativeDays: 1, subjectTemplate: "Overdue {{invoiceNumber}}", bodyTemplate: "Hi {{customerName}} {{invoiceNumber}} {{amountDue}} {{dueDate}} {{businessName}} {{publicInvoiceUrl}}", enabled: true },
      { organisationId: organisation.id, relativeDays: 7, subjectTemplate: "Still due {{invoiceNumber}}", bodyTemplate: "Hi {{customerName}} {{invoiceNumber}} {{amountDue}} {{dueDate}} {{businessName}} {{publicInvoiceUrl}}", enabled: true }
    ]);
    const invoice = requiredRow(
      await db
        .insert(invoices)
        .values({
          organisationId: organisation.id,
          customerId: customer.id,
          invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
          publicToken: `tok-${Date.now()}`,
          publicAccessEnabled: true,
          status: "sent",
          currency: "NGN",
          issueDate: "2026-09-20",
          dueDate: "2026-09-30",
          subtotalKobo: 78400,
          totalKobo: 78400,
          balanceDueKobo: 78400
        })
        .returning(),
      "invoice"
    );
    const comms = {
      sendInvoiceEmail: jest.fn(),
      sendPaymentReminderEmail: jest.fn().mockResolvedValue({ communication: {}, outcome: "accepted" })
    };
    const runner = runnerWithComms(comms);
    // Day +8: +1 and +7 both applicable; only +7 may send.
    await runner.run("2026-10-08");
    expect(comms.sendPaymentReminderEmail).toHaveBeenCalledTimes(1);
    const jobs = await db.select().from(automationJobs).where(eq(automationJobs.resourceId, invoice.id));
    expect(jobs).toHaveLength(1);
    expect((jobs[0]!.payloadRedacted as { relativeDays: number }).relativeDays).toBe(7);
  });

  it("refuses cancellation after a recurring email reserves its send", async () => {
    const { organisation, user, customer } = await seedOrg();
    const schedule = await seedSchedule(organisation.id, customer.id, {
      autoSend: true, startDate: "2026-12-12", nextIssueDate: "2026-12-12"
    });
    let entered!: () => void;
    let release!: () => void;
    const providerEntered = new Promise<void>((resolve) => { entered = resolve; });
    const providerRelease = new Promise<void>((resolve) => { release = resolve; });
    const comms = {
      sendInvoiceEmail: jest.fn(async () => {
        entered();
        await providerRelease;
        return { outcome: "accepted" };
      }),
      sendPaymentReminderEmail: jest.fn()
    };
    const run = runnerWithComms(comms).run("2026-12-12");
    await providerEntered;
    const [job] = await db.select().from(automationJobs).where(eq(automationJobs.resourceId, schedule.id));
    expect(job!.status).toBe("sending");
    const schedules = new RecurringInvoicesService(databaseService(), { create: jest.fn() } as never);
    await expect(schedules.cancelSchedule({ activeOrganisation: organisation, user } as never, schedule.id))
      .rejects.toBeInstanceOf(ConflictException);
    release();
    await run;
    expect(comms.sendInvoiceEmail).toHaveBeenCalledTimes(1);
  });

  it("does not generate or email when schedule cancellation commits before the worker", async () => {
    const { organisation, user, customer } = await seedOrg();
    const schedule = await seedSchedule(organisation.id, customer.id, {
      autoSend: true, startDate: "2026-12-13", nextIssueDate: "2026-12-13"
    });
    const [job] = await db.insert(automationJobs).values({
      organisationId: organisation.id, kind: "recurring_invoice_generate", resourceType: "recurring_schedule",
      resourceId: schedule.id, scheduledFor: "2026-12-13",
      idempotencyKey: `recurring:${schedule.id}:2026-12-13`
    }).returning();
    const runner = runnerWithComms(noEmailComms) as unknown as {
      claimBatch(date: string): Promise<AutomationJob[]>;
      processRecurringGenerate(job: AutomationJob): Promise<string>;
    };
    const [claimed] = await runner.claimBatch("2026-12-13");
    const schedules = new RecurringInvoicesService(databaseService(), { create: jest.fn() } as never);
    await schedules.cancelSchedule({ activeOrganisation: organisation, user } as never, schedule.id);
    expect(await runner.processRecurringGenerate(claimed!)).toBe("skipped");
    expect(await db.select().from(invoices).where(eq(invoices.organisationId, organisation.id))).toHaveLength(0);
    expect(noEmailComms.sendInvoiceEmail).not.toHaveBeenCalled();
    const [persisted] = await db.select().from(automationJobs).where(eq(automationJobs.id, job!.id));
    expect(persisted!.status).toBe("cancelled");
  });

  it.each([
    ["invoices", "insert"],
    ["invoice_line_items", "insert"],
    ["invoice_status_events", "insert"],
    ["recurring_invoice_occurrences", "update"]
  ])("rolls back after %s %s and safely reclaims the occurrence", async (table, operation) => {
    const { organisation, customer } = await seedOrg();
    const schedule = await seedSchedule(organisation.id, customer.id, {
      startDate: "2026-12-14", nextIssueDate: "2026-12-14"
    });
    const functionName = `test_fail_${table}`;
    const triggerName = `test_fail_${table}_trigger`;
    await db.execute(sql.raw(`create function ${functionName}() returns trigger language plpgsql as $$
      begin if NEW.organisation_id::text = '${organisation.id}' then
        raise exception 'injected generation failure';
      end if; return NEW; end $$`));
    await db.execute(sql.raw(`create trigger ${triggerName} after ${operation} on ${table}
      for each row execute function ${functionName}()`));
    try {
      const failed = await runnerWithComms(noEmailComms).run("2026-12-14");
      expect(failed.failed).toBeGreaterThanOrEqual(1);
      expect(await db.select().from(invoices).where(eq(invoices.organisationId, organisation.id))).toHaveLength(0);
      expect(await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.organisationId, organisation.id))).toHaveLength(0);
      expect(await db.select().from(invoiceStatusEvents).where(eq(invoiceStatusEvents.organisationId, organisation.id))).toHaveLength(0);
      expect(await db.select().from(invoiceNumberSequences).where(eq(invoiceNumberSequences.organisationId, organisation.id))).toHaveLength(0);
      const occurrences = await db.select().from(recurringInvoiceOccurrences)
        .where(eq(recurringInvoiceOccurrences.scheduleId, schedule.id));
      expect(occurrences).toHaveLength(1);
      expect(occurrences[0]).toMatchObject({ status: "pending", invoiceId: null, generatedAt: null });
      const [persisted] = await db.select().from(recurringInvoiceSchedules)
        .where(eq(recurringInvoiceSchedules.id, schedule.id));
      expect(persisted!.nextIssueDate).toBe("2026-12-14");
    } finally {
      await db.execute(sql.raw(`drop trigger ${triggerName} on ${table}`));
      await db.execute(sql.raw(`drop function ${functionName}()`));
    }
    const [failedJob] = await db.select().from(automationJobs)
      .where(eq(automationJobs.idempotencyKey, `recurring:${schedule.id}:2026-12-14`));
    expect(failedJob).toMatchObject({ status: "pending", claimToken: null, attemptCount: 1 });
    await db.update(automationJobs).set({ nextAttemptAt: null }).where(eq(automationJobs.id, failedJob!.id));
    const runner = runnerWithComms(noEmailComms);
    await runner.run("2026-12-14");
    await runner.run("2026-12-14");
    await runner.run("2026-12-14");
    const generated = await db.select().from(invoices).where(eq(invoices.organisationId, organisation.id));
    expect(generated).toHaveLength(1);
    expect(generated[0]!.invoiceNumber).toBe("INV-000001");
    expect(await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, generated[0]!.id))).toHaveLength(1);
    expect(await db.select().from(invoiceStatusEvents).where(eq(invoiceStatusEvents.invoiceId, generated[0]!.id))).toHaveLength(1);
    const occurrences = await db.select().from(recurringInvoiceOccurrences)
      .where(eq(recurringInvoiceOccurrences.scheduleId, schedule.id));
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatchObject({ status: "generated", invoiceId: generated[0]!.id });
    const [completed] = await db.select().from(automationJobs).where(eq(automationJobs.id, failedJob!.id));
    expect(completed).toMatchObject({ status: "completed", attemptCount: 2 });
  });

  it("fences a stale generation claim before changing business records", async () => {
    const { organisation, customer } = await seedOrg();
    const schedule = await seedSchedule(organisation.id, customer.id, {
      startDate: "2026-12-15", nextIssueDate: "2026-12-15"
    });
    const [job] = await db.insert(automationJobs).values({
      organisationId: organisation.id, kind: "recurring_invoice_generate", resourceType: "recurring_schedule",
      resourceId: schedule.id, scheduledFor: "2026-12-15",
      idempotencyKey: `recurring:${schedule.id}:2026-12-15`
    }).returning();
    const runner = runnerWithComms(noEmailComms) as unknown as {
      claimBatch(date: string): Promise<AutomationJob[]>;
      processRecurringGenerate(job: AutomationJob): Promise<string>;
    };
    const [stale] = await runner.claimBatch("2026-12-15");
    await db.update(automationJobs).set({ status: "pending", claimToken: null, claimedAt: null })
      .where(eq(automationJobs.id, job!.id));
    const [current] = await runner.claimBatch("2026-12-15");
    expect(stale!.claimToken).not.toBe(current!.claimToken);
    expect(await runner.processRecurringGenerate(stale!)).toBe("skipped");
    expect(await db.select().from(invoices).where(eq(invoices.organisationId, organisation.id))).toHaveLength(0);
    expect(await db.select().from(recurringInvoiceOccurrences)
      .where(eq(recurringInvoiceOccurrences.scheduleId, schedule.id))).toHaveLength(0);
  });

  it("parks an expired send reservation for review without retrying", async () => {
    const { organisation } = await seedOrg();
    const [job] = await db.insert(automationJobs).values({
      organisationId: organisation.id, kind: "invoice_reminder_send", resourceType: "invoice",
      resourceId: organisation.id, scheduledFor: "2026-10-01",
      idempotencyKey: `expired-send:${organisation.id}`, status: "sending",
      claimToken: "expired-reservation", claimedAt: new Date(Date.now() - 11 * 60 * 1000)
    }).returning();
    const runner = runnerWithComms(noEmailComms) as unknown as { reclaimStaleJobs(): Promise<void> };
    await runner.reclaimStaleJobs();
    const [persisted] = await db.select().from(automationJobs).where(eq(automationJobs.id, job!.id));
    expect(persisted).toMatchObject({ status: "needs_attention", claimToken: null });
    expect(persisted!.lastError).toContain("verify provider delivery");
  });

  it("rechecks reminder opt-out and renders the reserved balance", async () => {
    const { organisation, user, customer } = await seedOrg();
    await db.insert(organisationReminderSettings).values({ organisationId: organisation.id, enabled: true });
    const [step] = await db.insert(reminderSteps).values({
      organisationId: organisation.id, relativeDays: 1,
      subjectTemplate: "Balance {{amountDue}}", bodyTemplate: "Pay {{amountDue}}", enabled: true
    }).returning();
    const [invoice] = await db.insert(invoices).values({
      organisationId: organisation.id, customerId: customer.id,
      invoiceNumber: `RACE-${Date.now()}`, publicToken: `race-${Date.now()}`,
      publicAccessEnabled: true, status: "partially_paid", currency: "NGN",
      issueDate: "2026-09-20", dueDate: "2026-09-30",
      subtotalKobo: 78400, totalKobo: 78400, balanceDueKobo: 78400
    }).returning();
    const [job] = await db.insert(automationJobs).values({
      organisationId: organisation.id, kind: "invoice_reminder_send", resourceType: "invoice",
      resourceId: invoice!.id, scheduledFor: "2026-10-01", idempotencyKey: `reminder-race:${invoice!.id}`,
      payloadRedacted: { stepId: step!.id, invoiceId: invoice!.id, relativeDays: 1 }
    }).returning();
    const settings = new ReminderSettingsService(databaseService(), { create: jest.fn() } as never);
    const comms = { sendInvoiceEmail: jest.fn(), sendPaymentReminderEmail: jest.fn().mockResolvedValue({ outcome: "accepted" }) };
    const runner = runnerWithComms(comms) as unknown as {
      claimBatch(date: string): Promise<AutomationJob[]>;
      processReminder(job: AutomationJob): Promise<string>;
    };
    const [claimed] = await runner.claimBatch("2026-10-01");
    await settings.setCustomerPreference({ activeOrganisation: organisation, user } as never, customer.id, false);
    expect(await runner.processReminder(claimed!)).toBe("skipped");
    expect(comms.sendPaymentReminderEmail).not.toHaveBeenCalled();
    await settings.setCustomerPreference({ activeOrganisation: organisation, user } as never, customer.id, true);
    await db.update(invoices).set({ balanceDueKobo: 25000 }).where(eq(invoices.id, invoice!.id));
    await db.update(automationJobs).set({ status: "pending", claimToken: null }).where(eq(automationJobs.id, job!.id));
    const [reclaimed] = await runner.claimBatch("2026-10-01");
    expect(await runner.processReminder(reclaimed!)).toBe("completed");
    expect(comms.sendPaymentReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Balance ₦250.00", content: expect.objectContaining({ amountDueKobo: 25000 }) }),
      expect.anything()
    );
  });

  it("rejects reminder opt-out once its provider call is reserved", async () => {
    const { organisation, user, customer } = await seedOrg();
    await db.insert(organisationReminderSettings).values({ organisationId: organisation.id, enabled: true });
    const [step] = await db.insert(reminderSteps).values({
      organisationId: organisation.id, relativeDays: 1,
      subjectTemplate: "Reminder", bodyTemplate: "Pay {{amountDue}}", enabled: true
    }).returning();
    const [invoice] = await db.insert(invoices).values({
      organisationId: organisation.id, customerId: customer.id,
      invoiceNumber: `HOLD-${Date.now()}`, publicToken: `hold-${Date.now()}`,
      publicAccessEnabled: true, status: "sent", currency: "NGN",
      issueDate: "2026-09-20", dueDate: "2026-09-30",
      subtotalKobo: 50000, totalKobo: 50000, balanceDueKobo: 50000
    }).returning();
    await db.insert(automationJobs).values({
      organisationId: organisation.id, kind: "invoice_reminder_send", resourceType: "invoice",
      resourceId: invoice!.id, scheduledFor: "2026-10-01", idempotencyKey: `hold-reminder:${invoice!.id}`,
      payloadRedacted: { stepId: step!.id, invoiceId: invoice!.id, relativeDays: 1 }
    });
    let entered!: () => void;
    let release!: () => void;
    const providerEntered = new Promise<void>((resolve) => { entered = resolve; });
    const providerRelease = new Promise<void>((resolve) => { release = resolve; });
    const comms = {
      sendInvoiceEmail: jest.fn(),
      sendPaymentReminderEmail: jest.fn(async () => {
        entered();
        await providerRelease;
        return { outcome: "accepted" };
      })
    };
    const runner = runnerWithComms(comms) as unknown as {
      claimBatch(date: string): Promise<AutomationJob[]>;
      processReminder(job: AutomationJob): Promise<string>;
    };
    const [claimed] = await runner.claimBatch("2026-10-01");
    const processing = runner.processReminder(claimed!);
    await providerEntered;
    const settings = new ReminderSettingsService(databaseService(), { create: jest.fn() } as never);
    await expect(settings.setCustomerPreference({ activeOrganisation: organisation, user } as never, customer.id, false))
      .rejects.toBeInstanceOf(ConflictException);
    release();
    expect(await processing).toBe("completed");
  });
});





