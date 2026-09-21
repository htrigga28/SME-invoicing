import {
  BadGatewayException,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";

import type { Communication } from "../../database/schema";

const mockRandomUUID = jest.fn(() => "test-claim-token");
jest.mock("crypto", () => {
  const actual = jest.requireActual("crypto") as Record<string, unknown>;
  return {
    ...actual,
    randomUUID: (...args: unknown[]) =>
      (mockRandomUUID as unknown as (...callArgs: unknown[]) => string)(...args)
  };
});
import { createHmac } from "crypto";

import type { ResendWebhookPayload } from "./communications.service";
import {
  aggregateRecipientStatuses,
  CommunicationsService,
  mapResendEventType,
  toDeliveryState
} from "./communications.service";
import { ResendEmailProvider } from "./resend-email.provider";
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
    provider: "resend",
    subject: "Invoice INV-000184 from Adebayo Studio",
    toRecipients: ["accounts@northstar.example"],
    ccRecipients: [],
    providerMessageId: "email-id-1",
    providerIdempotencyKey: "11111111-1111-4111-8111-111111111111",
    idempotencyExpiresAt: null,
    providerRequestSnapshot: null,
    retryClaimToken: null,
    retryClaimedAt: null,
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

function stubDb(
  queues: {
    select?: unknown[][];
    insert?: unknown[][];
    update?: unknown[][];
  } = {}
) {
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
  const execute = jest.fn(async () => []);

  const db = {
    insert,
    update,
    select,
    execute,
    transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ insert, update, select, execute })
    )
  };

  return db;
}

function setup(
  input: {
    db?: ReturnType<typeof stubDb>;
    config?: Record<string, string | undefined>;
    resend?: Partial<ResendEmailProvider>;
    audit?: { create: jest.Mock };
  } = {}
) {
  mockRandomUUID.mockReset();
  mockRandomUUID.mockReturnValue("test-claim-token");
  const db = input.db ?? stubDb();
  const configService = {
    get: jest.fn((key: string) => input.config?.[key])
  };
  const resendEmailProvider = {
    isConfigured: jest.fn(() => true),
    getFromEmail: jest.fn(() => "billing@lumina.example"),
    sendEmail: jest.fn(async () => ({ providerMessageId: "email-id-9" })),
    ...(input.resend ?? {})
  };
  const auditLogService = input.audit ?? { create: jest.fn(async () => ({})) };
  const service = new CommunicationsService(
    { db } as never,
    configService as never,
    resendEmailProvider as never,
    auditLogService as never
  );
  return { auditLogService, resendEmailProvider, configService, db, service };
}

