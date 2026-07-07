import { createHmac } from "crypto";
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";

import type {
  Invoice,
  OrganisationPaymentAccount,
  Payment,
  PaymentEvent,
  PaymentRefund
} from "../../database/schema";
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

function createPaymentRefund(overrides: Partial<PaymentRefund> = {}): PaymentRefund {
  return {
    id: "refund-1",
    organisationId: "org-1",
    paymentId: "payment-1",
    provider: "paystack",
    providerRefundId: "refund-provider-1",
    amountKobo: 1000,
    currency: "NGN",
    status: "pending",
    reason: "Refund overpayment",
    customerNote: "Refund overpayment",
    merchantNote: "Refund overpayment",
    initiatedByUserId: "user-1",
    processedAt: null,
    failedAt: null,
    needsAttentionAt: null,
    providerMetadataRedacted: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

const context = {
  activeOrganisation: { id: "org-1" },
  user: { id: "user-1" },
  membership: { role: "owner" },
  businessProfile: {}
};

function createCustomer() {
  return {
    id: "customer-1",
    organisationId: "org-1",
    name: "Lagos Bright Prints",
    email: "accounts@lagosbrightprints.com",
    phone: "+2348010000001",
    billingAddress: "14 Allen Avenue",
    createdByUserId: "user-1",
    archivedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function createSettlementAccount(): OrganisationPaymentAccount {
  return {
    id: "payment-account-1",
    organisationId: "org-1",
    provider: "paystack",
    providerSubaccountCode: "ACCT_test_subaccount",
    bankCode: "033",
    bankName: "United Bank for Africa",
    accountName: "Akin & Co Creative Services",
    accountNumberLast4: "9090",
    status: "disabled",
    verifiedAt: now,
    disabledAt: now,
    providerMetadataRedacted: null,
    createdByUserId: "user-1",
    createdAt: now,
    updatedAt: now
  };
}

function createPaymentRelation(
  overrides: {
    events?: PaymentEvent[];
    invoice?: Partial<Invoice>;
    payment?: Partial<Payment>;
    refunds?: PaymentRefund[];
    settlementAccount?: ReturnType<typeof createSettlementAccount> | null;
  } = {}
) {
  return {
    payment: createPayment(overrides.payment),
    invoice: createInvoice(overrides.invoice),
    customer: createCustomer(),
    settlementAccount: overrides.settlementAccount ?? createSettlementAccount(),
    events: overrides.events ?? [createPaymentEvent({ processed: true, processedAt: now })],
    refunds: overrides.refunds ?? []
  };
}

function setup() {
  const transaction = jest.fn(async (callback: (tx: unknown) => Promise<void>) => callback({}));
  const paystackService = {
    createRefund: jest.fn(),
    verifyTransaction: jest.fn()
  };
  const receiptsService = {
    ensureReceiptForSuccessfulPayment: jest.fn().mockResolvedValue({
      created: true,
      receipt: { id: "receipt-1" }
    })
  };
  const service = new PaymentsService(
    { db: { transaction } } as never,
    {
      get: jest.fn((key: string) => (key === "PAYSTACK_SECRET_KEY" ? secret : undefined))
    } as never,
    paystackService as never,
    receiptsService as never
  );

  return { receiptsService, service, paystackService, transaction };
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
      { get: jest.fn().mockReturnValue(undefined) } as never,
      { verifyTransaction: jest.fn() } as never,
      { ensureReceiptForSuccessfulPayment: jest.fn() } as never
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

describe("PaymentsService read APIs", () => {
  it("lists payments with computed reconciliation state and masked settlement account", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest.fn().mockResolvedValue([
      createPaymentRelation({
        payment: { initializedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
      })
    ]);

    const response = await service.listPayments(context as never, {});

    expect(response.payments).toHaveLength(1);
    expect(response.payments[0]).toMatchObject({
      providerReference: "SME-INV000001-ABC123",
      attemptState: "active_pending",
      reconciliationState: "pending_confirmation",
      settlementAccount: {
        bankName: "United Bank for Africa",
        accountNumberLast4: "9090"
      },
      settlementAccountContext: {
        currentStatus: "disabled",
        isCurrentActiveAccount: false,
        isHistorical: true
      }
    });
    expect(JSON.stringify(response)).not.toContain("ACCT_test_subaccount");
  });

  it("filters by computed reconciliation state after loading organisation payments", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest.fn().mockResolvedValue([
      createPaymentRelation({
        payment: { id: "payment-1", status: "successful" }
      }),
      createPaymentRelation({
        payment: {
          id: "payment-2",
          invoiceId: "invoice-2",
          amountKobo: 870000,
          initializedAt: new Date()
        },
        invoice: {
          id: "invoice-2",
          totalKobo: 870000,
          balanceDueKobo: 870000
        },
        events: [
          createPaymentEvent({
            id: "event-2",
            paymentId: "payment-2",
            errorMessage: "Payment amount did not match the pending payment.",
            payloadRedacted: {
              event: "charge.success",
              data: {
                amount: 860000,
                currency: "NGN"
              }
            }
          })
        ]
      })
    ]);

    const response = await service.listPayments(context as never, {
      reconciliationState: "review_required"
    });

    expect(response.payments).toHaveLength(1);
    expect(response.payments[0]?.id).toBe("payment-2");
    expect(response.pagination.total).toBe(1);
  });

  it("clamps out-of-range payment pages to the last available page", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest
      .fn()
      .mockResolvedValue([
        createPaymentRelation({ payment: { id: "payment-1", status: "successful" } }),
        createPaymentRelation({ payment: { id: "payment-2", status: "successful" } })
      ]);

    const response = await service.listPayments(context as never, {
      limit: 1,
      page: 5,
      view: "all_attempts"
    });

    expect(response.pagination).toMatchObject({
      page: 2,
      limit: 1,
      total: 2,
      totalPages: 2
    });
    expect(response.payments.map((payment) => payment.id)).toEqual(["payment-2"]);
  });

  it("calculates payment summary totals and review-required count", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest.fn().mockResolvedValue([
      createPaymentRelation({
        payment: { id: "payment-1", status: "successful", amountKobo: 1000 }
      }),
      createPaymentRelation({ payment: { id: "payment-2", status: "pending", amountKobo: 2000 } }),
      createPaymentRelation({ payment: { id: "payment-3", status: "failed", amountKobo: 3000 } }),
      createPaymentRelation({
        payment: { id: "payment-4", status: "abandoned", amountKobo: 4000 },
        events: [
          createPaymentEvent({
            id: "event-4",
            paymentId: "payment-4",
            errorMessage: "Unknown payment reference."
          })
        ]
      })
    ]);

    const response = await service.getPaymentSummary(context as never, {});

    expect(response.totals).toMatchObject({
      collectedKobo: 1000,
      pendingKobo: 0,
      failedKobo: 3000,
      abandonedKobo: 0,
      reviewRequiredCount: 1
    });
  });

  it("classifies pending attempts for unpaid invoices as active pending", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest.fn().mockResolvedValue([
      createPaymentRelation({
        payment: { initializedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
      })
    ]);

    const response = await service.listPayments(context as never, {});

    expect(response.payments[0]).toMatchObject({
      attemptState: "active_pending",
      reconciliationState: "pending_confirmation",
      isSuperseded: false
    });
  });

  it("classifies old pending attempts as stale pending", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest.fn().mockResolvedValue([createPaymentRelation()]);

    const response = await service.listPayments(context as never, {});

    expect(response.payments[0]).toMatchObject({
      attemptState: "stale_pending",
      reconciliationState: "stale_pending"
    });
  });

  it("supersedes pending retries when aggregate successful payments fully paid the invoice", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest.fn().mockResolvedValue([
      createPaymentRelation({
        payment: {
          id: "payment-success",
          status: "successful",
          amountKobo: 97500,
          paidAt: now
        },
        invoice: { status: "sent", balanceDueKobo: 97500, amountPaidKobo: 0 }
      }),
      createPaymentRelation({
        payment: {
          id: "payment-pending",
          status: "pending",
          amountKobo: 97500,
          initializedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        invoice: { status: "sent", balanceDueKobo: 97500, amountPaidKobo: 0 }
      })
    ]);

    const response = await service.listPayments(context as never, { view: "all_attempts" });

    expect(response.payments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "payment-success", attemptState: "successful" }),
        expect.objectContaining({
          id: "payment-pending",
          attemptState: "superseded",
          supersededReason: "Invoice already paid by a successful payment."
        })
      ])
    );
  });

  it("keeps only the newest pending attempt active for an unpaid invoice", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest.fn().mockResolvedValue([
      createPaymentRelation({
        payment: {
          id: "older-pending",
          status: "pending",
          initializedAt: new Date("2026-06-30T09:00:00.000Z"),
          createdAt: new Date("2026-06-30T09:00:00.000Z"),
          updatedAt: new Date("2026-06-30T09:00:00.000Z")
        }
      }),
      createPaymentRelation({
        payment: {
          id: "newer-pending",
          status: "pending",
          initializedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    ]);

    const defaultResponse = await service.listPayments(context as never, {});
    const allAttemptsResponse = await service.listPayments(context as never, {
      view: "all_attempts"
    });

    expect(defaultResponse.payments.map((payment) => payment.id)).toEqual(["newer-pending"]);
    expect(allAttemptsResponse.payments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "newer-pending", attemptState: "active_pending" }),
        expect.objectContaining({ id: "older-pending", attemptState: "superseded" })
      ])
    );
  });

  it("does not keep false amount-mismatch events in needs-review when kobo amounts are equal", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest.fn().mockResolvedValue([
      createPaymentRelation({
        payment: {
          id: "payment-1",
          amountKobo: 870000,
          initializedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        invoice: {
          totalKobo: 870000,
          balanceDueKobo: 870000
        },
        events: [
          createPaymentEvent({
            errorMessage: "Payment amount did not match the pending payment.",
            payloadRedacted: {
              event: "charge.success",
              data: {
                amount: 870000,
                currency: "NGN"
              }
            }
          })
        ]
      })
    ]);

    const response = await service.listPayments(context as never, { view: "review_required" });

    expect(response.payments).toHaveLength(0);
  });

  it("returns review details for a genuine amount mismatch", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest.fn().mockResolvedValue([
      createPaymentRelation({
        payment: {
          id: "payment-1",
          amountKobo: 870000,
          initializedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        events: [
          createPaymentEvent({
            errorMessage: "Payment amount did not match the pending payment.",
            payloadRedacted: {
              event: "charge.success",
              data: {
                amount: 860000,
                currency: "NGN"
              }
            }
          })
        ]
      })
    ]);

    const response = await service.listPayments(context as never, { view: "review_required" });

    expect(response.payments[0]).toMatchObject({
      attemptState: "review_required",
      reviewDetails: {
        expectedAmountKobo: 870000,
        receivedAmountKobo: 860000,
        currency: "NGN"
      }
    });
  });

  it("classifies pending, failed, and abandoned attempts for paid invoices as superseded", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest.fn().mockResolvedValue([
      createPaymentRelation({
        payment: { id: "payment-1", status: "pending" },
        invoice: { status: "paid", balanceDueKobo: 0, amountPaidKobo: 97500 }
      }),
      createPaymentRelation({
        payment: { id: "payment-2", status: "failed" },
        invoice: { status: "paid", balanceDueKobo: 0, amountPaidKobo: 97500 }
      }),
      createPaymentRelation({
        payment: { id: "payment-3", status: "abandoned" },
        invoice: { status: "paid", balanceDueKobo: 0, amountPaidKobo: 97500 }
      })
    ]);

    const response = await service.listPayments(context as never, { view: "all_attempts" });

    expect(response.payments).toHaveLength(3);
    expect(response.payments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "payment-1", attemptState: "superseded" }),
        expect.objectContaining({ id: "payment-2", attemptState: "superseded" }),
        expect.objectContaining({ id: "payment-3", attemptState: "superseded" })
      ])
    );
  });

  it("does not mark ordinary failed attempts as review required", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest.fn().mockResolvedValue([
      createPaymentRelation({
        payment: { id: "payment-1", status: "failed" },
        events: [
          createPaymentEvent({
            id: "event-1",
            paymentId: "payment-1",
            eventType: "charge.failed",
            processed: true,
            processedAt: now,
            errorMessage: "Unsupported Paystack event ignored."
          })
        ]
      })
    ]);

    const response = await service.listPayments(context as never, { view: "all_attempts" });

    expect(response.payments[0]).toMatchObject({
      attemptState: "failed_attempt",
      reconciliationState: "failed"
    });
  });

  it("excludes superseded attempts from the default view but includes them in all attempts", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest.fn().mockResolvedValue([
      createPaymentRelation({
        payment: { id: "payment-1", status: "successful" },
        invoice: { status: "paid", balanceDueKobo: 0, amountPaidKobo: 97500 }
      }),
      createPaymentRelation({
        payment: { id: "payment-2", status: "failed" },
        invoice: { status: "paid", balanceDueKobo: 0, amountPaidKobo: 97500 }
      })
    ]);

    const defaultResponse = await service.listPayments(context as never, {});
    const allAttemptsResponse = await service.listPayments(context as never, {
      view: "all_attempts"
    });

    expect(defaultResponse.payments.map((payment) => payment.id)).toEqual(["payment-1"]);
    expect(allAttemptsResponse.payments.map((payment) => payment.id)).toEqual([
      "payment-1",
      "payment-2"
    ]);
  });

  it("returns only review-required payment records for review view", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest.fn().mockResolvedValue([
      createPaymentRelation({
        payment: { id: "payment-1", status: "successful" }
      }),
      createPaymentRelation({
        payment: {
          id: "payment-2",
          invoiceId: "invoice-2",
          amountKobo: 870000,
          initializedAt: new Date()
        },
        invoice: {
          id: "invoice-2",
          totalKobo: 870000,
          balanceDueKobo: 870000
        },
        events: [
          createPaymentEvent({
            id: "event-2",
            paymentId: "payment-2",
            errorMessage: "Payment amount did not match the pending payment.",
            payloadRedacted: {
              event: "charge.success",
              data: {
                amount: 860000,
                currency: "NGN"
              }
            }
          })
        ]
      })
    ]);

    const response = await service.listPayments(context as never, { view: "review_required" });

    expect(response.payments).toHaveLength(1);
    expect(response.payments[0]).toMatchObject({
      id: "payment-2",
      attemptState: "review_required"
    });
  });

  it("returns safe payment detail event summaries without raw payloads or subaccount codes", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
      getInvoiceFinancialSummary: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest.fn().mockResolvedValue([
      createPaymentRelation({
        events: [
          createPaymentEvent({
            payloadRedacted: { raw: "not returned" },
            processed: true,
            processedAt: now
          })
        ]
      })
    ]);
    internals.getInvoiceFinancialSummary = jest.fn().mockResolvedValue({
      appliedToInvoiceKobo: 0,
      balanceDueKobo: 97500,
      grossSuccessfulKobo: 0,
      hasOverpayment: false,
      netReceivedKobo: 0,
      overpaymentKobo: 0,
      paymentCount: 1,
      processedRefundsKobo: 0,
      successfulPaymentCount: 0
    });

    const response = await service.getPayment(context as never, "payment-1");

    expect(response.events[0]).toEqual(
      expect.not.objectContaining({
        payloadRedacted: expect.anything()
      })
    );
    expect(JSON.stringify(response)).not.toContain("ACCT_test_subaccount");
    expect(response.receipt).toBeNull();
    expect(response.receiptPlaceholder).toBe("No receipt has been issued for this payment yet.");
  });

  it("reports active exact settlement account context without exposing subaccount code", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPaymentsWithRelations: jest.Mock;
      getInvoiceFinancialSummary: jest.Mock;
    };
    internals.findPaymentsWithRelations = jest.fn().mockResolvedValue([
      createPaymentRelation({
        settlementAccount: {
          ...createSettlementAccount(),
          status: "active",
          disabledAt: null
        }
      })
    ]);
    internals.getInvoiceFinancialSummary = jest.fn().mockResolvedValue({
      appliedToInvoiceKobo: 0,
      balanceDueKobo: 97500,
      grossSuccessfulKobo: 0,
      hasOverpayment: false,
      netReceivedKobo: 0,
      overpaymentKobo: 0,
      paymentCount: 1,
      processedRefundsKobo: 0,
      successfulPaymentCount: 0
    });

    const response = await service.getPayment(context as never, "payment-1");

    expect(response.settlementAccount).toEqual({
      provider: "paystack",
      bankName: "United Bank for Africa",
      accountName: "Akin & Co Creative Services",
      accountNumberLast4: "9090"
    });
    expect(response.settlementAccountContext).toEqual({
      currentStatus: "active",
      isCurrentActiveAccount: true,
      isHistorical: false
    });
    expect(JSON.stringify(response)).not.toContain("ACCT_test_subaccount");
  });

  it("verifies a returned public invoice payment through the shared reconciler", async () => {
    const { paystackService, service } = setup();
    const limit = jest.fn().mockResolvedValue([
      {
        invoice: createInvoice(),
        payment: createPayment()
      }
    ]);
    const where = jest.fn(() => ({ limit }));
    const innerJoin = jest.fn(() => ({ where }));
    const from = jest.fn(() => ({ innerJoin }));
    const select = jest.fn(() => ({ from }));
    const transaction = jest.fn((callback: (tx: unknown) => Promise<unknown>) => callback({}));
    const internals = service as unknown as {
      databaseService: { db: unknown };
      reconcileSuccessfulPaystackPayment: jest.Mock;
    };
    internals.databaseService.db = { select, transaction };
    internals.reconcileSuccessfulPaystackPayment = jest.fn().mockResolvedValue({
      status: "successful",
      invoiceUpdated: true
    });
    paystackService.verifyTransaction.mockResolvedValue({
      reference: "SME-INV000001-ABC123",
      status: "success",
      amountKobo: 97500,
      currency: "NGN",
      paidAt: "2026-06-30T10:00:00.000Z",
      channel: "card",
      gatewayResponse: "Successful"
    });

    await expect(
      service.verifyPublicInvoicePayment("public-token", "SME-INV000001-ABC123")
    ).resolves.toEqual({
      status: "successful",
      invoiceUpdated: true
    });

    expect(paystackService.verifyTransaction).toHaveBeenCalledWith("SME-INV000001-ABC123");
    expect(internals.reconcileSuccessfulPaystackPayment).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        amountKobo: 97500,
        currency: "NGN",
        reference: "SME-INV000001-ABC123",
        source: "verification"
      })
    );
  });

  it("does not verify references unrelated to the public invoice token", async () => {
    const { paystackService, service } = setup();
    const limit = jest.fn().mockResolvedValue([]);
    const where = jest.fn(() => ({ limit }));
    const innerJoin = jest.fn(() => ({ where }));
    const from = jest.fn(() => ({ innerJoin }));
    const select = jest.fn(() => ({ from }));
    const internals = service as unknown as {
      databaseService: { db: unknown };
    };
    internals.databaseService.db = { select };

    await expect(
      service.verifyPublicInvoicePayment("public-token", "SME-OTHER-REFERENCE")
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(paystackService.verifyTransaction).not.toHaveBeenCalled();
  });
});

