import { createHmac } from "crypto";
import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";

import type { Invoice, Payment, PaymentEvent } from "../../database/schema";
import { PaymentsService } from "./payments.service";

const secret = "sk_test_secret";
const now = new Date("2026-06-30T10:00:00.000Z");

function createSignature(rawBody: Buffer) {
  return createHmac("sha512", secret).update(rawBody).digest("hex");
}

function createPayload(overrides: Record<string, unknown> = {}) {
  return {
    event: "charge.success",
    data: {
      id: 123456,
      reference: "SME-INV000001-ABC123",
      amount: 97500,
      currency: "NGN",
      status: "success",
      gateway_response: "Successful",
      channel: "card",
      paid_at: "2026-06-30T10:00:00.000Z",
      created_at: "2026-06-30T09:59:00.000Z",
      customer: {
        email: "customer@example.com",
        phone: "should-not-be-stored"
      },
      authorization: {
        authorization_code: "AUTH_secret",
        bin: "408408",
        last4: "4081"
      },
      metadata: {
        invoiceId: "invoice-1",
        invoiceNumber: "INV-000001",
        customerId: "customer-1",
        organisationId: "org-1",
        source: "public_invoice_page",
        secretThing: "do-not-store"
      }
    },
    ...overrides
  };
}

function createInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    organisationId: "org-1",
    customerId: "customer-1",
    invoiceNumber: "INV-000001",
    publicToken: "public-token",
    publicAccessEnabled: true,
    status: "sent",
    currency: "NGN",
    issueDate: "2026-06-01",
    dueDate: "2026-07-01",
    notes: null,
    subtotalKobo: 97500,
    discountKobo: 0,
    taxKobo: 0,
    totalKobo: 97500,
    amountPaidKobo: 0,
    balanceDueKobo: 97500,
    sentAt: now,
    viewedAt: null,
    paidAt: null,
    cancelledAt: null,
    voidedAt: null,
    createdByUserId: "user-1",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-1",
    organisationId: "org-1",
    invoiceId: "invoice-1",
    customerId: "customer-1",
    provider: "paystack",
    providerReference: "SME-INV000001-ABC123",
    providerSubaccountCode: "ACCT_test_subaccount",
    providerAccessCode: "access-code",
    providerAuthorizationUrl: "https://checkout.paystack.test/pay/reference",
    status: "pending",
    currency: "NGN",
    amountKobo: 97500,
    paidAt: null,
    failedAt: null,
    abandonedAt: null,
    channel: null,
    gatewayResponse: null,
    metadataRedacted: null,
    initializedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createPaymentEvent(overrides: Partial<PaymentEvent> = {}): PaymentEvent {
  return {
    id: "event-1",
    organisationId: "org-1",
    paymentId: "payment-1",
    provider: "paystack",
    providerEventId: "123456",
    providerReference: "SME-INV000001-ABC123",
    eventType: "charge.success",
    signatureValid: true,
    processed: false,
    processedAt: null,
    duplicateOfEventId: null,
    payloadRedacted: null,
    errorMessage: null,
    createdAt: now,
    ...overrides
  };
}

function setup() {
  const transaction = jest.fn(async (callback: (tx: unknown) => Promise<void>) => callback({}));
  const service = new PaymentsService(
    { db: { transaction } } as never,
    { get: jest.fn((key: string) => (key === "PAYSTACK_SECRET_KEY" ? secret : undefined)) } as never
  );

  return { service, transaction };
}

