import { eq } from "drizzle-orm";

import { ConfigService } from "@nestjs/config";

import { DatabaseService, type AppDatabase } from "../../database/database.service";
import {
  communicationEvents,
  communicationRecipients,
  communications,
  customers,
  invoices,
  organisations,
  users,
  type Communication
} from "../../database/schema";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CommunicationsService } from "./communications.service";
import {
  requiredRow,
  startApiTestPool,
  uniqueSlug,
  type ApiTestPool
} from "../../test/postgres-test-helper";

jest.setTimeout(180000);

let pool: ApiTestPool;

let db: AppDatabase;
let auditCreate: jest.Mock;

let databaseService: () => DatabaseService;

function configStub() {
  return {
    get: jest.fn((key: string) =>
      key === "BREVO_WEBHOOK_SECRET" ? "test-webhook-secret" : undefined
    )
  } as unknown as ConfigService;
}

function communicationsService() {
  return new CommunicationsService(
    databaseService(),
    configStub(),
    {} as never,
    { create: auditCreate } as unknown as AuditLogService
  );
}

let brevoEventSequence = 0;

function brevoPayload(messageId: string, event: string, email: string, ts: number) {
  brevoEventSequence += 1;
  return {
    event,
    email,
    id: `evt-${Date.now().toString(36)}-${brevoEventSequence}`,
    date: "2026-09-18 10:00:00",
    ts,
    "message-id": messageId,
    ts_event: ts,
    subject: "Invoice INV-000184 from Adebayo Studio",
    tag: '["invoice_delivery"]',
    sending_ip: "185.41.28.109",
    tags: ["invoice_delivery"]
  };
}

