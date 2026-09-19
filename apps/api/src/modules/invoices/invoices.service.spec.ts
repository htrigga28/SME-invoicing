import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException
} from "@nestjs/common";

import { MAX_KOBO } from "../../common/money-limits";
import {
  auditLogs,
  payments,
  type BusinessProfile,
  type Customer,
  type Invoice,
  type InvoiceLineItem,
  type Payment
} from "../../database/schema";
import { InvoicesService } from "./invoices.service";

type ServiceInternals = {
  assertDateOrder: (issueDate: string, dueDate: string) => void;
  calculateAndValidateTotals: (
    lineItems: { description: string; quantity: number; unitPriceKobo: number }[],
    input: { discountKobo: number; taxKobo: number }
  ) => {
    amountPaidKobo: number;
    balanceDueKobo: number;
    discountKobo: number;
    lineTotalsKobo: number[];
    subtotalKobo: number;
    taxKobo: number;
    totalKobo: number;
  };
  normalizeLineItems: (
    lineItems: { description: string; quantity: number; unitPriceKobo: number }[]
  ) => { description: string; quantity: number; unitPriceKobo: number }[];
  findLineItems: jest.Mock;
  findPaymentAvailabilityAccount: jest.Mock;
  findPublicInvoice: jest.Mock;
  requireInvoice: jest.Mock;
  requireActivePaymentAccount: jest.Mock;
  createInvoice: jest.Mock;
  transitionInvoice: jest.Mock;
  getInvoice: jest.Mock;
  findStatusEvents: jest.Mock;
  findInvoiceAuditRows: jest.Mock;
  findPaymentsForInvoice: jest.Mock;
};

const activePaymentAccount = {
  id: "payment-account-1",
  providerSubaccountCode: "ACCT_test_subaccount",
  status: "active" as const,
  disabledAt: null
};

