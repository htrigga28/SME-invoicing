import { BadRequestException, NotFoundException } from "@nestjs/common";

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
  requireActivePaymentAccount: jest.Mock;
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
    dueDate: "2026-07-01",
    notes: "Thank you.",
    subtotalKobo: 100000,
    discountKobo: 10000,
    taxKobo: 7500,
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
  }
) {
  const service = new InvoicesService(
    databaseService as never,
    {} as never,
    configService as never,
    paystackService as never
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
});

describe("InvoicesService public invoice access", () => {
  it("returns safe customer-facing public invoice data for a valid token", async () => {
    const service = setup();
    service.findPublicInvoice = jest.fn().mockResolvedValue(createPublicInvoiceRow());
    service.findLineItems = jest.fn().mockResolvedValue([createLineItem()]);
    service.findPaymentAvailabilityAccount = jest.fn().mockResolvedValue(activePaymentAccount);

    const response = await (service as unknown as InvoicesService).getPublicInvoice("public-token");

    expect(response.invoice).toMatchObject({
      invoiceNumber: "INV-000001",
      status: "sent",
      totalKobo: 97500
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
            dueDate: status === "overdue" ? "2026-01-01" : "2026-07-01",
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
    const service = setup({ db });
    service.findPublicInvoice = jest.fn().mockResolvedValue(createPublicInvoiceRow());

    await expect(
      (service as unknown as InvoicesService).markPublicInvoiceViewed("public-token")
    ).resolves.toEqual({ success: true });

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
    const service = setup({ db });
    service.findPublicInvoice = jest
      .fn()
      .mockResolvedValue(
        createPublicInvoiceRow(createInvoice({ status: "viewed", viewedAt: now }))
      );

    await (service as unknown as InvoicesService).markPublicInvoiceViewed("public-token");

    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("does not move overdue invoices back to viewed", async () => {
    const { db } = createTransactionDb();
    const service = setup({ db });
    service.findPublicInvoice = jest
      .fn()
      .mockResolvedValue(createPublicInvoiceRow(createInvoice({ dueDate: "2026-01-01" })));

    await (service as unknown as InvoicesService).markPublicInvoiceViewed("public-token");

    expect(db.transaction).not.toHaveBeenCalled();
  });
});
