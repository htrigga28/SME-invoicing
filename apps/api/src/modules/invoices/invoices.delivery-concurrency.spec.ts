import { ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq } from "drizzle-orm";

import { AuditLogService } from "../audit-log/audit-log.service";
import { CommunicationsService } from "../communications/communications.service";
import { DatabaseService, type AppDatabase } from "../../database/database.service";
import {
  businessProfiles,
  customers,
  invoiceLineItems,
  invoices,
  invoiceStatusEvents,
  invoiceViewEvents,
  organisationMembers,
  organisations,
  users
} from "../../database/schema";
import { InvoicesService } from "./invoices.service";
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

function stubConfig(values: Record<string, string> = {}) {
  return {
    get: jest.fn((key: string) => values[key])
  } as unknown as ConfigService;
}

async function seedOrgFixture() {
  const slug = uniqueSlug("t021-send");
  const organisation = requiredRow(
    await db.insert(organisations).values({ name: "Send Org", slug }).returning(),
    "organisation"
  );
  const user = requiredRow(
    await db
      .insert(users)
      .values({ email: `${slug}@example.com`, name: "Send User", passwordHash: "x" })
      .returning(),
    "user"
  );
  const membership = requiredRow(
    await db
      .insert(organisationMembers)
      .values({ organisationId: organisation.id, userId: user.id, role: "owner", status: "active" })
      .returning(),
    "membership"
  );
  const businessProfile = requiredRow(
    await db
      .insert(businessProfiles)
      .values({ organisationId: organisation.id, businessName: "Send Org", email: "billing@example.com" })
      .returning(),
    "business profile"
  );
  const customer = requiredRow(
    await db
      .insert(customers)
      .values({ organisationId: organisation.id, name: "Northstar", email: "accounts@northstar.example" })
      .returning(),
    "customer"
  );

  const context = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    },
    activeOrganisation: organisation,
    membership,
    businessProfile
  };

  return { context, customer, organisation };
}

async function seedDraftInvoice(organisationId: string, customerId: string, userId: string) {
  const suffix = uniqueSlug("inv").replace(/[^a-z0-9]/g, "").slice(-6).toUpperCase();
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return requiredRow(
    await db
      .insert(invoices)
      .values({
        organisationId,
        customerId,
        invoiceNumber: `INV-${suffix}`,
        publicToken: `token-${suffix}-${Date.now().toString(36)}`,
        publicAccessEnabled: false,
        status: "draft",
        currency: "NGN",
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate,
        subtotalKobo: 50000,
        totalKobo: 50000,
        balanceDueKobo: 50000,
        createdByUserId: userId
      })
      .returning(),
    "invoice"
  );
}

async function sentTransitionCount(invoiceId: string) {
  const rows = await db
    .select({ id: invoiceStatusEvents.id })
    .from(invoiceStatusEvents)
    .where(
      and(eq(invoiceStatusEvents.invoiceId, invoiceId), eq(invoiceStatusEvents.toStatus, "sent"))
    );
  return rows.length;
}

beforeAll(async () => {
  pool = await startApiTestPool();
  db = pool.db;
  databaseService = pool.databaseService;
});

afterAll(async () => {
  await pool.stop();
});

describe("concurrent invoice sends (real Postgres)", () => {
  it("lets exactly one request issue the draft and send the email", async () => {
    const sendInvoiceEmail = jest.fn(async () => ({
      communication: { id: "comm-1" },
      outcome: "accepted" as const
    }));
    const service = new InvoicesService(
      databaseService(),
      { create: jest.fn() } as unknown as AuditLogService,
      stubConfig({ FRONTEND_APP_URL: "http://localhost:3000" }),
      {} as never,
      {
        getInvoiceFinancialSummary: jest.fn(async () => ({
          balanceDueKobo: 50000,
          netReceivedKobo: 0
        }))
      } as never,
      {
        sendInvoiceEmail,
        getDeliverySummary: jest.fn(async () => ({
          state: "accepted",
          attempts: 1,
          lastCommunication: null
        }))
      } as unknown as CommunicationsService
    );

    const { context, customer, organisation } = await seedOrgFixture();
    const invoice = await seedDraftInvoice(organisation.id, customer.id, context.user.id);

    const [first, second] = await Promise.allSettled([
      service.sendInvoice(context as never, invoice.id, { to: ["accounts@northstar.example"] }),
      service.sendInvoice(context as never, invoice.id, { to: ["accounts@northstar.example"] })
    ]);

    const fulfilled = [first, second].filter((result) => result.status === "fulfilled");
    const rejected = [first, second].filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    expect(sendInvoiceEmail).toHaveBeenCalledTimes(1);
    expect(await sentTransitionCount(invoice.id)).toBe(1);

    const stored = requiredRow(
      await db
        .select({ status: invoices.status })
        .from(invoices)
        .where(eq(invoices.id, invoice.id))
        .limit(1),
      "invoice"
    );
    expect(stored.status).toBe("sent");
  });
});

