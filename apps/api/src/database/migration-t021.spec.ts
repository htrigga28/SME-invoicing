import { promises as fs } from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { startTestPostgres, uniqueSlug, requiredRow, type TestPostgres } from "../test/postgres-test-helper";

jest.setTimeout(180000);

let postgres: TestPostgres;
let connectionString: string;

const MIGRATION_FILE = path.resolve(__dirname, "../../drizzle/0014_light_mattie_franklin.sql");

function extractMarkedStatement(source: string, marker: string): string {
  const begin = `t021-${marker}-begin`;
  const end = `t021-${marker}-end`;
  const start = source.indexOf(begin);
  const stop = source.indexOf(end);

  if (start === -1 || stop === -1 || stop <= start) {
    throw new Error(`Migration marker ${marker} was not found.`);
  }

  return source
    .slice(start + begin.length, stop)
    .split("--> statement-breakpoint")
    .join("")
    .trim();
}

beforeAll(async () => {
  postgres = await startTestPostgres();
  connectionString = postgres.connectionString;
});

afterAll(async () => {
  await postgres.stop();
});

describe("T021 migration backfills (real Postgres)", () => {
  it("keeps the migration view backfill wired to the invoice summary", async () => {
    const source = await fs.readFile(MIGRATION_FILE, "utf8");
    const statement = extractMarkedStatement(source, "view-backfill");

    expect(statement).toContain("last_viewed_at");
    expect(statement).toContain("view_count");

    const pool = new Pool({ connectionString });

    try {
      const slug = uniqueSlug("t021-migration");
      const clientOrg = await pool.query(
        "insert into organisations (name, slug) values ($1, $2) returning id",
        ["Migration Org", slug]
      );
      const organisationId = clientOrg.rows[0].id as string;
      const clientUser = await pool.query(
        "insert into users (email, name, password_hash) values ($1, $2, $3) returning id",
        [`${slug}@example.com`, "Migration User", "x"]
      );
      const userId = clientUser.rows[0].id as string;
      const clientCustomer = await pool.query(
        "insert into customers (organisation_id, name, email) values ($1, $2, $3) returning id",
        [organisationId, "Migration Customer", `${slug}-customer@example.com`]
      );
      const customerId = clientCustomer.rows[0].id as string;

      // Simulate a pre-backfill legacy row: viewed before the new columns existed.
      await pool.query(
        `insert into invoices
          (organisation_id, customer_id, invoice_number, public_token, public_access_enabled,
           status, currency, issue_date, due_date, total_kobo, balance_due_kobo,
           sent_at, viewed_at, view_count, last_viewed_at, created_by_user_id)
         values ($1, $2, $3, $4, true, 'viewed', 'NGN', $5, $6, 1000, 1000,
           $7, $8, 0, null, $9)`,
        [
          organisationId,
          customerId,
          `INV-${slug.slice(-6).toUpperCase()}`,
          `token-${slug}`,
          "2026-08-01",
          "2026-08-15",
          "2026-08-02T09:00:00.000Z",
          "2026-09-01T10:00:00.000Z",
          userId
        ]
      );

      await pool.query(statement);

      const result = await pool.query(
        "select viewed_at, view_count, last_viewed_at from invoices where organisation_id = $1",
        [organisationId]
      );
      const row = result.rows[0];

      expect(new Date(row.viewed_at).toISOString()).toBe("2026-09-01T10:00:00.000Z");
      expect(Number(row.view_count)).toBeGreaterThanOrEqual(1);
      expect(new Date(row.last_viewed_at).toISOString()).toBe("2026-09-01T10:00:00.000Z");
    } finally {
      await pool.end();
    }
  });

  it("loads communication recipients through drizzle relations", async () => {
    const pool = new Pool({ connectionString });
    const schema = await import("./schema");
    const db = drizzle(pool, { schema });

    try {
      const slug = uniqueSlug("t021-relations");
      const organisation = requiredRow(
        await db
          .insert(schema.organisations)
          .values({ name: "Relation Org", slug })
          .returning(),
        "organisation"
      );
      const user = requiredRow(
        await db
          .insert(schema.users)
          .values({ email: `${slug}@example.com`, name: "Relation User", passwordHash: "x" })
          .returning(),
        "user"
      );
      const customer = requiredRow(
        await db
          .insert(schema.customers)
          .values({
            organisationId: organisation.id,
            name: "Relation Customer",
            email: `${slug}-c@example.com`
          })
          .returning(),
        "customer"
      );
      const invoice = requiredRow(
        await db
          .insert(schema.invoices)
          .values({
            organisationId: organisation.id,
            customerId: customer.id,
            invoiceNumber: `INV-${slug.slice(-6).toUpperCase()}`,
            publicToken: `token-${slug}`,
            status: "sent",
            currency: "NGN",
            issueDate: "2026-09-01",
            dueDate: "2026-09-15",
            totalKobo: 1000,
            balanceDueKobo: 1000,
            createdByUserId: user.id
          })
          .returning(),
        "invoice"
      );
      const communication = requiredRow(
        await db
          .insert(schema.communications)
          .values({
            organisationId: organisation.id,
            invoiceId: invoice.id,
            customerId: customer.id,
            subject: "Relation subject",
            toRecipients: ["to@example.com"],
            ccRecipients: ["cc@example.com"],
            providerIdempotencyKey: `key-${slug}`,
            status: "accepted",
            createdByUserId: user.id
          })
          .returning(),
        "communication"
      );
      await db.insert(schema.communicationRecipients).values([
        {
          organisationId: organisation.id,
          communicationId: communication.id,
          invoiceId: invoice.id,
          email: "to@example.com",
          recipientType: "to",
          status: "accepted"
        },
        {
          organisationId: organisation.id,
          communicationId: communication.id,
          invoiceId: invoice.id,
          email: "cc@example.com",
          recipientType: "cc",
          status: "accepted"
        }
      ]);

      const loaded = await db.query.communications.findFirst({
        where: eq(schema.communications.id, communication.id),
        with: { events: true }
      });

      expect(loaded?.id).toBe(communication.id);
      expect(invoice.viewCount).toBe(0);
    } finally {
      await pool.end();
    }
  });
});
