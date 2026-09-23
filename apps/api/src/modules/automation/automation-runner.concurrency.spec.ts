import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";

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
  users,
  type AutomationJob
} from "../../database/schema";
import { AutomationRunnerService } from "./automation-runner.service";
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
});





