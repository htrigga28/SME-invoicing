import { createHmac } from "crypto";
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

const webhookSecret = "whsec_dGVzdC13ZWJob29rLXNlY3JldA==";

function configStub() {
  return {
    get: jest.fn((key: string) => (key === "RESEND_WEBHOOK_SECRET" ? webhookSecret : undefined))
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

let resendEventSequence = 0;

function resendInput(emailId: string, type: string, to: string[]) {
  resendEventSequence += 1;
  const svixId = `msg_concurrency_${resendEventSequence}`;
  const payload = {
    type,
    created_at: new Date().toISOString(),
    data: {
      email_id: emailId,
      from: "billing@lumina.example",
      to,
      subject: "Invoice INV-000184 from Adebayo Studio",
      tags: [{ name: "invoice_delivery", value: "invoice_delivery" }]
    }
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = new Date();
  const stripped = webhookSecret.startsWith("whsec_")
    ? webhookSecret.slice("whsec_".length)
    : webhookSecret;
  const signature = createHmac("sha256", Buffer.from(stripped, "base64"))
    .update(`${svixId}.${Math.floor(timestamp.getTime() / 1000)}.${rawBody}`)
    .digest("base64");
  return {
    headers: {
      svixId,
      svixTimestamp: Math.floor(timestamp.getTime() / 1000).toString(),
      svixSignature: `v1,${signature}`
    },
    rawBody,
    payload
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
  const emailId = `email-${slug}`;
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
        providerMessageId: emailId,
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

  return { communication, invoice, emailId, organisation };
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

describe("Resend webhook concurrency (real Postgres)", () => {
  it("converges concurrent delivered/delayed events on delivered", async () => {
    const service = communicationsService();
    const { communication, emailId } = await seedDeliveryFixture({
      status: "accepted",
      recipientEmails: ["accounts@northstar.example"]
    });

    const [first, second] = await Promise.all([
      service.processResendWebhook(resendInput(emailId, "email.delivered", ["accounts@northstar.example"])),
      service.processResendWebhook(resendInput(emailId, "email.delivery_delayed", ["accounts@northstar.example"]))
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
    const { communication, emailId } = await seedDeliveryFixture({
      status: "accepted",
      recipientEmails: ["accounts@northstar.example", "bounce@example.com"]
    });

    await Promise.all([
      service.processResendWebhook(resendInput(emailId, "email.delivered", ["accounts@northstar.example"])),
      service.processResendWebhook(resendInput(emailId, "email.bounced", ["bounce@example.com"]))
    ]);

    expect(await recipientStates(communication.id)).toEqual([
      { email: "accounts@northstar.example", status: "delivered" },
      { email: "bounce@example.com", status: "failed" }
    ]);
    expect(await parentStatus(communication.id)).toBe("partially_failed");
    expect(await eventCount(communication.id)).toBe(2);
  });

  it("maps a realistic bounce payload to a safe recipient failure", async () => {
    const service = communicationsService();
    const { communication, emailId } = await seedDeliveryFixture({
      status: "accepted",
      recipientEmails: ["typo@example.com"]
    });

    const result = await service.processResendWebhook(
      resendInput(emailId, "email.bounced", ["typo@example.com"])
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
    expect(recipient?.failureReason).toContain("bounced");
  });

  it("stores same-second events for two recipients as distinct rows", async () => {
    const service = communicationsService();
    const { communication, emailId } = await seedDeliveryFixture({
      status: "accepted",
      recipientEmails: ["one@example.com", "two@example.com"]
    });

    await Promise.all([
      service.processResendWebhook(resendInput(emailId, "email.delivered", ["one@example.com"])),
      service.processResendWebhook(resendInput(emailId, "email.delivered", ["two@example.com"]))
    ]);

    expect(await eventCount(communication.id)).toBe(2);
    expect(await parentStatus(communication.id)).toBe("delivered");
  });

  it("treats an exact replay as a duplicate without touching state", async () => {
    const service = communicationsService();
    const { communication, emailId } = await seedDeliveryFixture({
      status: "accepted",
      recipientEmails: ["accounts@northstar.example"]
    });
    const replay = resendInput(emailId, "email.delivered", ["accounts@northstar.example"]);

    await expect(service.processResendWebhook(replay)).resolves.toEqual({
      received: true
    });
    await expect(service.processResendWebhook(replay)).resolves.toEqual({
      received: true,
      duplicate: true
    });
    expect(await eventCount(communication.id)).toBe(1);
    expect(await parentStatus(communication.id)).toBe("delivered");
  });

  it("does not regress a delivered recipient when a late delayed event arrives", async () => {
    const service = communicationsService();
    const { communication, emailId } = await seedDeliveryFixture({
      status: "delivered",
      recipientEmails: ["accounts@northstar.example"]
    });
    await db
      .update(communicationRecipients)
      .set({ status: "delivered", deliveredAt: new Date("2026-09-18T10:05:00.000Z") })
      .where(eq(communicationRecipients.communicationId, communication.id));

    const result = await service.processResendWebhook(
      resendInput(emailId, "email.delivery_delayed", ["accounts@northstar.example"])
    );

    expect(result).toEqual({ received: true });
    expect(await recipientStates(communication.id)).toEqual([
      { email: "accounts@northstar.example", status: "delivered" }
    ]);
    expect(await parentStatus(communication.id)).toBe("delivered");
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("cannot mutate another communication through a foreign recipient address", async () => {
    const service = communicationsService();
    const first = await seedDeliveryFixture({
      status: "accepted",
      recipientEmails: ["accounts@northstar.example"]
    });
    const second = await seedDeliveryFixture({
      status: "accepted",
      recipientEmails: ["other@example.com"]
    });

    const result = await service.processResendWebhook(
      resendInput(second.emailId, "email.delivered", ["accounts@northstar.example"])
    );

    expect(result).toEqual({ received: true });
    expect(await recipientStates(first.communication.id)).toEqual([
      { email: "accounts@northstar.example", status: "accepted" }
    ]);
    expect(await parentStatus(first.communication.id)).toBe("accepted");
    expect(await parentStatus(second.communication.id)).toBe("accepted");
  });
});
