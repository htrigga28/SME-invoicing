import { BadGatewayException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

import type { Communication } from "../../database/schema";
import { BrevoEmailProvider } from "./brevo-email.provider";
import {
  aggregateRecipientStatuses,
  CommunicationsService,
  mapBrevoEventType,
  toDeliveryState
} from "./communications.service";
import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailText,
  defaultInvoiceEmailSubject,
  EmailUncertainError,
  normalizeRecipients,
  validateSendRecipients
} from "./email-provider";

const now = new Date("2026-09-18T10:00:00.000Z");

function createCommunication(overrides: Partial<Communication> = {}): Communication {
  return {
    id: "comm-1",
    organisationId: "org-1",
    invoiceId: "invoice-1",
    customerId: "customer-1",
    purpose: "invoice_delivery",
    channel: "email",
    provider: "brevo",
    subject: "Invoice INV-000184 from Adebayo Studio",
    toRecipients: ["accounts@northstar.example"],
    ccRecipients: [],
    providerMessageId: "<msg-1@relay.brevo.com>",
    providerIdempotencyKey: "11111111-1111-4111-8111-111111111111",
    status: "accepted",
    acceptedAt: now,
    deliveredAt: null,
    deferredAt: null,
    failedAt: null,
    failureReason: null,
    createdByUserId: "user-1",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function stubDb(queues: {
  select?: unknown[][];
  insert?: unknown[][];
  update?: unknown[][];
} = {}) {
  const selectQueue = [...(queues.select ?? [])];
  const insertQueue = [...(queues.insert ?? [])];
  const updateQueue = [...(queues.update ?? [])];

  const chain = (result: unknown) => {
    const query: Record<string, jest.Mock> & { then: unknown } = {
      values: jest.fn(() => query),
      set: jest.fn(() => query),
      where: jest.fn(() => query),
      from: jest.fn(() => query),
      orderBy: jest.fn(() => query),
      limit: jest.fn(() => query),
      onConflictDoNothing: jest.fn(() => query),
      returning: jest.fn(async () => result),
      then: undefined as unknown as never
    };
    query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return query;
  };

  const insert = jest.fn(() => chain(insertQueue.length ? insertQueue.shift() : []));
  const update = jest.fn(() => chain(updateQueue.length ? updateQueue.shift() : []));
  const select = jest.fn(() => chain(selectQueue.length ? selectQueue.shift() : []));

  const db = {
    insert,
    update,
    select,
    transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ insert, update, select })
    )
  };

  return db;
}

function setup(input: {
  db?: ReturnType<typeof stubDb>;
  config?: Record<string, string | undefined>;
  brevo?: Partial<BrevoEmailProvider>;
  audit?: { create: jest.Mock };
} = {}) {
  const db = input.db ?? stubDb();
  const configService = {
    get: jest.fn((key: string) => input.config?.[key])
  };
  const brevoEmailProvider = {
    isConfigured: jest.fn(() => true),
    getFromEmail: jest.fn(() => "billing@lumina.example"),
    sendEmail: jest.fn(async () => ({ providerMessageId: "<msg-9@relay.brevo.com>" })),
    ...(input.brevo ?? {})
  };
  const auditLogService = input.audit ?? { create: jest.fn(async () => ({})) };
  const service = new CommunicationsService(
    { db } as never,
    configService as never,
    brevoEmailProvider as never,
    auditLogService as never
  );
  return { auditLogService, brevoEmailProvider, configService, db, service };
}