const now = new Date("2026-06-28T10:00:00.000Z");

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
    dueDate: "2099-07-15",
    customerReference: null,
    notes: "Thank you.",
    subtotalKobo: 100000,
    discountKobo: 10000,
    taxKobo: 7500,
    totalKobo: 97500,
    amountPaidKobo: 0,
    balanceDueKobo: 97500,
    sentAt: now,
    viewedAt: null,
    lastViewedAt: null,
    viewCount: 0,
    paidAt: null,
    cancelledAt: null,
    voidedAt: null,
    createdByUserId: "user-1",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "customer-1",
    organisationId: "org-1",
    name: "Lagos Bright Prints",
    email: "accounts@lagosbrightprints.test",
    phone: "+2348010000001",
    billingAddress: "14 Allen Avenue, Ikeja, Lagos",
    createdByUserId: "user-1",
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createBusinessProfile(overrides: Partial<BusinessProfile> = {}): BusinessProfile {
  return {
    id: "profile-1",
    organisationId: "org-1",
    businessName: "Akin & Co Creative Services",
    email: "billing@akinco.test",
    phone: "+2348012345678",
    address: "12 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
    logoFileId: null,
    setupCompletedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createLineItem(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  return {
    id: "line-1",
    organisationId: "org-1",
    invoiceId: "invoice-1",
    description: "Design retainer",
    quantity: "1.00",
    unitPriceKobo: 100000,
    lineTotalKobo: 100000,
    sortOrder: 0,
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
    providerAccessCode: null,
    providerAuthorizationUrl: null,
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

function createPublicInvoiceRow(invoice: Invoice = createInvoice()) {
  return {
    invoice,
    customer: createCustomer(),
    businessProfile: createBusinessProfile(),
    organisation: { name: "Akin & Co Creative Services" }
  };
}

function setup(
  databaseService: { db?: unknown } = {},
  paystackService: unknown = {},
  configService: unknown = {
    get: jest.fn((key: string) =>
      key === "FRONTEND_APP_URL" ? "http://localhost:3000" : undefined
    )
  },
  communicationsService: unknown = {
    getDeliverySummary: jest.fn(),
    recordInvoiceViewEvent: jest
      .fn()
      .mockResolvedValue({ occurredAt: now, viewCount: 1 })
  }
) {
  const service = new InvoicesService(
    databaseService as never,
    {} as never,
    configService as never,
    paystackService as never,
    { getInvoiceFinancialSummary: jest.fn() } as never,
    communicationsService as never
  );
  return service as unknown as ServiceInternals;
}

describe("InvoicesService validation helpers", () => {
  it("calculates line totals and invoice totals server-side", () => {
    const service = setup();

    expect(
      service.calculateAndValidateTotals(
        [
          { description: "Design", quantity: 2, unitPriceKobo: 10000 },
          { description: "Support", quantity: 1.5, unitPriceKobo: 20000 }
        ],
        { discountKobo: 5000, taxKobo: 7500 }
      )
    ).toEqual({
      lineTotalsKobo: [20000, 30000],
      subtotalKobo: 50000,
      discountKobo: 5000,
      taxKobo: 7500,
      totalKobo: 52500,
      amountPaidKobo: 0,
      balanceDueKobo: 52500
    });
  });

  it("rejects discounts greater than subtotal", () => {
    const service = setup();

    expect(() =>
      service.calculateAndValidateTotals(
        [{ description: "Design", quantity: 1, unitPriceKobo: 10000 }],
        { discountKobo: 10001, taxKobo: 0 }
      )
    ).toThrow(BadRequestException);
  });

  it("rejects due dates before issue dates", () => {
    const service = setup();

    expect(() => service.assertDateOrder("2026-06-28", "2026-06-27")).toThrow(BadRequestException);
  });

  it("normalizes and validates line item descriptions", () => {
    const service = setup();

    expect(
      service.normalizeLineItems([{ description: "  Design  ", quantity: 1, unitPriceKobo: 1000 }])
    ).toEqual([{ description: "Design", quantity: 1, unitPriceKobo: 1000 }]);
    expect(() =>
      service.normalizeLineItems([{ description: " ", quantity: 1, unitPriceKobo: 1000 }])
    ).toThrow(BadRequestException);
  });

  it("accepts the money ceiling and rejects line and subtotal overflow", () => {
    const service = setup();

    expect(
      service.calculateAndValidateTotals(
        [{ description: "Maximum", quantity: 1, unitPriceKobo: MAX_KOBO }],
        { discountKobo: 0, taxKobo: 0 }
      ).totalKobo
    ).toBe(MAX_KOBO);
    expect(() =>
      service.calculateAndValidateTotals(
        [{ description: "Overflow", quantity: 2, unitPriceKobo: MAX_KOBO }],
        { discountKobo: 0, taxKobo: 0 }
      )
    ).toThrow(BadRequestException);
    expect(() =>
      service.calculateAndValidateTotals(
        [
          { description: "First", quantity: 1, unitPriceKobo: MAX_KOBO },
          { description: "Second", quantity: 1, unitPriceKobo: 1 }
        ],
        { discountKobo: 0, taxKobo: 0 }
      )
    ).toThrow(BadRequestException);
  });
});

describe("InvoicesService duplication", () => {
  it("copies only allow-listed snapshots into a new draft request", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-17T10:00:00.000Z"));
    const service = setup();
    const source = createInvoice({
      issueDate: "2026-06-01",
      dueDate: "2026-06-15",
      customerReference: "PO-ORIGINAL",
      discountKobo: 500,
      taxKobo: 700
    });
    service.requireInvoice = jest
      .fn()
      .mockResolvedValue({ invoice: source, customer: createCustomer() });
    service.findLineItems = jest.fn().mockResolvedValue([createLineItem()]);
    service.createInvoice = jest.fn().mockResolvedValue({ invoice: { id: "new-invoice" } });
    const context = { activeOrganisation: { id: "org-1" }, user: { id: "user-1" } } as never;

    await expect(
      (service as unknown as InvoicesService).duplicateInvoice(context, source.id)
    ).resolves.toEqual({ invoice: { id: "new-invoice" } });

    expect(service.createInvoice).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        customerId: source.customerId,
        issueDate: "2026-09-17",
        dueDate: "2026-10-01",
        notes: source.notes,
        discountKobo: 500,
        taxKobo: 700,
        lineItems: [{ description: "Design retainer", quantity: 1, unitPriceKobo: 100000 }]
      })
    );
    expect(service.createInvoice.mock.calls[0][1]).not.toHaveProperty("customerReference");
    jest.useRealTimers();
  });

  it("rejects duplication for an archived customer", async () => {
    const service = setup();
    service.requireInvoice = jest.fn().mockResolvedValue({
      invoice: createInvoice(),
      customer: createCustomer({ archivedAt: now })
    });
    service.createInvoice = jest.fn();
    const context = { activeOrganisation: { id: "org-1" }, user: { id: "user-1" } } as never;

    await expect(
      (service as unknown as InvoicesService).duplicateInvoice(context, "invoice-1")
    ).rejects.toThrow(
      "Archived customers cannot be used for duplicated invoices. Reactivate the customer or choose an active customer."
    );
    expect(service.createInvoice).not.toHaveBeenCalled();
  });
});

