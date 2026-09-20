import { UnprocessableEntityException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { DatabaseService, type AppDatabase } from "../../database/database.service";
import {
  customers,
  invoices,
  organisationMembers,
  organisations,
  paymentRefunds,
  payments,
  users
} from "../../database/schema";
import {
  requiredRow,
  startTestPostgres,
  uniqueSlug,
  type TestPostgres
} from "../../test/postgres-test-helper";
import { ReceiptsService } from "../receipts/receipts.service";
import { PaymentsService } from "./payments.service";

jest.setTimeout(180000);

let postgres: TestPostgres;
let connectionString: string;
let db: AppDatabase;
const databaseServices: DatabaseService[] = [];

function databaseService() {
  const service = new DatabaseService({
    get: (key: string) => (key === "DATABASE_URL" ? connectionString : undefined)
  } as unknown as ConfigService);
  databaseServices.push(service);
  return service;
}

function stubConfig() {
  return {
    get: (key: string) => (key === "FRONTEND_APP_URL" ? "http://localhost:3000" : undefined)
  } as unknown as ConfigService;
}

function paymentsService(paystackCreateRefund: jest.Mock) {
  const dbService = databaseService();
  const receipts = new ReceiptsService(dbService, stubConfig());
  const paystack = {
    createRefund: paystackCreateRefund,
    fetchRefund: jest.fn(),
    listRefunds: jest.fn()
  } as never;
  return new PaymentsService(dbService, stubConfig(), paystack, receipts);
}

beforeAll(async () => {
  postgres = await startTestPostgres();
  connectionString = postgres.connectionString;
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });
  const schema = await import("../../database/schema");
  db = drizzle(pool, { schema });
  (db as unknown as { __pool?: Pool }).__pool = pool;
});

afterAll(async () => {
  for (const service of databaseServices) {
    await service.onModuleDestroy().catch(() => undefined);
  }
  await (db as unknown as { __pool?: Pool }).__pool?.end();
  await postgres.stop();
});

describe("concurrent refund reservations (real Postgres)", () => {
  it("serializes two oversubscribed refunds so reserved capacity never exceeds the overpayment", async () => {
    const slug = uniqueSlug("refund-race");
    const organisation = requiredRow(
      await db.insert(organisations).values({ name: "Refund Org", slug }).returning(),
      "organisation"
    );
    const user = requiredRow(
      await db
        .insert(users)
        .values({ email: `${slug}@example.com`, name: "Refund User", passwordHash: "x" })
        .returning(),
      "user"
    );
    await db.insert(organisationMembers).values({
      organisationId: organisation.id,
      userId: user.id,
      role: "owner",
      status: "active"
    });
    const customer = requiredRow(
      await db
        .insert(customers)
        .values({
          organisationId: organisation.id,
          name: "Refund Co",
          email: "billing@refund.example"
        })
        .returning(),
      "customer"
    );
    const invoice = requiredRow(
      await db
        .insert(invoices)
        .values({
          organisationId: organisation.id,
          customerId: customer.id,
          invoiceNumber: `INV-${slug.slice(-6).toUpperCase()}`,
          publicToken: `token-${slug}`,
          publicAccessEnabled: false,
          status: "paid",
          currency: "NGN",
          issueDate: new Date().toISOString().slice(0, 10),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          subtotalKobo: 50000,
          totalKobo: 50000,
          amountPaidKobo: 80000,
          balanceDueKobo: 0,
          createdByUserId: user.id
        })
        .returning(),
      "invoice"
    );
    const payment = requiredRow(
      await db
        .insert(payments)
        .values({
          organisationId: organisation.id,
          invoiceId: invoice.id,
          customerId: customer.id,
          provider: "paystack",
          providerReference: `ref-${slug}`,
          status: "successful",
          currency: "NGN",
          amountKobo: 80000,
          paidAt: new Date()
        })
        .returning(),
      "payment"
    );

    const context = {
      user: { id: user.id },
      activeOrganisation: organisation
    } as never;
    const actor = { userId: user.id } as never;

    // Overpayment is 30000 kobo. Two concurrent 20000 kobo reservations would
    // total 40000 if both succeeded. The invoice->payment->refund lock order
    // must serialize them so exactly one wins.
    const paystackCreateRefund = jest.fn(async (input: { amountKobo: number }) => ({
      providerRefundId: `provider-${input.amountKobo}-${uniqueSlug("r")}`,
      status: "pending",
      amountKobo: input.amountKobo,
      currency: "NGN",
      transactionReference: payment.providerReference
    }));
    const first = paymentsService(paystackCreateRefund);
    const second = paymentsService(paystackCreateRefund);

    const results = await Promise.allSettled([
      first.createPaymentRefund(context, actor, payment.id, {
        amountKobo: 20000,
        reason: "First concurrent refund"
      }),
      second.createPaymentRefund(context, actor, payment.id, {
        amountKobo: 20000,
        reason: "Second concurrent refund"
      })
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      UnprocessableEntityException
    );

    const rows = await db
      .select({ amountKobo: paymentRefunds.amountKobo, status: paymentRefunds.status })
      .from(paymentRefunds)
      .where(eq(paymentRefunds.paymentId, payment.id));
    const reserved = rows
      .filter((row) => row.status !== "failed")
      .reduce((sum, row) => sum + row.amountKobo, 0);
    expect(reserved).toBeLessThanOrEqual(30000);
    expect(reserved).toBe(20000);

    // Canonical truth: the invoice aggregate still reflects one payment and
    // the surviving reservation, never a double spend.
    const summary = await first.getInvoiceFinancialSummary(organisation.id, invoice.id);
    expect(summary.grossSuccessfulKobo).toBe(80000);
    expect(summary.overpaymentKobo).toBe(30000);
    await db.execute(sql`SELECT 1`);
  });
});