describe("email recipient helpers", () => {
  it("normalizes, lowercases, and dedupes recipients", () => {
    expect(normalizeRecipients(["  A@Example.com ", "a@example.com", "b@example.com", ""])).toEqual([
      "a@example.com",
      "b@example.com"
    ]);
  });

  it("dedupes To against CC and rejects invalid addresses", () => {
    expect(validateSendRecipients(["A@Example.com"], ["a@example.com", "c@example.com"])).toEqual({
      to: ["a@example.com"],
      cc: ["c@example.com"]
    });
    expect(() => validateSendRecipients([], [])).toThrow("At least one To recipient");
    expect(() => validateSendRecipients(["not-an-email"], [])).toThrow("valid email");
    expect(() =>
      validateSendRecipients(Array.from({ length: 11 }, (_, index) => `u${index}@example.com`), [])
    ).toThrow("No more than 10 recipients");
  });

  it("builds a safe default subject", () => {
    expect(defaultInvoiceEmailSubject("INV-000184", "Adebayo Studio")).toBe(
      "Invoice INV-000184 from Adebayo Studio"
    );
  });

  it("escapes business and customer values in generated email content", () => {
    const content = {
      businessName: 'Adebayo <script>alert("x")</script>',
      customerName: "Northstar & Sons",
      invoiceNumber: "INV-000184",
      amountDueKobo: 7840000,
      currency: "NGN",
      dueDate: "30 July 2026",
      publicUrl: "http://localhost:3000/invoice/token?a=1&b=2"
    };
    const html = buildInvoiceEmailHtml(content);
    const text = buildInvoiceEmailText(content);

    expect(html).not.toContain("<script>");
    expect(html).toContain("Adebayo &lt;script&gt;");
    expect(html).toContain("Northstar &amp; Sons");
    expect(html).toContain("View invoice");
    expect(text).toContain("INV-000184");
    expect(text).toContain(content.publicUrl);
  });
});

describe("aggregateRecipientStatuses", () => {
  it("collapses single-recipient states back to the plain lifecycle", () => {
    expect(aggregateRecipientStatuses([])).toBe("pending");
    expect(aggregateRecipientStatuses(["accepted"])).toBe("accepted");
    expect(aggregateRecipientStatuses(["delivered"])).toBe("delivered");
    expect(aggregateRecipientStatuses(["failed"])).toBe("failed");
    expect(aggregateRecipientStatuses(["deferred"])).toBe("deferred");
  });

  it("derives mixed multi-recipient outcomes truthfully", () => {
    expect(aggregateRecipientStatuses(["delivered", "failed"])).toBe("partially_failed");
    expect(aggregateRecipientStatuses(["delivered", "pending"])).toBe("in_progress");
    expect(aggregateRecipientStatuses(["delivered", "deferred"])).toBe("deferred");
    expect(aggregateRecipientStatuses(["failed", "failed"])).toBe("failed");
  });
});

describe("mapBrevoEventType", () => {
  it.each([
    ["delivered", "delivered"],
    ["request", "accepted"],
    ["sent", "accepted"],
    ["deferred", "deferred"],
    ["soft_bounce", "deferred"],
    ["hard_bounce", "failed"],
    ["blocked", "failed"],
    ["invalid", "failed"],
    ["invalid_email", "failed"],
    ["error", "failed"]
  ])("maps %s to %s", (raw, outcome) => {
    expect(mapBrevoEventType(raw).outcome).toBe(outcome);
  });

  it("ignores engagement events without changing delivery state", () => {
    expect(mapBrevoEventType("opened").outcome).toBe("ignored");
    expect(mapBrevoEventType("click").outcome).toBe("ignored");
  });

  it("maps communication status to delivery display state", () => {
    expect(toDeliveryState("pending")).toBe("sending");
    expect(toDeliveryState("accepted")).toBe("accepted");
    expect(toDeliveryState("delivered")).toBe("delivered");
    expect(toDeliveryState("deferred")).toBe("delayed");
    expect(toDeliveryState("failed")).toBe("failed");
    expect(toDeliveryState("submission_uncertain")).toBe("uncertain");
    expect(toDeliveryState("in_progress")).toBe("in_progress");
    expect(toDeliveryState("partially_failed")).toBe("partially_failed");
    expect(toDeliveryState(null)).toBe("not_emailed");
  });
});