describe("PaymentsService refunds", () => {
  function createRefundTx() {
    const pendingRefund = createPaymentRefund({
      id: "refund-pending",
      amountKobo: 170000,
      status: "pending"
    });
    const updatedRefund = createPaymentRefund({
      id: "refund-pending",
      amountKobo: 170000,
      providerRefundId: "refund-provider-1",
      status: "pending"
    });
    const insertReturning = jest.fn().mockResolvedValue([pendingRefund]);
    const insertValues = jest.fn(() => ({ returning: insertReturning }));
    const updateReturning = jest.fn().mockResolvedValue([updatedRefund]);
    const updateWhere = jest.fn(() => ({ returning: updateReturning }));
    const updateSet = jest.fn(() => ({ where: updateWhere }));
    const tx = {
      insert: jest.fn(() => ({ values: insertValues })),
      update: jest.fn(() => ({ set: updateSet }))
    };

    return {
      insertValues,
      pendingRefund,
      tx,
      updatedRefund,
      updateSet
    };
  }

  it("initiates an overpayment refund through Paystack and stores safe refund state", async () => {
    const { paystackService, service, transaction } = setup();
    const refundTx = createRefundTx();
    transaction.mockImplementation(async (callback) => callback(refundTx.tx));
    paystackService.createRefund.mockResolvedValue({
      providerRefundId: "refund-provider-1",
      status: "pending",
      amountKobo: 170000,
      currency: "NGN",
      transactionReference: "SME-INV000001-ABC123"
    });
    const internals = service as unknown as {
      calculateInvoiceFinancialSummaryForId: jest.Mock;
      createAuditLog: jest.Mock;
      getRefundablePaymentState: jest.Mock;
    };
    internals.getRefundablePaymentState = jest.fn().mockResolvedValue({
      payment: createPayment({ status: "successful", amountKobo: 170000 }),
      financialSummary: {
        appliedToInvoiceKobo: 170000,
        balanceDueKobo: 0,
        grossSuccessfulKobo: 340000,
        hasOverpayment: true,
        netReceivedKobo: 340000,
        overpaymentKobo: 170000,
        paymentCount: 2,
        processedRefundsKobo: 0,
        successfulPaymentCount: 2
      },
      remainingRefundableKobo: 170000
    });
    internals.calculateInvoiceFinancialSummaryForId = jest.fn().mockResolvedValue({
      invoice: createInvoice({ status: "paid", balanceDueKobo: 0 }),
      financialSummary: {
        appliedToInvoiceKobo: 170000,
        balanceDueKobo: 0,
        grossSuccessfulKobo: 340000,
        hasOverpayment: true,
        netReceivedKobo: 340000,
        overpaymentKobo: 170000,
        paymentCount: 2,
        processedRefundsKobo: 0,
        successfulPaymentCount: 2
      }
    });
    internals.createAuditLog = jest.fn().mockResolvedValue(undefined);

    const response = await service.createPaymentRefund(
      context as never,
      { userId: "user-1" } as never,
      "payment-1",
      { amountKobo: 170000, reason: "Duplicate payment" }
    );

    expect(paystackService.createRefund).toHaveBeenCalledWith({
      transactionReference: "SME-INV000001-ABC123",
      amountKobo: 170000,
      currency: "NGN",
      customerNote: "Duplicate payment",
      merchantNote: "Duplicate payment"
    });
    expect(refundTx.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        amountKobo: 170000,
        reason: "Duplicate payment",
        status: "pending"
      })
    );
    expect(refundTx.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRefundId: "refund-provider-1",
        status: "pending",
        providerMetadataRedacted: expect.objectContaining({
          transactionReference: "SME-INV000001-ABC123"
        })
      })
    );
    expect(response.refund).toMatchObject({
      id: "refund-pending",
      status: "pending",
      amountKobo: 170000
    });
    expect(JSON.stringify(response)).not.toContain("sk_test");
  });

  it("rejects refund amounts above the invoice overpayment before calling Paystack", async () => {
    const { paystackService, service } = setup();
    const internals = service as unknown as {
      getRefundablePaymentState: jest.Mock;
    };
    internals.getRefundablePaymentState = jest.fn().mockResolvedValue({
      payment: createPayment({ status: "successful", amountKobo: 170000 }),
      financialSummary: {
        overpaymentKobo: 1000
      },
      remainingRefundableKobo: 170000
    });

    await expect(
      service.createPaymentRefund(context as never, { userId: "user-1" } as never, "payment-1", {
        amountKobo: 170000,
        reason: "Duplicate payment"
      })
    ).rejects.toThrow("Refund amount cannot exceed the invoice overpayment.");
    expect(paystackService.createRefund).not.toHaveBeenCalled();
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

  it("calculates full payment financial truth as paid with zero balance", () => {
    const { service } = setup();
    const internals = service as unknown as {
      buildFinancialSummary: (
        invoice: Invoice,
        invoicePayments: Payment[],
        refunds: PaymentRefund[]
      ) => {
        balanceDueKobo: number;
        grossSuccessfulKobo: number;
        netReceivedKobo: number;
        overpaymentKobo: number;
      };
      nextInvoiceStatusFromFinancialSummary: (
        invoice: Invoice,
        financialSummary: {
          balanceDueKobo: number;
          netReceivedKobo: number;
        }
      ) => Invoice["status"];
    };
    const invoice = createInvoice();
    const summary = internals.buildFinancialSummary(
      invoice,
      [createPayment({ status: "successful", amountKobo: 97500 })],
      []
    );

    expect(summary).toMatchObject({
      grossSuccessfulKobo: 97500,
      netReceivedKobo: 97500,
      balanceDueKobo: 0,
      overpaymentKobo: 0
    });
    expect(internals.nextInvoiceStatusFromFinancialSummary(invoice, summary)).toBe("paid");
  });

  it("preserves the initialized provider subaccount code when marking payment successful", async () => {
    const { service } = setup();
    const { tx, updateSet } = createTx();
    const internals = service as unknown as {
      markPaymentSuccessful: (tx: unknown, payment: Payment, input: unknown) => Promise<void>;
    };

    await internals.markPaymentSuccessful(
      tx,
      createPayment({ providerSubaccountCode: "ACCT_test_subaccount" }),
      {
        amountKobo: 97500,
        channel: "card",
        currency: "NGN",
        eventType: "charge.success",
        gatewayResponse: "Successful",
        paidAt: new Date("2026-06-30T10:00:00.000Z"),
        providerStatus: "success",
        reference: "SME-INV000001-ABC123",
        source: "webhook"
      }
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.not.objectContaining({
        providerSubaccountCode: expect.anything()
      })
    );
  });

  it("calculates partial payment financial truth as partially paid", () => {
    const { service } = setup();
    const internals = service as unknown as {
      buildFinancialSummary: (
        invoice: Invoice,
        invoicePayments: Payment[],
        refunds: PaymentRefund[]
      ) => {
        balanceDueKobo: number;
        netReceivedKobo: number;
      };
      nextInvoiceStatusFromFinancialSummary: (
        invoice: Invoice,
        financialSummary: {
          balanceDueKobo: number;
          netReceivedKobo: number;
        }
      ) => Invoice["status"];
    };
    const invoice = createInvoice();
    const summary = internals.buildFinancialSummary(
      invoice,
      [createPayment({ status: "successful", amountKobo: 50000 })],
      []
    );

    expect(summary).toMatchObject({
      netReceivedKobo: 50000,
      balanceDueKobo: 47500
    });
    expect(internals.nextInvoiceStatusFromFinancialSummary(invoice, summary)).toBe(
      "partially_paid"
    );
  });

  it("calculates overpayment and processed refunds from persisted records", () => {
    const { service } = setup();
    const internals = service as unknown as {
      buildFinancialSummary: (
        invoice: Invoice,
        invoicePayments: Payment[],
        refunds: PaymentRefund[]
      ) => {
        appliedToInvoiceKobo: number;
        balanceDueKobo: number;
        grossSuccessfulKobo: number;
        netReceivedKobo: number;
        overpaymentKobo: number;
        processedRefundsKobo: number;
      };
      nextInvoiceStatusFromFinancialSummary: (
        invoice: Invoice,
        financialSummary: {
          balanceDueKobo: number;
          netReceivedKobo: number;
        }
      ) => Invoice["status"];
    };
    const invoice = createInvoice({ totalKobo: 170000 });
    const firstPayment = createPayment({
      id: "payment-1",
      status: "successful",
      amountKobo: 170000
    });
    const secondPayment = createPayment({
      id: "payment-2",
      status: "successful",
      amountKobo: 170000
    });

    const overpaidSummary = internals.buildFinancialSummary(
      invoice,
      [firstPayment, secondPayment],
      []
    );

    expect(overpaidSummary).toMatchObject({
      grossSuccessfulKobo: 340000,
      processedRefundsKobo: 0,
      netReceivedKobo: 340000,
      appliedToInvoiceKobo: 170000,
      overpaymentKobo: 170000,
      balanceDueKobo: 0
    });
    expect(internals.nextInvoiceStatusFromFinancialSummary(invoice, overpaidSummary)).toBe("paid");

    const refundedSummary = internals.buildFinancialSummary(
      invoice,
      [firstPayment, secondPayment],
      [
        createPaymentRefund({
          paymentId: "payment-2",
          status: "processed",
          amountKobo: 170000
        })
      ]
    );

    expect(refundedSummary).toMatchObject({
      grossSuccessfulKobo: 340000,
      processedRefundsKobo: 170000,
      netReceivedKobo: 170000,
      overpaymentKobo: 0,
      balanceDueKobo: 0
    });
    expect(internals.nextInvoiceStatusFromFinancialSummary(invoice, refundedSummary)).toBe("paid");
  });
});