describe("email recipient helpers", () => {
  it("normalizes, lowercases, and dedupes recipients", () => {
    expect(normalizeRecipients(["  A@Example.com ", "a@example.com", "b@example.com", ""])).toEqual(
      ["a@example.com", "b@example.com"]
    );
  });

  it("dedupes To against CC and rejects invalid addresses", () => {
    expect(validateSendRecipients(["A@Example.com"], ["a@example.com", "c@example.com"])).toEqual({
      to: ["a@example.com"],
      cc: ["c@example.com"]
    });
    expect(() => validateSendRecipients([], [])).toThrow("At least one To recipient");
    expect(() => validateSendRecipients(["not-an-email"], [])).toThrow("valid email");
    expect(() =>
      validateSendRecipients(
        Array.from({ length: 11 }, (_, index) => `u${index}@example.com`),
        []
      )
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

describe("mapResendEventType", () => {
  it.each([
    ["email.sent", "accepted"],
    ["email.delivered", "delivered"],
    ["email.delivery_delayed", "deferred"],
    ["email.bounced", "failed"],
    ["email.failed", "failed"],
    ["email.complained", "failed"],
    ["email.suppressed", "failed"]
  ])("maps %s to %s", (raw, outcome) => {
    expect(mapResendEventType(raw).outcome).toBe(outcome);
  });

  it("ignores engagement events without changing delivery state", () => {
    expect(mapResendEventType("email.opened").outcome).toBe("ignored");
    expect(mapResendEventType("email.clicked").outcome).toBe("ignored");
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
    const claimedPending = createCommunication({
      status: "pending",
      providerMessageId: null,
      retryClaimToken: "test-claim-token"
    });
    const accepted = createCommunication({ providerMessageId: "email-id-9" });
    const { resendEmailProvider, db, service } = setup({
      db: stubDb({
        insert: [[claimedPending]],
        select: [[claimedPending], [], [accepted]],
        update: [[accepted], []]
      })
    });

    const result = await service.sendInvoiceEmail(baseInput);

    expect(result).toEqual({
      communication: accepted,
      outcome: "accepted"
    });
    expect(resendEmailProvider.sendEmail).toHaveBeenCalledWith(
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
    const claimedPending = createCommunication({
      status: "pending",
      providerMessageId: null,
      retryClaimToken: "test-claim-token"
    });
    const { db, service } = setup({
      db: stubDb({
        insert: [[pending]],
        select: [[claimedPending]],
        update: [[{ id: "comm-1" }], []]
      }),
      resend: {
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
    const claimedPending = createCommunication({
      status: "pending",
      providerMessageId: null,
      retryClaimToken: "test-claim-token"
    });
    const uncertain = createCommunication({ status: "submission_uncertain" });
    const { db, service } = setup({
      db: stubDb({
        insert: [[pending]],
        select: [[claimedPending]],
        update: [[uncertain]]
      }),
      resend: {
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
    const claimedPending = createCommunication({
      status: "pending",
      providerMessageId: null,
      retryClaimToken: "test-claim-token"
    });
    const { db, service } = setup({
      db: stubDb({
        insert: [[pending]],
        select: [[claimedPending]],
        update: [[]]
      }),
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
    const setMock = (db.update.mock.results[0]?.value as unknown as { set: jest.Mock }).set;
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ status: "accepted" }));
    for (const setCall of setMock.mock.calls) {
      expect(setCall[0]).not.toMatchObject({ status: "failed" });
    }
  });

  it("does not let audit failures change delivery state", async () => {
    const claimedPending = createCommunication({
      status: "pending",
      providerMessageId: null,
      retryClaimToken: "test-claim-token"
    });
    const accepted = createCommunication({ providerMessageId: "email-id-9" });
    const audit = {
      create: jest.fn(async () => {
        throw new Error("audit down");
      })
    };
    const { service } = setup({
      db: stubDb({
        insert: [[claimedPending]],
        select: [[claimedPending], [], [accepted]],
        update: [[accepted], []]
      }),
      audit
    });

    const result = await service.sendInvoiceEmail(baseInput);

    expect(result).toEqual({ communication: accepted, outcome: "accepted" });
    expect(audit.create).toHaveBeenCalled();
  });

  it("refuses to fake delivery when the provider is not configured", async () => {
    const { resendEmailProvider, db, service } = setup({
      resend: { isConfigured: jest.fn(() => false) }
    });

    await expect(service.sendInvoiceEmail(baseInput)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(resendEmailProvider.sendEmail).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("always creates a new attempt on explicit resend after a resolved attempt", async () => {
    const delivered = createCommunication({
      status: "delivered",
      providerIdempotencyKey: "old-key-1"
    });
    const accepted = createCommunication({ providerMessageId: "email-id-9" });
    const sendInvoiceEmail = jest.fn(async () => ({
      communication: accepted,
      outcome: "accepted" as const
    }));
    const { service } = setup({
      db: stubDb({ select: [[delivered]] })
    });
    service.sendInvoiceEmail = sendInvoiceEmail;

    const result = await service.resendInvoiceEmail(baseInput);

    expect(result).toEqual({ communication: accepted, outcome: "accepted" });
    expect(sendInvoiceEmail).toHaveBeenCalledWith(baseInput);
  });

  it("refuses explicit resend while an attempt is unresolved", async () => {
    const uncertain = createCommunication({
      status: "submission_uncertain",
      providerIdempotencyKey: "reuse-key-1"
    });
    const sendInvoiceEmail = jest.fn();
    const { service } = setup({
      db: stubDb({ select: [[uncertain]] })
    });
    service.sendInvoiceEmail = sendInvoiceEmail;

    await expect(service.resendInvoiceEmail(baseInput)).rejects.toThrow("still unresolved");
    expect(sendInvoiceEmail).not.toHaveBeenCalled();
  });

  it("forces another send with audit when explicitly requested", async () => {
    const uncertain = createCommunication({
      status: "submission_uncertain",
      providerIdempotencyKey: "reuse-key-1"
    });
    const accepted = createCommunication({ providerMessageId: "email-id-9" });
    const sendInvoiceEmail = jest.fn(async () => ({
      communication: accepted,
      outcome: "accepted" as const
    }));
    const audit = { create: jest.fn(async () => ({})) };
    const { service } = setup({
      db: stubDb({ select: [[uncertain]] }),
      audit
    });
    service.sendInvoiceEmail = sendInvoiceEmail;

    const result = await service.resendInvoiceEmail(baseInput, { force: true });

    expect(result).toEqual({ communication: accepted, outcome: "accepted" });
    expect(sendInvoiceEmail).toHaveBeenCalledWith(baseInput);
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: "invoice_email_force_resend" })
    );
  });
});

describe("CommunicationsService.retryUncertainAttempt", () => {
  const snapshot = {
    fromEmail: "billing@lumina.example",
    fromName: "Adebayo Studio via Lumina",
    replyToEmail: "billing@adebayo.example",
    to: [{ email: "accounts@northstar.example", name: "Northstar Projects" }],
    cc: [{ email: "finance@northstar.example" }],
    subject: "Invoice INV-000184 from Adebayo Studio",
    htmlContent: "<p>Invoice INV-000184</p>",
    textContent: "Invoice INV-000184",
    tags: ["invoice_delivery", "INV-000184"],
    correlationId: "comm-1"
  };

  function uncertainRow(overrides: Record<string, unknown> = {}) {
    return createCommunication({
      status: "submission_uncertain",
      providerMessageId: null,
      providerIdempotencyKey: "reuse-key-1",
      idempotencyExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      providerRequestSnapshot: snapshot,
      ...overrides
    });
  }

  const retryInput = {
    organisationId: "org-1",
    userId: "user-1",
    invoice: { id: "invoice-1", invoiceNumber: "INV-000184" },
    communicationId: "comm-1"
  };

  it("replays the stored snapshot with the original key inside the window", async () => {
    const row = uncertainRow();
    const claimed = { ...row, retryClaimToken: "test-claim-token" };
    const accepted = createCommunication({
      status: "accepted",
      providerMessageId: "email-id-9",
      retryClaimToken: null,
      retryClaimedAt: null
    });
    const { resendEmailProvider, service } = setup({
      db: stubDb({
        select: [[row], [claimed], [], [accepted]],
        update: [[claimed], [accepted], []]
      })
    });

    const result = await service.retryUncertainAttempt(retryInput);

    expect(result).toEqual({ communication: accepted, outcome: "accepted" });
    expect(resendEmailProvider.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: snapshot.subject,
        htmlContent: snapshot.htmlContent,
        textContent: snapshot.textContent,
        to: snapshot.to,
        cc: snapshot.cc,
        idempotencyKey: "reuse-key-1",
        correlationId: "comm-1"
      })
    );
  });

  it("refuses retry after the 24-hour idempotency window", async () => {
    const row = uncertainRow({ idempotencyExpiresAt: new Date(Date.now() - 1000) });
    const { resendEmailProvider, service } = setup({
      db: stubDb({ select: [[row]] })
    });

    await expect(service.retryUncertainAttempt(retryInput)).rejects.toThrow("idempotency window");
    expect(resendEmailProvider.sendEmail).not.toHaveBeenCalled();
  });

  it("refuses retry for resolved attempts", async () => {
    const row = uncertainRow({ status: "delivered" });
    const { resendEmailProvider, service } = setup({
      db: stubDb({ select: [[row]] })
    });

    await expect(service.retryUncertainAttempt(retryInput)).rejects.toThrow("Only unresolved");
    expect(resendEmailProvider.sendEmail).not.toHaveBeenCalled();
  });

  it("refuses retry without a stored snapshot", async () => {
    const row = uncertainRow({ providerRequestSnapshot: null });
    const { resendEmailProvider, service } = setup({
      db: stubDb({ select: [[row]] })
    });

    await expect(service.retryUncertainAttempt(retryInput)).rejects.toThrow("no replayable");
    expect(resendEmailProvider.sendEmail).not.toHaveBeenCalled();
  });

  it("returns uncertain when the retry claim is lost", async () => {
    const row = uncertainRow();
    const { resendEmailProvider, service } = setup({
      db: stubDb({ select: [[row], [row]], update: [[]] })
    });

    const result = await service.retryUncertainAttempt(retryInput);

    expect(result).toEqual({ communication: row, outcome: "uncertain" });
    expect(resendEmailProvider.sendEmail).not.toHaveBeenCalled();
  });
});

describe("CommunicationsService.processResendWebhook", () => {
  const secret = "whsec_dGVzdC13ZWJob29rLXNlY3JldA==";
  let svixSequence = 0;

  function resendPayload(
    emailId: string | null,
    type: string,
    to: string[],
    tags: Record<string, string> = { invoice_delivery: "invoice_delivery" }
  ): ResendWebhookPayload {
    return {
      type,
      created_at: "2026-09-18T10:00:00.000Z",
      data: {
        email_id: emailId,
        message_id: "<resend-test-message-id>",
        from: "billing@lumina.example",
        to,
        subject: "Invoice INV-000184 from Adebayo Studio",
        tags
      }
    };
  }

  function signPayload(messageId: string, timestamp: Date, rawBody: string): string {
    const stripped = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
    const signature = createHmac("sha256", Buffer.from(stripped, "base64"))
      .update(`${messageId}.${Math.floor(timestamp.getTime() / 1000)}.${rawBody}`)
      .digest("base64");
    return `v1,${signature}`;
  }

  function signedInput(payload: ResendWebhookPayload, svixId?: string) {
    svixSequence += 1;
    const messageId = svixId ?? `msg_test_${svixSequence}`;
    const rawBody = JSON.stringify(payload);
    const timestamp = new Date();
    return {
      headers: {
        svixId: messageId,
        svixTimestamp: Math.floor(timestamp.getTime() / 1000).toString(),
        svixSignature: signPayload(messageId, timestamp, rawBody)
      },
      rawBody,
      payload
    };
  }

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

  async function runWebhook(input: {
    select: unknown[][];
    insert?: unknown[][];
    update?: unknown[][];
    payload: ResendWebhookPayload;
    svixId?: string;
  }) {
    const { db, service } = setup({
      config: { RESEND_WEBHOOK_SECRET: secret },
      db: stubDb({
        select: input.select,
        insert: input.insert ?? [[{ id: "event-1" }]],
        update: input.update ?? []
      })
    });
    const result = await service.processResendWebhook(signedInput(input.payload, input.svixId));
    return { db, result };
  }

  it("rejects unsigned requests and fails closed without a secret", async () => {
    const { service } = setup({ config: {} });
    await expect(
      service.processResendWebhook(
        signedInput(resendPayload("email-id-1", "email.delivered", ["accounts@northstar.example"]))
      )
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    const { service: secured } = setup({ config: { RESEND_WEBHOOK_SECRET: secret } });
    const forged = signedInput(
      resendPayload("email-id-1", "email.delivered", ["accounts@northstar.example"])
    );
    await expect(
      secured.processResendWebhook({
        ...forged,
        headers: {
          ...forged.headers,
          svixSignature: "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        }
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("handles unknown email ids and unsigned event identity safely", async () => {
    const { service } = setup({
      config: { RESEND_WEBHOOK_SECRET: secret },
      db: stubDb({ select: [[]] })
    });

    await expect(
      service.processResendWebhook(
        signedInput(
          resendPayload("email-unknown", "email.delivered", ["accounts@northstar.example"])
        )
      )
    ).resolves.toEqual({ received: true, unknown: true });

    const unsigned = signedInput(resendPayload(null, "email.delivered", []), "not a valid id!!");
    await expect(service.processResendWebhook(unsigned)).resolves.toEqual({
      received: true,
      ignored: true
    });
  });

  it("ignores replayed events without touching delivery state", async () => {
    const replayed = createCommunication();
    const { db, service } = setup({
      config: { RESEND_WEBHOOK_SECRET: secret },
      db: stubDb({ select: [[replayed], [replayed]], insert: [[]] })
    });
    const replay = signedInput(
      resendPayload("email-id-1", "email.delivered", ["accounts@northstar.example"]),
      "msg_replay_1"
    );

    await expect(service.processResendWebhook(replay)).resolves.toEqual({
      received: true,
      duplicate: true
    });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("never trusts tenant identity from the webhook payload", async () => {
    const communication = createCommunication({ status: "accepted" });
    const { db, result } = await runWebhook({
      select: [[communication], [communication], [], []],
      update: [[{ id: "quarantine-resolve" }], [{ id: "recipient-1" }]],
      payload: {
        type: "email.delivered",
        created_at: "2026-09-18T10:00:00.000Z",
        data: {
          email_id: "email-id-1",
          from: "billing@lumina.example",
          to: ["attacker@example.com"],
          subject: "Invoice INV-000184 from Adebayo Studio",
          organisationId: "attacker-org"
        } as NonNullable<ResendWebhookPayload["data"]>
      }
    });

    expect(result).toEqual({ received: true });
    // Recipient lookup misses (no row for the attacker address), so the
    // legacy fallback advances the stored communication instead. One update
    // resolves the quarantine row; the other advances delivery state.
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it("stores unknown-recipient events without mutating delivery state", async () => {
    const communication = createCommunication({ status: "accepted" });
    const existing = createRecipient({ status: "accepted" });
    const { db, result } = await runWebhook({
      select: [[communication], [communication], [], [existing]],
      insert: [[{ id: "event-unknown-recipient" }]],
      update: [[{ id: "quarantine-resolve" }]],
      payload: resendPayload("email-id-1", "email.delivered", ["unknown@example.com"])
    });

    expect(result).toEqual({ received: true });
    // The single update resolves the quarantine row. Recipient and parent
    // delivery state are untouched when recipient rows exist but the event
    // recipient is unknown, so an event for another context cannot mutate
    // this communication.
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it("advances one recipient and derives a delivered aggregate", async () => {
    const communication = createCommunication({ status: "accepted" });
    const recipient = createRecipient({ status: "accepted" });
    const { db, result } = await runWebhook({
      select: [
        [communication],
        [communication],
        [recipient],
        [{ ...recipient, status: "delivered" }]
      ],
      update: [[{ id: "quarantine-resolve" }], [{ id: "recipient-1" }], [{ id: "comm-1" }]],
      payload: resendPayload("email-id-1", "email.delivered", ["accounts@northstar.example"])
    });

    expect(result).toEqual({ received: true });
    expect(db.update).toHaveBeenCalledTimes(3);
  });

  it("keeps a delivered recipient delivered when a late failure arrives", async () => {
    const communication = createCommunication({ status: "delivered" });
    const recipient = createRecipient({ status: "delivered" });
    const { db, result } = await runWebhook({
      select: [[communication], [communication], [recipient]],
      insert: [[{ id: "event-2" }]],
      update: [[{ id: "quarantine-resolve" }]],
      payload: resendPayload("email-id-1", "email.failed", ["accounts@northstar.example"])
    });

    expect(result).toEqual({ received: true });
    // Only the quarantine-resolution update runs. The delivered recipient
    // and parent keep their state when a late failure arrives.
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it("recovers correlation from tags before the provider id is persisted", async () => {
    const communication = createCommunication({
      id: "11111111-1111-4111-8111-111111111111",
      status: "accepted",
      providerMessageId: null
    });
    const recipient = createRecipient({ status: "accepted" });
    const { db, result } = await runWebhook({
      select: [
        [],
        [communication],
        [communication],
        [recipient],
        [{ ...recipient, status: "delivered" }]
      ],
      update: [[{ id: "quarantine-resolve" }], [{ id: "recipient-1" }], [{ id: "comm-1" }]],
      payload: resendPayload(
        "email-not-yet-stored",
        "email.delivered",
        ["accounts@northstar.example"],
        {
          invoice_delivery: "invoice_delivery",
          lumina_communication: "11111111-1111-4111-8111-111111111111"
        }
      )
    });

    expect(result).toEqual({ received: true });
    expect(db.update).toHaveBeenCalledTimes(3);
  });

  it("maps a suppressed recipient to failed delivery truth", async () => {
    const communication = createCommunication({ status: "accepted" });
    const recipient = createRecipient({ status: "accepted" });
    const { db, result } = await runWebhook({
      select: [[communication], [communication], [recipient], [{ ...recipient, status: "failed" }]],
      update: [[{ id: "quarantine-resolve" }], [{ id: "recipient-1" }], [{ id: "comm-1" }]],
      payload: resendPayload("email-id-1", "email.suppressed", ["accounts@northstar.example"])
    });

    expect(result).toEqual({ received: true });
    expect(db.update).toHaveBeenCalledTimes(3);
  });

  it("aggregates delivered plus suppressed recipients as partially failed", async () => {
    const communication = createCommunication({ status: "accepted" });
    const suppressedRecipient = createRecipient({
      id: "recipient-suppressed",
      email: "suppressed@example.com",
      status: "accepted"
    });
    const { db, result } = await runWebhook({
      select: [
        [communication],
        [communication],
        [suppressedRecipient],
        [createRecipient({ status: "delivered" }), { ...suppressedRecipient, status: "failed" }]
      ],
      insert: [[{ id: "event-suppressed" }]],
      update: [
        [{ id: "quarantine-resolve" }],
        [{ id: "recipient-suppressed" }],
        [{ id: "comm-1" }]
      ],
      payload: resendPayload("email-id-1", "email.suppressed", ["suppressed@example.com"])
    });

    expect(result).toEqual({ received: true });
    expect(db.update).toHaveBeenCalledTimes(3);
  });

  it("does not regress a delivered recipient when a late suppressed event arrives", async () => {
    const communication = createCommunication({ status: "delivered" });
    const recipient = createRecipient({ status: "delivered" });
    const { db, result } = await runWebhook({
      select: [[communication], [communication], [recipient]],
      insert: [[{ id: "event-suppressed-late" }]],
      update: [[{ id: "quarantine-resolve" }]],
      payload: resendPayload("email-id-1", "email.suppressed", ["accounts@northstar.example"])
    });

    expect(result).toEqual({ received: true });
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it("represents mixed recipient outcomes as partially failed", async () => {
    const communication = createCommunication({ status: "accepted" });
    const failedRecipient = createRecipient({
      id: "recipient-bounce",
      email: "bounce@example.com",
      status: "accepted"
    });
    const { db, result } = await runWebhook({
      select: [
        [communication],
        [communication],
        [failedRecipient],
        [createRecipient({ status: "delivered" }), { ...failedRecipient, status: "failed" }]
      ],
      insert: [[{ id: "event-3" }]],
      update: [[{ id: "quarantine-resolve" }], [{ id: "recipient-bounce" }], [{ id: "comm-1" }]],
      payload: resendPayload("email-id-1", "email.bounced", ["bounce@example.com"])
    });

    expect(result).toEqual({ received: true });
    expect(db.update).toHaveBeenCalledTimes(3);
  });
});