describe("InvoicesService public invoice access", () => {
  it("returns safe customer-facing public invoice data for a valid token", async () => {
    const service = setup();
    service.findPublicInvoice = jest
      .fn()
      .mockResolvedValue(
        createPublicInvoiceRow(createInvoice({ customerReference: "PO-2026-042" }))
      );
    service.findLineItems = jest.fn().mockResolvedValue([createLineItem()]);
    service.findPaymentAvailabilityAccount = jest.fn().mockResolvedValue(activePaymentAccount);

    const response = await (service as unknown as InvoicesService).getPublicInvoice("public-token");

    expect(response.invoice).toMatchObject({
      invoiceNumber: "INV-000001",
      status: "sent",
      totalKobo: 97500,
      customerReference: "PO-2026-042"
    });
    expect(response.business).toMatchObject({ businessName: "Akin & Co Creative Services" });
    expect(response.customer).toMatchObject({ name: "Lagos Bright Prints" });
    expect(response.paymentSummary).toMatchObject({
      available: true,
      provider: "paystack",
      amountKobo: 97500,
      currency: "NGN"
    });
    expect(response.lineItems).toEqual([
      {
        description: "Design retainer",
        quantity: 1,
        unitPriceKobo: 100000,
        lineTotalKobo: 100000,
        sortOrder: 0
      }
    ]);
    expect(JSON.stringify(response)).not.toMatch(
      /organisationId|customerId|createdByUserId|publicToken|providerSubaccountCode|metadataRedacted|auditLogs/
    );
  });

  it("shows payment setup incomplete when no active payment account exists", async () => {
    const service = setup();
    service.findPublicInvoice = jest.fn().mockResolvedValue(createPublicInvoiceRow());
    service.findLineItems = jest.fn().mockResolvedValue([createLineItem()]);
    service.findPaymentAvailabilityAccount = jest.fn().mockResolvedValue(null);

    const response = await (service as unknown as InvoicesService).getPublicInvoice("public-token");

    expect(response.paymentSummary).toEqual({
      available: false,
      reason: "payment_setup_incomplete",
      message: "This business has not activated online payments yet."
    });
  });

  it.each([
    {
      account: { ...activePaymentAccount, status: "verification_delayed" as const },
      reason: "payment_setup_pending",
      message: "Online payments are not active for this business yet."
    },
    {
      account: { ...activePaymentAccount, status: "disabled" as const, disabledAt: now },
      reason: "payment_setup_disabled",
      message: "Online payments are currently disabled for this business."
    }
  ])("shows $reason when payment setup is not active", async ({ account, message, reason }) => {
    const service = setup();
    service.findPublicInvoice = jest.fn().mockResolvedValue(createPublicInvoiceRow());
    service.findLineItems = jest.fn().mockResolvedValue([createLineItem()]);
    service.findPaymentAvailabilityAccount = jest.fn().mockResolvedValue(account);

    const response = await (service as unknown as InvoicesService).getPublicInvoice("public-token");

    expect(response.paymentSummary).toEqual({
      available: false,
      reason,
      message
    });
  });

  it.each([
    createInvoice({ publicAccessEnabled: false }),
    createInvoice({ status: "void" }),
    createInvoice({ status: "cancelled" }),
    createInvoice({ status: "draft" })
  ])("rejects unavailable public invoices safely", async (invoice) => {
    const service = setup();
    service.findPublicInvoice = jest.fn().mockResolvedValue(createPublicInvoiceRow(invoice));

    await expect(
      (service as unknown as InvoicesService).getPublicInvoice("public-token")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects invalid public tokens safely", async () => {
    const service = setup();
    service.findPublicInvoice = jest.fn().mockResolvedValue(undefined);

    await expect(
      (service as unknown as InvoicesService).getPublicInvoice("missing-token")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("InvoicesService public payment initialization", () => {
  function createPaymentDb(payment: Payment = createPayment()) {
    const paymentInsertReturning = jest.fn().mockResolvedValue([payment]);
    const paymentInsertValues = jest.fn(() => ({
      returning: paymentInsertReturning
    }));
    const auditInsertValues = jest.fn().mockResolvedValue(undefined);
    const updateReturning = jest.fn().mockResolvedValue([
      createPayment({
        ...payment,
        providerAccessCode: "access-code",
        providerAuthorizationUrl: "https://checkout.paystack.test/pay/reference"
      })
    ]);
    const updateWhere = jest.fn(() => ({
      returning: updateReturning
    }));
    const updateSet = jest.fn(() => ({
      where: updateWhere
    }));
    const insert = jest.fn((table) => ({
      values:
        table === payments
          ? paymentInsertValues
          : table === auditLogs
            ? auditInsertValues
            : auditInsertValues
    }));
    const update = jest.fn(() => ({
      set: updateSet
    }));

    return {
      db: { insert, update },
      auditInsertValues,
      insert,
      paymentInsertValues,
      update,
      updateSet
    };
  }

  it.each(["sent", "viewed", "overdue"] as const)(
    "initializes Paystack payment for %s invoices using the server balance",
    async (status) => {
      const db = createPaymentDb();
      const paystackService = {
        initializeTransaction: jest.fn().mockResolvedValue({
          authorizationUrl: "https://checkout.paystack.test/pay/reference",
          accessCode: "access-code",
          reference: "SME-INV000001-ABC123"
        })
      };
      const service = setup({ db: db.db }, paystackService);
      service.findPublicInvoice = jest.fn().mockResolvedValue(
        createPublicInvoiceRow(
          createInvoice({
            balanceDueKobo: 42500,
            dueDate: status === "overdue" ? "2026-01-01" : "2099-07-15",
            status: status === "overdue" ? "sent" : status
          })
        )
      );
      service.requireActivePaymentAccount = jest.fn().mockResolvedValue(activePaymentAccount);

      await expect(
        (service as unknown as InvoicesService).initializePublicInvoicePayment("public-token")
      ).resolves.toEqual({
        authorizationUrl: "https://checkout.paystack.test/pay/reference",
        accessCode: "access-code",
        reference: expect.stringMatching(/^SME-INV000001-[A-F0-9]{8}$/)
      });

      expect(db.paymentInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          amountKobo: 42500,
          currency: "NGN",
          invoiceId: "invoice-1",
          organisationId: "org-1",
          provider: "paystack",
          providerSubaccountCode: "ACCT_test_subaccount",
          status: "pending"
        })
      );
      expect(paystackService.initializeTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          amountKobo: 42500,
          bearer: "subaccount",
          callbackUrl: expect.stringContaining("/invoice/public-token?payment=callback&reference="),
          currency: "NGN",
          email: "accounts@lagosbrightprints.test",
          reference: expect.stringMatching(/^SME-INV000001-[A-F0-9]{8}$/),
          subaccount: "ACCT_test_subaccount"
        })
      );
      expect(JSON.stringify(paystackService.initializeTransaction.mock.calls)).not.toContain(
        "frontend-subaccount"
      );
      expect(db.update).toHaveBeenCalledWith(payments);
      expect(db.updateSet).toHaveBeenCalledWith(
        expect.not.objectContaining({
          amountPaidKobo: expect.any(Number),
          balanceDueKobo: expect.any(Number),
          status: "paid"
        })
      );
      expect(db.auditInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "payment_initialized",
          actorUserId: null,
          entityType: "payment"
        })
      );
    }
  );

  it("rejects invoices that are not payable before creating a payment", async () => {
    const db = createPaymentDb();
    const paystackService = {
      initializeTransaction: jest.fn()
    };
    const service = setup({ db: db.db }, paystackService);
    service.findPublicInvoice = jest
      .fn()
      .mockResolvedValue(
        createPublicInvoiceRow(createInvoice({ status: "paid", balanceDueKobo: 0 }))
      );

    await expect(
      (service as unknown as InvoicesService).initializePublicInvoicePayment("public-token")
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(db.insert).not.toHaveBeenCalled();
    expect(paystackService.initializeTransaction).not.toHaveBeenCalled();
  });

  it("uses a reactivated payment account subaccount for Paystack initialization", async () => {
    const reactivatedAccount = {
      ...activePaymentAccount,
      id: "reactivated-payment-account",
      providerSubaccountCode: "ACCT_reactivated"
    };
    const db = createPaymentDb(createPayment({ providerSubaccountCode: "ACCT_reactivated" }));
    const paystackService = {
      initializeTransaction: jest.fn().mockResolvedValue({
        authorizationUrl: "https://checkout.paystack.test/pay/reference",
        accessCode: "access-code",
        reference: "SME-INV000001-ABC123"
      })
    };
    const service = setup({ db: db.db }, paystackService);
    service.findPublicInvoice = jest.fn().mockResolvedValue(createPublicInvoiceRow());
    service.requireActivePaymentAccount = jest.fn().mockResolvedValue(reactivatedAccount);

    await (service as unknown as InvoicesService).initializePublicInvoicePayment("public-token");

    expect(db.paymentInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        providerSubaccountCode: "ACCT_reactivated"
      })
    );
    expect(paystackService.initializeTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        subaccount: "ACCT_reactivated",
        bearer: "subaccount"
      })
    );
  });

  it.each([
    "This business has not activated online payments yet.",
    "Online payments are not active for this business yet. Please try again later.",
    "Online payments are currently disabled for this business."
  ])("rejects setup-unavailable payments before creating a payment row: %s", async (message) => {
    const db = createPaymentDb();
    const paystackService = {
      initializeTransaction: jest.fn()
    };
    const service = setup({ db: db.db }, paystackService);
    service.findPublicInvoice = jest.fn().mockResolvedValue(createPublicInvoiceRow());
    service.requireActivePaymentAccount = jest.fn().mockRejectedValue(new Error(message));

    await expect(
      (service as unknown as InvoicesService).initializePublicInvoicePayment("public-token")
    ).rejects.toThrow(message);

    expect(db.insert).not.toHaveBeenCalled();
    expect(paystackService.initializeTransaction).not.toHaveBeenCalled();
  });

  it("marks the pending payment failed and returns a safe error when Paystack fails", async () => {
    const db = createPaymentDb();
    const paystackService = {
      initializeTransaction: jest.fn().mockRejectedValue(new Error("secret provider detail"))
    };
    const service = setup({ db: db.db }, paystackService);
    service.findPublicInvoice = jest.fn().mockResolvedValue(createPublicInvoiceRow());
    service.requireActivePaymentAccount = jest.fn().mockResolvedValue(activePaymentAccount);

    await expect(
      (service as unknown as InvoicesService).initializePublicInvoicePayment("public-token")
    ).rejects.toThrow("Payment initialization failed. Please try again later.");

    expect(db.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        gatewayResponse: "Payment initialization failed."
      })
    );
    expect(db.auditInsertValues).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "payment_initialized" })
    );
  });

  it("propagates safe Paystack validation messages to the public client", async () => {
    const db = createPaymentDb();
    const paystackService = {
      initializeTransaction: jest
        .fn()
        .mockRejectedValue(new UnprocessableEntityException("Invalid Email Address Passed"))
    };
    const service = setup({ db: db.db }, paystackService);
    service.findPublicInvoice = jest.fn().mockResolvedValue(createPublicInvoiceRow());
    service.requireActivePaymentAccount = jest.fn().mockResolvedValue(activePaymentAccount);

    await expect(
      (service as unknown as InvoicesService).initializePublicInvoicePayment("public-token")
    ).rejects.toThrow("Invalid Email Address Passed");

    expect(db.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        gatewayResponse: "Invalid Email Address Passed"
      })
    );
  });
});

