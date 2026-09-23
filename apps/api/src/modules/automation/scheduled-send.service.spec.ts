import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../../database/database.service";
import { automationJobs, customers, invoices, organisations, users } from "../../database/schema";
import { requiredRow, startApiTestPool, uniqueSlug, type ApiTestPool } from "../../test/postgres-test-helper";
import { AuditLogService } from "../audit-log/audit-log.service";
import { ScheduledSendService } from "./scheduled-send.service";

jest.setTimeout(180000);

let pool: ApiTestPool;
let db: AppDatabase;

beforeAll(async () => {
  pool = await startApiTestPool();
  db = pool.db;
});

afterAll(async () => pool.stop());

it("cancels a running send and reactivates the same logical job when rescheduled", async () => {
  const slug = uniqueSlug("scheduled-send");
  const organisation = requiredRow(await db.insert(organisations).values({ name: "Schedule Org", slug }).returning(), "organisation");
  const user = requiredRow(await db.insert(users).values({ email: `${slug}@example.test`, name: "Owner", passwordHash: "x" }).returning(), "user");
  const customer = requiredRow(await db.insert(customers).values({ organisationId: organisation.id, name: "Customer", email: "accounts@example.test" }).returning(), "customer");
  const invoice = requiredRow(await db.insert(invoices).values({
    organisationId: organisation.id, customerId: customer.id, invoiceNumber: `INV-${slug.slice(-6)}`,
    publicToken: `token-${slug}`, status: "draft", currency: "NGN", issueDate: "2026-09-23",
    dueDate: "2026-10-23", subtotalKobo: 1000, totalKobo: 1000, balanceDueKobo: 1000
  }).returning(), "invoice");
  const service = new ScheduledSendService(pool.databaseService(), { create: jest.fn() } as unknown as AuditLogService);
  const context = { activeOrganisation: organisation, user } as never;
  const date = "2099-10-01";
  await service.scheduleSend(context, invoice.id, { scheduledSendDate: date });
  const [first] = await db.select().from(automationJobs).where(and(eq(automationJobs.resourceId, invoice.id), eq(automationJobs.kind, "invoice_scheduled_send")));
  expect(first?.status).toBe("pending");
  await db.update(automationJobs).set({ status: "running", claimToken: "first-claim" }).where(eq(automationJobs.id, first!.id));
  await service.cancelScheduledSend(context, invoice.id);
  const [cancelled] = await db.select().from(automationJobs).where(eq(automationJobs.id, first!.id));
  expect(cancelled).toMatchObject({ status: "cancelled", claimToken: null });
  await service.scheduleSend(context, invoice.id, { scheduledSendDate: date });
  await service.scheduleSend(context, invoice.id, { scheduledSendDate: date });
  const jobs = await db.select().from(automationJobs).where(and(eq(automationJobs.resourceId, invoice.id), eq(automationJobs.kind, "invoice_scheduled_send")));
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({ id: first!.id, status: "pending", attemptCount: 0 });
});

it("rejects impossible calendar dates", async () => {
  const slug = uniqueSlug("scheduled-date");
  const organisation = requiredRow(await db.insert(organisations).values({ name: "Date Org", slug }).returning(), "organisation");
  const user = requiredRow(await db.insert(users).values({ email: `${slug}@example.test`, name: "Owner", passwordHash: "x" }).returning(), "user");
  const customer = requiredRow(await db.insert(customers).values({ organisationId: organisation.id, name: "Customer", email: "accounts@example.test" }).returning(), "customer");
  const invoice = requiredRow(await db.insert(invoices).values({
    organisationId: organisation.id, customerId: customer.id, invoiceNumber: `INV-${slug.slice(-6)}`,
    publicToken: `token-${slug}`, status: "draft", currency: "NGN", issueDate: "2026-09-23",
    dueDate: "2026-10-23", subtotalKobo: 1000, totalKobo: 1000, balanceDueKobo: 1000
  }).returning(), "invoice");
  const service = new ScheduledSendService(pool.databaseService(), { create: jest.fn() } as unknown as AuditLogService);
  await expect(service.scheduleSend({ activeOrganisation: organisation, user } as never, invoice.id, { scheduledSendDate: "2026-02-31" })).rejects.toThrow(/valid scheduled date/);
});