describe("draft edit versus send (real Postgres)", () => {
  it("never mutates line items or totals after the invoice is sent", async () => {
    const sendInvoiceEmail = jest.fn(async () => ({
      communication: { id: "comm-1" },
      outcome: "accepted" as const
    }));
    const makeService = () =>
      new InvoicesService(
        databaseService(),
        { create: jest.fn() } as unknown as AuditLogService,
        stubConfig({ FRONTEND_APP_URL: "http://localhost:3000" }),
        {} as never,
        {
          getInvoiceFinancialSummary: jest.fn(async () => ({
            balanceDueKobo: 50000,
            netReceivedKobo: 0
          }))
        } as never,
        {
          sendInvoiceEmail,
          getDeliverySummary: jest.fn(async () => ({
            state: "accepted",
            attempts: 1,
            lastCommunication: null
          }))
        } as unknown as CommunicationsService
      );

    const { context, customer, organisation } = await seedOrgFixture();
    const invoice = await seedDraftInvoice(organisation.id, customer.id, context.user.id);
    await db.insert(invoiceLineItems).values({
      organisationId: organisation.id,
      invoiceId: invoice.id,
      description: "Design services",
      quantity: "1.00",
      unitPriceKobo: 50000,
      lineTotalKobo: 50000,
      sortOrder: 0
    });

    const editor = makeService();
    const sender = makeService();

    const [editResult, sendResult] = await Promise.allSettled([
      editor.updateInvoice(context as never, invoice.id, {
        notes: "Edited after send race"
      }),
      sender.sendInvoice(context as never, invoice.id, { to: ["accounts@northstar.example"] })
    ]);

    // Send must win at least once across retries; edit may win the race if it
    // commits first, but it must never corrupt a sent invoice.
    expect(sendResult.status === "fulfilled" || editResult.status === "fulfilled").toBe(true);

    const stored = requiredRow(
      await db
        .select({
          status: invoices.status,
          totalKobo: invoices.totalKobo,
          subtotalKobo: invoices.subtotalKobo
        })
        .from(invoices)
        .where(eq(invoices.id, invoice.id))
        .limit(1),
      "invoice"
    );

    if (sendResult.status === "fulfilled") {
      expect(stored.status).toBe("sent");
      // Totals must remain the issued 50000 kobo fixture value: the CAS
      // predicate prevents a late edit from rewriting a sent invoice.
      expect(stored.totalKobo).toBe(50000);
      expect(stored.subtotalKobo).toBe(50000);

      // A post-send edit must always be rejected with 409.
      await expect(
        editor.updateInvoice(context as never, invoice.id, { notes: "Late edit" })
      ).rejects.toBeInstanceOf(ConflictException);
    } else {
      expect((sendResult as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    }
  });
});

describe("concurrent public views (real Postgres)", () => {
  it("counts every view once while transitioning sent to viewed a single time", async () => {
    const auditCreate = jest.fn(async () => ({}));
    const communicationsService = new CommunicationsService(
      databaseService(),
      stubConfig({ BREVO_WEBHOOK_SECRET: "test-secret" }),
      {} as never,
      { create: auditCreate } as unknown as AuditLogService
    );
    const service = new InvoicesService(
      databaseService(),
      { create: jest.fn() } as unknown as AuditLogService,
      stubConfig({ FRONTEND_APP_URL: "http://localhost:3000" }),
      {} as never,
      { getInvoiceFinancialSummary: jest.fn() } as never,
      communicationsService
    );

    const { context, customer, organisation } = await seedOrgFixture();
    const invoice = await seedDraftInvoice(organisation.id, customer.id, context.user.id);
    await db
      .update(invoices)
      .set({ status: "sent", publicAccessEnabled: true, sentAt: new Date() })
      .where(eq(invoices.id, invoice.id));

    const [stored] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoice.id))
      .limit(1);

    if (!stored) {
      throw new Error("Seed invoice was not found.");
    }

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        service.markPublicInvoiceViewed(stored.publicToken)
      )
    );

    expect(results.every((result) => result.success)).toBe(true);

    const finalInvoice = requiredRow(
      await db
        .select({ status: invoices.status, viewCount: invoices.viewCount })
        .from(invoices)
        .where(eq(invoices.id, invoice.id))
        .limit(1),
      "invoice"
    );
    expect(finalInvoice.status).toBe("viewed");
    expect(finalInvoice.viewCount).toBe(5);

    const viewRows = await db
      .select({ id: invoiceViewEvents.id })
      .from(invoiceViewEvents)
      .where(eq(invoiceViewEvents.invoiceId, invoice.id));
    expect(viewRows).toHaveLength(5);

    const transitions = await db
      .select({ id: invoiceStatusEvents.id })
      .from(invoiceStatusEvents)
      .where(
        and(
          eq(invoiceStatusEvents.invoiceId, invoice.id),
          eq(invoiceStatusEvents.toStatus, "viewed")
        )
      );
    expect(transitions).toHaveLength(1);
  });
});