describe("InvoicesService public view tracking", () => {
  function createTransactionDb(updateRows: Invoice[] = [createInvoice({ status: "viewed" })]) {
    const insertValues = jest.fn().mockResolvedValue(undefined);
    const tx = {
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue(updateRows)
          }))
        }))
      })),
      insert: jest.fn(() => ({
        values: insertValues
      }))
    };
    const db = {
      transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<void>) =>
        callback(tx)
      )
    };

    return { db, insertValues, tx };
  }

  it("moves a sent invoice to viewed and writes one status event and audit log", async () => {
    const { db, insertValues } = createTransactionDb();
    const recordInvoiceViewEvent = jest
      .fn()
      .mockResolvedValue({ occurredAt: now, viewCount: 1 });
    const service = setup(
      { db },
      {},
      undefined,
      { getDeliverySummary: jest.fn(), recordInvoiceViewEvent }
    );
    service.findPublicInvoice = jest.fn().mockResolvedValue(createPublicInvoiceRow());

    await expect(
      (service as unknown as InvoicesService).markPublicInvoiceViewed("public-token")
    ).resolves.toEqual({ success: true, viewCount: 1, firstViewedAt: now, lastViewedAt: now });

    expect(recordInvoiceViewEvent).toHaveBeenCalledWith("org-1", "invoice-1");
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: null,
        fromStatus: "sent",
        reason: "invoice_viewed",
        toStatus: "viewed"
      })
    );
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "invoice_viewed",
        actorUserId: null,
        entityType: "invoice"
      })
    );
  });

  it("does not duplicate viewed transitions for repeated views", async () => {
    const { db } = createTransactionDb();
    const recordInvoiceViewEvent = jest
      .fn()
      .mockResolvedValue({ occurredAt: now, viewCount: 4 });
    const service = setup(
      { db },
      {},
      undefined,
      { getDeliverySummary: jest.fn(), recordInvoiceViewEvent }
    );
    service.findPublicInvoice = jest
      .fn()
      .mockResolvedValue(
        createPublicInvoiceRow(createInvoice({ status: "viewed", viewedAt: now }))
      );

    await expect(
      (service as unknown as InvoicesService).markPublicInvoiceViewed("public-token")
    ).resolves.toEqual(expect.objectContaining({ success: true, viewCount: 4 }));

    expect(recordInvoiceViewEvent).toHaveBeenCalledWith("org-1", "invoice-1");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("does not move overdue invoices back to viewed", async () => {
    const { db } = createTransactionDb();
    const recordInvoiceViewEvent = jest
      .fn()
      .mockResolvedValue({ occurredAt: now, viewCount: 2 });
    const service = setup(
      { db },
      {},
      undefined,
      { getDeliverySummary: jest.fn(), recordInvoiceViewEvent }
    );
    service.findPublicInvoice = jest
      .fn()
      .mockResolvedValue(createPublicInvoiceRow(createInvoice({ dueDate: "2026-01-01" })));

    await expect(
      (service as unknown as InvoicesService).markPublicInvoiceViewed("public-token")
    ).resolves.toEqual(expect.objectContaining({ success: true, viewCount: 2 }));

    expect(recordInvoiceViewEvent).toHaveBeenCalledWith("org-1", "invoice-1");
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

describe("InvoicesService T021 send and resend", () => {
  const draftRow = () =>
    createInvoice({
      status: "draft",
      publicAccessEnabled: false,
      sentAt: null,
      totalKobo: 7840000,
      balanceDueKobo: 7840000
    });

  function setupSend(overrides: {
    invoice?: ReturnType<typeof createInvoice>;
    sendInvoiceEmail?: jest.Mock;
    resendInvoiceEmail?: jest.Mock;
    deliverySummary?: unknown;
  } = {}) {
    const service = setup();
    const invoice = overrides.invoice ?? draftRow();
    service.requireInvoice = jest.fn().mockResolvedValue({ invoice, customer: createCustomer() });
    service.transitionInvoice = jest.fn().mockResolvedValue(undefined);
    service.getInvoice = jest
      .fn()
      .mockResolvedValue({ invoice: { id: invoice.id }, publicUrl: null });
    const sendInvoiceEmail =
      overrides.sendInvoiceEmail ??
      jest.fn().mockResolvedValue({ communication: { id: "comm-1" }, outcome: "accepted" });
    const resendInvoiceEmail =
      overrides.resendInvoiceEmail ??
      jest.fn().mockResolvedValue({ communication: { id: "comm-2" }, outcome: "accepted" });
    const getDeliverySummary = jest
      .fn()
      .mockResolvedValue(
        overrides.deliverySummary ?? {
          state: "accepted",
          attempts: 1,
          lastCommunication: { id: "comm-1", status: "accepted" }
        }
      );
    (service as unknown as { communicationsService: unknown }).communicationsService = {
      sendInvoiceEmail,
      resendInvoiceEmail,
      getDeliverySummary
    };
    const context = {
      activeOrganisation: { id: "org-1", name: "Adebayo Studio" },
      user: { id: "user-1" },
      businessProfile: { businessName: "Adebayo Studio", email: "billing@adebayo.example" }
    } as never;
    return { context, getDeliverySummary, sendInvoiceEmail, service };
  }

  it("issues a draft and sends the delivery email with normalized recipients", async () => {
    const { context, sendInvoiceEmail, service } = setupSend();

    const result = await (service as unknown as InvoicesService).sendInvoice(context, "invoice-1", {
      to: [" Accounts@Northstar.Example "],
      cc: ["finance@northstar.example", "accounts@northstar.example"]
    });

    expect(service.transitionInvoice).toHaveBeenCalledTimes(1);
    expect(sendInvoiceEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          to: ["accounts@northstar.example"],
          cc: ["finance@northstar.example"]
        })
      })
    );
    expect(result.delivery).toMatchObject({ state: "accepted", attempts: 1 });
    expect(result.publicUrl).toContain("/invoice/");
  });

  it("keeps the invoice issued when the provider fails after issuance", async () => {
    const sendInvoiceEmail = jest.fn().mockRejectedValue(new BadGatewayException("down"));
    const { context, service } = setupSend({
      sendInvoiceEmail,
      deliverySummary: {
        state: "failed",
        attempts: 1,
        lastCommunication: { id: "comm-1", status: "failed" }
      }
    });

    const result = await (service as unknown as InvoicesService).sendInvoice(context, "invoice-1", {
      to: ["accounts@northstar.example"]
    });

    expect(service.transitionInvoice).toHaveBeenCalledTimes(1);
    expect(result.delivery.state).toBe("failed");
    expect(result.delivery.message).toContain("Copy the public link");
  });

  it("still issues the invoice when email delivery is not configured", async () => {
    const sendInvoiceEmail = jest
      .fn()
      .mockRejectedValue(new ServiceUnavailableException("not configured"));
    const { context, service } = setupSend({
      sendInvoiceEmail,
      deliverySummary: { state: "not_emailed", attempts: 0, lastCommunication: null }
    });

    const result = await (service as unknown as InvoicesService).sendInvoice(context, "invoice-1");

    expect(service.transitionInvoice).toHaveBeenCalledTimes(1);
    expect(result.delivery.state).toBe("not_emailed");
    expect(result.delivery.message).toContain("not configured");
  });

  it("reports an uncertain delivery without failing when confirmation is ambiguous", async () => {
    const sendInvoiceEmail = jest.fn().mockResolvedValue({
      communication: { id: "comm-1" },
      outcome: "uncertain"
    });
    const { context, service } = setupSend({
      sendInvoiceEmail,
      deliverySummary: {
        state: "uncertain",
        attempts: 1,
        lastCommunication: { id: "comm-1", status: "submission_uncertain" }
      }
    });

    const result = await (service as unknown as InvoicesService).sendInvoice(context, "invoice-1", {
      to: ["accounts@northstar.example"]
    });

    expect(service.transitionInvoice).toHaveBeenCalledTimes(1);
    expect(result.delivery.state).toBe("uncertain");
    expect(result.delivery.message).toContain("may still have been sent");
  });

  it("rejects invalid recipients before issuing the invoice", async () => {
    const { context, service } = setupSend();

    await expect(
      (service as unknown as InvoicesService).sendInvoice(context, "invoice-1", {
        to: ["not-an-email"]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.transitionInvoice).not.toHaveBeenCalled();
  });

  it("resends with a new attempt on an issued invoice", async () => {
    const { context, service } = setupSend({
      invoice: createInvoice({ status: "sent", publicAccessEnabled: true, sentAt: now })
    });
    const resendInvoiceEmail = jest.fn().mockResolvedValue({
      communication: { id: "comm-2" },
      outcome: "accepted"
    });
    (service as unknown as { communicationsService: Record<string, unknown> }).communicationsService
      .resendInvoiceEmail = resendInvoiceEmail;

    const result = await (service as unknown as InvoicesService).resendInvoiceEmail(
      context,
      "invoice-1",
      { to: ["accounts@northstar.example"] }
    );

    expect(resendInvoiceEmail).toHaveBeenCalledTimes(1);
    expect(result.delivery).toMatchObject({ state: "accepted" });
  });

  it.each([
    ["draft", false],
    ["cancelled", true],
    ["void", true]
  ])("rejects resend for %s invoices", async (status) => {
    const { context, service } = setupSend({
      invoice: createInvoice({
        status: status as "draft" | "cancelled" | "void",
        publicAccessEnabled: status !== "draft"
      })
    });
    const resendInvoiceEmail = jest.fn();
    (service as unknown as { communicationsService: Record<string, unknown> }).communicationsService
      .resendInvoiceEmail = resendInvoiceEmail;

    await expect(
      (service as unknown as InvoicesService).resendInvoiceEmail(context, "invoice-1", {
        to: ["accounts@northstar.example"]
      })
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(resendInvoiceEmail).not.toHaveBeenCalled();
  });
});

describe("InvoicesService invoice activity", () => {
  it("merges lifecycle sources in reverse chronological order without sensitive data", async () => {
    const selectQuery: Record<string, jest.Mock> = {};
    selectQuery.from = jest.fn(() => selectQuery);
    selectQuery.where = jest.fn(() => selectQuery);
    selectQuery.orderBy = jest.fn(async () => []);
    const service = setup({ db: { select: jest.fn(() => selectQuery) } });
    const invoice = createInvoice({
      status: "paid",
      sentAt: new Date("2026-09-18T09:14:00.000Z"),
      viewedAt: new Date("2026-09-18T09:26:00.000Z"),
      lastViewedAt: new Date("2026-09-19T08:44:00.000Z"),
      viewCount: 4,
      paidAt: new Date("2026-09-19T08:52:00.000Z")
    });
    service.requireInvoice = jest.fn().mockResolvedValue({ invoice, customer: createCustomer() });
    service.findStatusEvents = jest.fn().mockResolvedValue([
      {
        id: "se-1",
        fromStatus: null,
        toStatus: "draft",
        reason: "invoice_created",
        createdAt: new Date("2026-09-18T09:14:00.000Z")
      },
      {
        id: "se-2",
        fromStatus: "draft",
        toStatus: "sent",
        reason: "invoice_sent",
        createdAt: new Date("2026-09-18T09:18:00.000Z")
      }
    ]);
    service.findInvoiceAuditRows = jest.fn().mockResolvedValue([
      {
        auditLog: {
          id: "al-1",
          action: "invoice_updated",
          createdAt: new Date("2026-09-18T09:16:00.000Z")
        },
        actor: { name: "Ada Owner" }
      }
    ]);
    service.findPaymentsForInvoice = jest.fn().mockResolvedValue([
      {
        id: "pay-1",
        providerReference: "T8129-4F3A-90LX",
        status: "successful",
        reconciliationState: "matched",
        amountKobo: 7840000,
        paidAt: new Date("2026-09-19T08:52:00.000Z"),
        createdAt: new Date("2026-09-19T08:51:00.000Z"),
        initializedAt: new Date("2026-09-19T08:51:00.000Z"),
        receipt: {
          id: "rct-1",
          receiptNumber: "RCT-000241",
          issuedAt: new Date("2026-09-19T08:52:00.000Z")
        }
      }
    ]);
    (service as unknown as { communicationsService: unknown }).communicationsService = {
      listCommunicationsForInvoice: jest.fn().mockResolvedValue({
        communications: [
          {
            id: "comm-1",
            toRecipients: ["accounts@northstar.example"],
            status: "delivered",
            acceptedAt: new Date("2026-09-18T09:18:00.000Z"),
            deliveredAt: new Date("2026-09-18T09:19:00.000Z"),
            deferredAt: null,
            failedAt: null,
            failureReason: null
          }
        ],
        events: []
      })
    };
    const context = { activeOrganisation: { id: "org-1" }, user: { id: "user-1" } } as never;

    const result = await (service as unknown as InvoicesService).getInvoiceActivity(
      context,
      "invoice-1"
    );

    const types = result.activity.map((item) => item.type);
    expect(types).toEqual([
      "payment_confirmed",
      "reconciliation_matched",
      "receipt_issued",
      "payment_started",
      "invoice_viewed",
      "email_delivered",
      "invoice_sent",
      "email_accepted",
      "invoice_edited",
      "invoice_created"
    ]);
    expect(result.viewSummary).toMatchObject({ viewCount: 4 });
    const viewed = result.activity.find((item) => item.type === "invoice_viewed");
    expect(viewed?.detail).toContain("Viewed 4 times");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("organisationId");
    expect(serialized).not.toContain("publicToken");
    expect(serialized).not.toContain("providerSubaccountCode");
  });
});