async function seedDeliveryFixture(input: {
  status: Communication["status"];
  recipientEmails: string[];
}) {
  const slug = uniqueSlug("t021-webhook");
  const organisation = requiredRow(
    await db.insert(organisations).values({ name: "Webhook Org", slug }).returning(),
    "organisation"
  );
  const user = requiredRow(
    await db
      .insert(users)
      .values({ email: `${slug}@example.com`, name: "Webhook User", passwordHash: "x" })
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
  const invoice = requiredRow(
    await db
      .insert(invoices)
      .values({
        organisationId: organisation.id,
        customerId: customer.id,
        invoiceNumber: `INV-${slug.slice(-6).toUpperCase()}`,
        publicToken: `token-${slug}`,
        publicAccessEnabled: true,
        status: "sent",
        currency: "NGN",
        issueDate: "2026-09-01",
        dueDate: "2026-09-15",
        subtotalKobo: 1000,
        totalKobo: 1000,
        balanceDueKobo: 1000
      })
      .returning(),
    "invoice"
  );
  const messageId = `<${slug}@relay.brevo.com>`;
  const communication = requiredRow(
    await db
      .insert(communications)
      .values({
        organisationId: organisation.id,
        invoiceId: invoice.id,
        customerId: customer.id,
        subject: "Invoice",
        toRecipients: input.recipientEmails,
        ccRecipients: [],
        providerMessageId: messageId,
        providerIdempotencyKey: `key-${slug}`,
        status: input.status,
        acceptedAt: new Date("2026-09-18T10:00:00.000Z"),
        createdByUserId: user.id
      })
      .returning(),
    "communication"
  );

  for (const email of input.recipientEmails) {
    await db.insert(communicationRecipients).values({
      organisationId: organisation.id,
      communicationId: communication.id,
      invoiceId: invoice.id,
      email,
      recipientType: "to",
      status: "accepted",
      acceptedAt: new Date("2026-09-18T10:00:00.000Z")
    });
  }

  return { communication, invoice, messageId, organisation };
}

async function recipientStates(communicationId: string) {
  return db
    .select({
      email: communicationRecipients.email,
      status: communicationRecipients.status
    })
    .from(communicationRecipients)
    .where(eq(communicationRecipients.communicationId, communicationId))
    .orderBy(communicationRecipients.email);
}

async function parentStatus(communicationId: string) {
  const [row] = await db
    .select({ status: communications.status })
    .from(communications)
    .where(eq(communications.id, communicationId))
    .limit(1);
  return row?.status;
}

async function eventCount(communicationId: string) {
  const rows = await db
    .select({ id: communicationEvents.id })
    .from(communicationEvents)
    .where(eq(communicationEvents.communicationId, communicationId));
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

beforeEach(() => {
  auditCreate = jest.fn(async () => ({}));
});

describe("Brevo webhook concurrency (real Postgres)", () => {
  it("converges concurrent delivered/deferred events on delivered", async () => {
    const service = communicationsService();
    const { communication, messageId } = await seedDeliveryFixture({
      status: "accepted",
      recipientEmails: ["accounts@northstar.example"]
    });
    const ts = Math.floor(Date.now() / 1000);

    const [first, second] = await Promise.all([
      service.processBrevoWebhook("test-webhook-secret", brevoPayload(messageId, "delivered", "accounts@northstar.example", ts)),
      service.processBrevoWebhook("test-webhook-secret", brevoPayload(messageId, "deferred", "accounts@northstar.example", ts + 1))
    ]);

    expect(first).toEqual({ received: true });
    expect(second).toEqual({ received: true });
    expect(await recipientStates(communication.id)).toEqual([
      { email: "accounts@northstar.example", status: "delivered" }
    ]);
    expect(await parentStatus(communication.id)).toBe("delivered");
    expect(await eventCount(communication.id)).toBe(2);
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: "invoice_email_delivered" })
    );
  });

  it("aggregates mixed recipient outcomes to partially failed without cross-contamination", async () => {
    const service = communicationsService();
    const { communication, messageId } = await seedDeliveryFixture({
      status: "accepted",
      recipientEmails: ["accounts@northstar.example", "bounce@example.com"]
    });
    const ts = Math.floor(Date.now() / 1000);

    await Promise.all([
      service.processBrevoWebhook("test-webhook-secret", brevoPayload(messageId, "delivered", "accounts@northstar.example", ts)),
      service.processBrevoWebhook("test-webhook-secret", brevoPayload(messageId, "hard_bounce", "bounce@example.com", ts))
    ]);

    expect(await recipientStates(communication.id)).toEqual([
      { email: "accounts@northstar.example", status: "delivered" },
      { email: "bounce@example.com", status: "failed" }
    ]);
    expect(await parentStatus(communication.id)).toBe("partially_failed");
    expect(await eventCount(communication.id)).toBe(2);
  });

  it("maps a realistic invalid_email payload to a safe recipient failure", async () => {
    const service = communicationsService();
    const { communication, messageId } = await seedDeliveryFixture({
      status: "accepted",
      recipientEmails: ["typo@example.com"]
    });

    const result = await service.processBrevoWebhook(
      "test-webhook-secret",
      brevoPayload(messageId, "invalid_email", "typo@example.com", Math.floor(Date.now() / 1000))
    );

    expect(result).toEqual({ received: true });
    expect(await recipientStates(communication.id)).toEqual([
      { email: "typo@example.com", status: "failed" }
    ]);
    expect(await parentStatus(communication.id)).toBe("failed");

    const recipient = requiredRow(
      await db
        .select({ failureReason: communicationRecipients.failureReason })
        .from(communicationRecipients)
        .where(eq(communicationRecipients.communicationId, communication.id))
        .limit(1),
      "recipient"
    );
    expect(recipient?.failureReason).toContain("invalid");
  });

  it("stores same-second events for two recipients as distinct rows", async () => {
    const service = communicationsService();
    const { communication, messageId } = await seedDeliveryFixture({
      status: "accepted",
      recipientEmails: ["one@example.com", "two@example.com"]
    });
    const ts = Math.floor(Date.now() / 1000);

    await Promise.all([
      service.processBrevoWebhook("test-webhook-secret", brevoPayload(messageId, "delivered", "one@example.com", ts)),
      service.processBrevoWebhook("test-webhook-secret", brevoPayload(messageId, "delivered", "two@example.com", ts))
    ]);

    expect(await eventCount(communication.id)).toBe(2);
    expect(await parentStatus(communication.id)).toBe("delivered");
  });

  it("treats an exact replay as a duplicate without touching state", async () => {
    const service = communicationsService();
    const { communication, messageId } = await seedDeliveryFixture({
      status: "accepted",
      recipientEmails: ["accounts@northstar.example"]
    });
    const ts = Math.floor(Date.now() / 1000);
    const payload = brevoPayload(messageId, "delivered", "accounts@northstar.example", ts);

    await expect(service.processBrevoWebhook("test-webhook-secret", payload)).resolves.toEqual({
      received: true
    });
    await expect(service.processBrevoWebhook("test-webhook-secret", payload)).resolves.toEqual({
      received: true,
      duplicate: true
    });
    expect(await eventCount(communication.id)).toBe(1);
    expect(await parentStatus(communication.id)).toBe("delivered");
  });

  it("does not regress a delivered recipient when a late deferred event arrives", async () => {
    const service = communicationsService();
    const { communication, messageId } = await seedDeliveryFixture({
      status: "delivered",
      recipientEmails: ["accounts@northstar.example"]
    });
    await db
      .update(communicationRecipients)
      .set({ status: "delivered", deliveredAt: new Date("2026-09-18T10:05:00.000Z") })
      .where(eq(communicationRecipients.communicationId, communication.id));

    const result = await service.processBrevoWebhook(
      "test-webhook-secret",
      brevoPayload(messageId, "deferred", "accounts@northstar.example", Math.floor(Date.now() / 1000))
    );

    expect(result).toEqual({ received: true });
    expect(await recipientStates(communication.id)).toEqual([
      { email: "accounts@northstar.example", status: "delivered" }
    ]);
    expect(await parentStatus(communication.id)).toBe("delivered");
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