describe("CommunicationsService.sendInvoiceEmail", () => {
  const baseInput = {
    organisationId: "org-1",
    userId: "user-1",
    invoice: { id: "invoice-1", invoiceNumber: "INV-000184" },
    customerId: "customer-1",
    content: {
      customerEmail: "accounts@northstar.example",
      customerName: "Northstar Projects",
      businessName: "Adebayo Studio",
      businessEmail: "billing@adebayo.example",
      invoiceNumber: "INV-000184",
      amountDueKobo: 7840000,
      dueDate: "30 July 2026",
      publicUrl: "http://localhost:3000/invoice/token",
      to: ["accounts@northstar.example"],
      cc: ["finance@northstar.example"]
    }
  };

  it("creates a pending communication and marks it accepted with the provider message id", async () => {
    const pending = createCommunication({ status: "pending", providerMessageId: null });
    const accepted = createCommunication({ providerMessageId: "<msg-9@relay.brevo.com>" });
    const { brevoEmailProvider, db, service } = setup({
      db: stubDb({ insert: [[pending]], update: [[accepted]] })
    });

    const result = await service.sendInvoiceEmail(baseInput);

    expect(result).toEqual({
      communication: accepted,
      outcome: "accepted"
    });
    expect(brevoEmailProvider.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [{ email: "accounts@northstar.example", name: "Northstar Projects" }],
        cc: [{ email: "finance@northstar.example" }],
        tags: ["invoice_delivery", "INV-000184"],
        idempotencyKey: expect.any(String)
      })
    );
    expect(db.insert).toHaveBeenCalledTimes(2);
  });

  it("marks the communication failed and rethrows definite provider failures", async () => {
    const pending = createCommunication({ status: "pending", providerMessageId: null });
    const { db, service } = setup({
      db: stubDb({ insert: [[pending]], update: [[]] }),
      brevo: {
        sendEmail: jest.fn(async () => {
          throw new BadGatewayException("Email provider could not send the message.");
        })
      }
    });

    await expect(service.sendInvoiceEmail(baseInput)).rejects.toBeInstanceOf(BadGatewayException);
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it("records submission-uncertain instead of failed when the provider outcome is ambiguous", async () => {
    const pending = createCommunication({ status: "pending", providerMessageId: null });
    const uncertain = createCommunication({ status: "submission_uncertain" });
    const { db, service } = setup({
      db: stubDb({ insert: [[pending]], update: [[uncertain]] }),
      brevo: {
        sendEmail: jest.fn(async () => {
          throw new EmailUncertainError();
        })
      }
    });

    const result = await service.sendInvoiceEmail(baseInput);

    expect(result).toEqual({ communication: uncertain, outcome: "uncertain" });
    expect(db.update).toHaveBeenCalledTimes(1);
    const setCalls = db.update.mock.results.map(
      (result) => (result.value as { set: jest.Mock }).set
    );
    expect(setCalls[0]).toHaveBeenCalledWith(
      expect.objectContaining({ status: "submission_uncertain" })
    );
  });

  it("never marks an accepted send as failed when persistence fails afterwards", async () => {
    const pending = createCommunication({ status: "pending", providerMessageId: null });
    const { db, service } = setup({
      db: stubDb({ insert: [[pending]], update: [[]] }),
      audit: {
        create: jest.fn(async () => {
          throw new Error("audit unavailable");
        })
      }
    });

    // Simulate the accepted-state persistence failing after provider acceptance.
    db.update.mockImplementationOnce((() => {
      const query: { set: jest.Mock; where: jest.Mock; returning: jest.Mock; then: unknown } = {
        set: jest.fn(),
        where: jest.fn(),
        returning: jest.fn(),
        then: undefined
      };
      query.set.mockReturnValue(query);
      query.where.mockReturnValue(query);
      query.returning.mockRejectedValue(new Error("database unavailable"));
      return query;
    }) as () => Record<string, jest.Mock> & { then: unknown });

    await expect(service.sendInvoiceEmail(baseInput)).rejects.toThrow(
      "could not save the confirmation"
    );
    const setMock = (
      db.update.mock.results[0]?.value as unknown as { set: jest.Mock }
    ).set;
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ status: "accepted" }));
    for (const setCall of setMock.mock.calls) {
      expect(setCall[0]).not.toMatchObject({ status: "failed" });
    }
  });

  it("does not let audit failures change delivery state", async () => {
    const pending = createCommunication({ status: "pending", providerMessageId: null });
    const accepted = createCommunication({ providerMessageId: "<msg-9@relay.brevo.com>" });
    const audit = { create: jest.fn(async () => { throw new Error("audit down"); }) };
    const { service } = setup({
      db: stubDb({ insert: [[pending]], update: [[accepted]] }),
      audit
    });

    const result = await service.sendInvoiceEmail(baseInput);

    expect(result).toEqual({ communication: accepted, outcome: "accepted" });
    expect(audit.create).toHaveBeenCalled();
  });

  it("refuses to fake delivery when the provider is not configured", async () => {
    const { brevoEmailProvider, db, service } = setup({
      brevo: { isConfigured: jest.fn(() => false) }
    });

    await expect(service.sendInvoiceEmail(baseInput)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(brevoEmailProvider.sendEmail).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("reuses the idempotency key when resending an uncertain attempt", async () => {
    const uncertain = createCommunication({
      status: "submission_uncertain",
      providerIdempotencyKey: "reuse-key-1"
    });
    const accepted = createCommunication({ providerMessageId: "<msg-9@relay.brevo.com>" });
    const sendInvoiceEmail = jest.fn(async () => ({
      communication: accepted,
      outcome: "accepted" as const
    }));
    const { service } = setup({
      db: stubDb({ select: [[uncertain]] })
    });
    service.sendInvoiceEmail = sendInvoiceEmail;

    const result = await service.resendInvoiceEmail(baseInput);

    expect(result).toEqual({ communication: accepted, outcome: "accepted" });
    expect(sendInvoiceEmail).toHaveBeenCalledWith(
      baseInput,
      expect.objectContaining({ idempotencyKey: "reuse-key-1" })
    );
  });

  it("mints a fresh idempotency key when the latest attempt is not uncertain", async () => {
    const delivered = createCommunication({
      status: "delivered",
      providerIdempotencyKey: "old-key-1"
    });
    const accepted = createCommunication({ providerMessageId: "<msg-9@relay.brevo.com>" });
    const sendInvoiceEmail = jest.fn(async () => ({
      communication: accepted,
      outcome: "accepted" as const
    }));
    const { service } = setup({
      db: stubDb({ select: [[delivered]] })
    });
    service.sendInvoiceEmail = sendInvoiceEmail;

    await service.resendInvoiceEmail(baseInput);

    expect(sendInvoiceEmail).toHaveBeenCalledWith(baseInput, undefined);
  });
});

describe("CommunicationsService.processBrevoWebhook", () => {
  const secret = "webhook-secret";

  function createRecipient(overrides: Record<string, unknown> = {}) {
    return {
      id: "recipient-1",
      organisationId: "org-1",
      communicationId: "comm-1",
      invoiceId: "invoice-1",
      email: "accounts@northstar.example",
      recipientType: "to",
      status: "accepted",
      acceptedAt: now,
      deliveredAt: null,
      deferredAt: null,
      failedAt: null,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  it("rejects requests without a configured or matching secret", async () => {
    const { service } = setup({ config: {} });
    await expect(
      service.processBrevoWebhook("anything", { event: "delivered" })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const { service: secured } = setup({ config: { BREVO_WEBHOOK_SECRET: secret } });
    await expect(secured.processBrevoWebhook("wrong", { event: "delivered" })).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("handles unknown message ids and malformed payloads safely", async () => {
    const { service } = setup({
      config: { BREVO_WEBHOOK_SECRET: secret },
      db: stubDb({ select: [[]] })
    });

    await expect(
      service.processBrevoWebhook(secret, {
        event: "delivered",
        "message-id": "<unknown@relay.brevo.com>"
      })
    ).resolves.toEqual({ received: true, unknown: true });
    await expect(service.processBrevoWebhook(secret, {})).resolves.toEqual({
      received: true,
      ignored: true
    });
  });

  it("ignores replayed events without touching delivery state", async () => {
    const { db, service } = setup({
      config: { BREVO_WEBHOOK_SECRET: secret },
      db: stubDb({ select: [[createCommunication()]], insert: [[]] })
    });

    await expect(
      service.processBrevoWebhook(secret, {
        event: "delivered",
        "message-id": "<msg-1@relay.brevo.com>",
        ts_event: 1758192000
      })
    ).resolves.toEqual({ received: true, duplicate: true });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("never trusts tenant identity from the webhook payload", async () => {
    const communication = createCommunication({ status: "accepted" });
    const { db, service } = setup({
      config: { BREVO_WEBHOOK_SECRET: secret },
      db: stubDb({
        select: [[communication], [], []],
        insert: [[{ id: "event-1" }]],
        update: [[{ id: "recipient-1" }]]
      })
    });

    const result = await service.processBrevoWebhook(secret, {
      event: "delivered",
      email: "attacker@example.com",
      "message-id": "<msg-1@relay.brevo.com>",
      organisationId: "attacker-org"
    } as never);

    expect(result).toEqual({ received: true });
    // Recipient lookup misses (no row for the attacker address), so the
    // legacy fallback advances the stored communication instead.
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it("advances one recipient and derives a delivered aggregate", async () => {
    const communication = createCommunication({ status: "accepted" });
    const recipient = createRecipient({ status: "accepted" });
    const { db, service } = setup({
      config: { BREVO_WEBHOOK_SECRET: secret },
      db: stubDb({
        select: [[communication], [recipient], [communication], [{ ...recipient, status: "delivered" }]],
        insert: [[{ id: "event-1" }]],
        update: [[{ id: "recipient-1" }], [{ id: "comm-1" }]]
      })
    });

    await expect(
      service.processBrevoWebhook(secret, {
        event: "delivered",
        email: "accounts@northstar.example",
        "message-id": "<msg-1@relay.brevo.com>"
      })
    ).resolves.toEqual({ received: true });

    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it("keeps a delivered recipient delivered when a late failure arrives", async () => {
    const communication = createCommunication({ status: "delivered" });
    const recipient = createRecipient({ status: "delivered" });
    const { db, service } = setup({
      config: { BREVO_WEBHOOK_SECRET: secret },
      db: stubDb({
        select: [[communication], [recipient]],
        insert: [[{ id: "event-2" }]],
        update: []
      })
    });

    await expect(
      service.processBrevoWebhook(secret, {
        event: "hard_bounce",
        email: "accounts@northstar.example",
        "message-id": "<msg-1@relay.brevo.com>"
      })
    ).resolves.toEqual({ received: true });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("represents mixed recipient outcomes as partially failed", async () => {
    const communication = createCommunication({ status: "accepted" });
    const failedRecipient = createRecipient({
      id: "recipient-bounce",
      email: "bounce@example.com",
      status: "accepted"
    });
    const { db, service } = setup({
      config: { BREVO_WEBHOOK_SECRET: secret },
      db: stubDb({
        select: [
          [communication],
          [failedRecipient],
          [communication],
          [createRecipient({ status: "delivered" }), { ...failedRecipient, status: "failed" }]
        ],
        insert: [[{ id: "event-3" }]],
        update: [[{ id: "recipient-bounce" }], [{ id: "comm-1" }]]
      })
    });

    await expect(
      service.processBrevoWebhook(secret, {
        event: "hard_bounce",
        email: "bounce@example.com",
        "message-id": "<msg-1@relay.brevo.com>"
      })
    ).resolves.toEqual({ received: true });

    expect(db.update).toHaveBeenCalledTimes(2);
  });
});

describe("CommunicationsService.recordInvoiceViewEvent", () => {
  it("inserts a view event and increments the invoice view summary", async () => {
    const { db, service } = setup({
      db: stubDb({ insert: [[{ id: "view-1" }]], update: [[{ viewCount: 4 }]] })
    });

    await expect(service.recordInvoiceViewEvent("org-1", "invoice-1")).resolves.toEqual(
      expect.objectContaining({ viewCount: 4 })
    );
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.update).toHaveBeenCalledTimes(1);
  });
});