describe("PaymentsService signature handling", () => {
  it("verifies the raw body signature before processing", async () => {
    const { service, transaction } = setup();
    const rawBody = Buffer.from(JSON.stringify(createPayload()));
    const internals = service as unknown as {
      processVerifiedWebhook: jest.Mock;
    };
    internals.processVerifiedWebhook = jest.fn().mockResolvedValue(undefined);

    await expect(
      service.processPaystackWebhook(rawBody, createSignature(rawBody))
    ).resolves.toEqual({
      received: true
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(internals.processVerifiedWebhook).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        eventType: "charge.success",
        providerReference: "SME-INV000001-ABC123"
      })
    );
  });

  it("rejects a missing signature", async () => {
    const { service, transaction } = setup();

    await expect(
      service.processPaystackWebhook(Buffer.from(JSON.stringify(createPayload())))
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature before parsing JSON", async () => {
    const { service, transaction } = setup();

    await expect(
      service.processPaystackWebhook(Buffer.from("{"), "bad-signature")
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("requires Paystack secret configuration", async () => {
    const service = new PaymentsService(
      { db: { transaction: jest.fn() } } as never,
      { get: jest.fn().mockReturnValue(undefined) } as never
    );
    const rawBody = Buffer.from(JSON.stringify(createPayload()));

    await expect(
      service.processPaystackWebhook(rawBody, createSignature(rawBody))
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("rejects malformed JSON only after signature validation succeeds", async () => {
    const { service, transaction } = setup();
    const rawBody = Buffer.from("{");

    await expect(
      service.processPaystackWebhook(rawBody, createSignature(rawBody))
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("PaymentsService event safety", () => {
  it("redacts sensitive Paystack payload fields", () => {
    const { service } = setup();
    const internals = service as unknown as {
      parseWebhook: (rawBody: Buffer) => {
        redactedPayload: Record<string, unknown>;
      };
    };

    const webhook = internals.parseWebhook(Buffer.from(JSON.stringify(createPayload())));

    expect(JSON.stringify(webhook.redactedPayload)).toContain("customer@example.com");
    expect(JSON.stringify(webhook.redactedPayload)).toContain("INV-000001");
    expect(JSON.stringify(webhook.redactedPayload)).not.toContain("AUTH_secret");
    expect(JSON.stringify(webhook.redactedPayload)).not.toContain("should-not-be-stored");
    expect(JSON.stringify(webhook.redactedPayload)).not.toContain("do-not-store");
  });

  it("stores duplicates without invoking reconciliation again", async () => {
    const { service } = setup();
    const duplicate = createPaymentEvent({ id: "original-event", processed: true });
    const newEvent = createPaymentEvent({
      id: "duplicate-event",
      duplicateOfEventId: duplicate.id
    });
    const internals = service as unknown as {
      createAuditLog: jest.Mock;
      createPaymentEvent: jest.Mock;
      findProcessedDuplicate: jest.Mock;
      processChargeSuccess: jest.Mock;
      processVerifiedWebhook: (tx: unknown, webhook: unknown) => Promise<void>;
    };
    internals.findProcessedDuplicate = jest.fn().mockResolvedValue(duplicate);
    internals.createPaymentEvent = jest.fn().mockResolvedValue(newEvent);
    internals.createAuditLog = jest.fn().mockResolvedValue(undefined);
    internals.processChargeSuccess = jest.fn();

    await internals.processVerifiedWebhook(
      {},
      {
        eventType: "charge.success",
        providerReference: "SME-INV000001-ABC123"
      }
    );

    expect(internals.createPaymentEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      duplicate
    );
    expect(internals.processChargeSuccess).not.toHaveBeenCalled();
    expect(internals.createAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "payment_webhook_duplicate_ignored"
      })
    );
  });
});

describe("PaymentsService reconciliation helpers", () => {
  function createTx() {
    const updateWhere = jest.fn().mockResolvedValue(undefined);
    const updateSet = jest.fn(() => ({ where: updateWhere }));
    const insertValues = jest.fn().mockResolvedValue(undefined);
    return {
      tx: {
        update: jest.fn(() => ({ set: updateSet })),
        insert: jest.fn(() => ({ values: insertValues }))
      },
      insertValues,
      updateSet
    };
  }

  it("marks a fully paid invoice as paid and writes a status event", async () => {
    const { service } = setup();
    const { tx, updateSet, insertValues } = createTx();
    const internals = service as unknown as {
      createAuditLog: jest.Mock;
      reconcileInvoice: (
        tx: unknown,
        invoice: Invoice,
        payment: Payment,
        eventId: string,
        paidAt: Date
      ) => Promise<void>;
      sumSuccessfulPayments: jest.Mock;
    };
    internals.sumSuccessfulPayments = jest.fn().mockResolvedValue(97500);
    internals.createAuditLog = jest.fn().mockResolvedValue(undefined);

    await internals.reconcileInvoice(
      tx,
      createInvoice(),
      createPayment(),
      "event-1",
      new Date("2026-06-30T10:00:00.000Z")
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        amountPaidKobo: 97500,
        balanceDueKobo: 0,
        status: "paid",
        paidAt: new Date("2026-06-30T10:00:00.000Z")
      })
    );
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStatus: "sent",
        toStatus: "paid",
        reason: "payment_webhook_reconciled"
      })
    );
  });

  it("preserves the initialized provider subaccount code when marking payment successful", async () => {
    const { service } = setup();
    const { tx, updateSet } = createTx();
    const internals = service as unknown as {
      markPaymentSuccessful: (
        tx: unknown,
        payment: Payment,
        webhook: unknown,
        paidAt: Date
      ) => Promise<void>;
    };

    await internals.markPaymentSuccessful(
      tx,
      createPayment({ providerSubaccountCode: "ACCT_test_subaccount" }),
      {
        eventType: "charge.success",
        payload: {
          data: {
            channel: "card",
            gateway_response: "Successful",
            status: "success"
          }
        }
      },
      new Date("2026-06-30T10:00:00.000Z")
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.not.objectContaining({
        providerSubaccountCode: expect.anything()
      })
    );
  });

  it("marks a partially paid invoice as partially_paid", async () => {
    const { service } = setup();
    const { tx, updateSet } = createTx();
    const internals = service as unknown as {
      createAuditLog: jest.Mock;
      reconcileInvoice: (
        tx: unknown,
        invoice: Invoice,
        payment: Payment,
        eventId: string,
        paidAt: Date
      ) => Promise<void>;
      sumSuccessfulPayments: jest.Mock;
    };
    internals.sumSuccessfulPayments = jest.fn().mockResolvedValue(50000);
    internals.createAuditLog = jest.fn().mockResolvedValue(undefined);

    await internals.reconcileInvoice(tx, createInvoice(), createPayment(), "event-1", now);

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        amountPaidKobo: 50000,
        balanceDueKobo: 47500,
        status: "partially_paid"
      })
    );
  });

  it("calculates paid and partially paid status deterministically", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      nextInvoiceStatus: (
        invoice: Invoice,
        amountPaidKobo: number,
        balanceDueKobo: number
      ) => Invoice["status"];
    };

    expect(internals.nextInvoiceStatus(createInvoice({ status: "sent" }), 97500, 0)).toBe("paid");
    expect(internals.nextInvoiceStatus(createInvoice({ status: "sent" }), 50000, 47500)).toBe(
      "partially_paid"
    );
  });
});
