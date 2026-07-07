import { NotFoundException, UnprocessableEntityException } from "@nestjs/common";

import {
  auditLogs,
  receipts,
  type Customer,
  type Invoice,
  type Payment,
  type PaymentRefund,
  type Receipt
} from "../../database/schema";
import { ReceiptsService } from "./receipts.service";

const now = new Date("2026-06-30T10:00:00.000Z");

function createReceipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: "receipt-1",
    organisationId: "org-1",
    paymentId: "payment-1",
    invoiceId: "invoice-1",
    customerId: "customer-1",
    receiptNumber: "RCT-000001",
    publicToken: "public-token",
    publicAccessEnabled: true,
    currency: "NGN",
    amountKobo: 100000,
    paymentProvider: "paystack",
    paymentReference: "PAYSTACK_REF",
    paymentChannel: "card",
    paidAt: now,
    issuedAt: now,
    businessName: "Akin & Co Creative Services",
    businessEmail: "billing@akinco.com",
    businessPhone: "+2348012345678",
    businessAddress: "12 Admiralty Way",
    customerName: "Lagos Bright Prints",
    customerEmail: "accounts@lagosbrightprints.com",
    customerPhone: "+2348010000001",
    customerBillingAddress: "14 Allen Avenue",
    invoiceNumber: "INV-000001",
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
    providerReference: "PAYSTACK_REF",
    providerSubaccountCode: "ACCT_do_not_expose",
    providerAccessCode: "access",
    providerAuthorizationUrl: "https://checkout.paystack.test",
    status: "successful",
    currency: "NGN",
    amountKobo: 100000,
    paidAt: now,
    failedAt: null,
    abandonedAt: null,
    channel: "card",
    gatewayResponse: "Successful",
    metadataRedacted: null,
    initializedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    organisationId: "org-1",
    customerId: "customer-1",
    invoiceNumber: "INV-000001",
    publicToken: "invoice-token",
    publicAccessEnabled: true,
    status: "paid",
    currency: "NGN",
    issueDate: "2026-06-01",
    dueDate: "2026-07-01",
    notes: null,
    subtotalKobo: 100000,
    discountKobo: 0,
    taxKobo: 0,
    totalKobo: 100000,
    amountPaidKobo: 100000,
    balanceDueKobo: 0,
    sentAt: now,
    viewedAt: null,
    paidAt: now,
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
    email: "accounts@lagosbrightprints.com",
    phone: "+2348010000001",
    billingAddress: "14 Allen Avenue",
    createdByUserId: "user-1",
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createRefund(overrides: Partial<PaymentRefund> = {}): PaymentRefund {
  return {
    id: "refund-1",
    organisationId: "org-1",
    paymentId: "payment-1",
    provider: "paystack",
    providerRefundId: "refund-provider-1",
    amountKobo: 25000,
    currency: "NGN",
    status: "processed",
    reason: "Partial refund",
    customerNote: null,
    merchantNote: null,
    initiatedByUserId: "user-1",
    processedAt: now,
    failedAt: null,
    needsAttentionAt: null,
    providerMetadataRedacted: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function setup() {
  const service = new ReceiptsService(
    { db: {} } as never,
    { get: jest.fn(() => "http://localhost:3000") } as never
  );

  return { service };
}

describe("ReceiptsService", () => {
  it("returns an existing receipt without creating another receipt number", async () => {
    const { service } = setup();
    const existing = createReceipt();
    const internals = service as unknown as {
      findReceiptByPayment: jest.Mock;
      nextReceiptSequenceNumber: jest.Mock;
    };
    internals.findReceiptByPayment = jest.fn().mockResolvedValue(existing);
    internals.nextReceiptSequenceNumber = jest.fn();

    await expect(
      service.ensureReceiptForSuccessfulPayment({} as never, "payment-1")
    ).resolves.toEqual({
      created: false,
      receipt: existing
    });
    expect(internals.nextReceiptSequenceNumber).not.toHaveBeenCalled();
  });

  it("creates an immutable receipt snapshot and safe audit log for a successful payment", async () => {
    const { service } = setup();
    const created = createReceipt();
    const insertValues = jest.fn().mockReturnThis();
    const onConflictDoNothing = jest.fn().mockReturnThis();
    const returning = jest.fn().mockResolvedValue([created]);
    const auditValues = jest.fn().mockResolvedValue(undefined);
    const tx = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          {
            businessProfile: {
              businessName: "Akin & Co Creative Services",
              email: "billing@akinco.com",
              phone: "+2348012345678",
              address: "12 Admiralty Way"
            },
            customer: createCustomer(),
            invoice: createInvoice(),
            organisation: { id: "org-1", name: "Akin & Co Creative Services" },
            payment: createPayment()
          }
        ])
      }),
      insert: jest.fn((table) => {
        if (table === receipts) {
          return { values: insertValues, onConflictDoNothing, returning };
        }

        if (table === auditLogs) {
          return { values: auditValues };
        }

        throw new Error("Unexpected insert table.");
      })
    };
    const internals = service as unknown as {
      findReceiptByPayment: jest.Mock;
      generatePublicToken: jest.Mock;
      nextReceiptSequenceNumber: jest.Mock;
    };
    internals.findReceiptByPayment = jest.fn().mockResolvedValueOnce(null);
    internals.generatePublicToken = jest.fn().mockReturnValue("public-token");
    internals.nextReceiptSequenceNumber = jest.fn().mockResolvedValue(1);

    const result = await service.ensureReceiptForSuccessfulPayment(tx as never, "payment-1");

    expect(result.created).toBe(true);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        amountKobo: 100000,
        receiptNumber: "RCT-000001",
        publicToken: "public-token",
        businessName: "Akin & Co Creative Services",
        customerEmail: "accounts@lagosbrightprints.com",
        invoiceNumber: "INV-000001",
        paymentReference: "PAYSTACK_REF"
      })
    );
    expect(JSON.stringify(insertValues.mock.calls)).not.toContain("ACCT_do_not_expose");
    expect(auditValues).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "receipt_generated",
        metadataRedacted: expect.not.objectContaining({
          providerSubaccountCode: expect.anything()
        })
      })
    );
  });

  it("rejects receipt creation for non-successful payments", async () => {
    const { service } = setup();
    const tx = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          {
            businessProfile: null,
            customer: createCustomer(),
            invoice: createInvoice(),
            organisation: { id: "org-1", name: "Akin & Co Creative Services" },
            payment: createPayment({ status: "pending" })
          }
        ])
      })
    };
    const internals = service as unknown as {
      findReceiptByPayment: jest.Mock;
    };
    internals.findReceiptByPayment = jest.fn().mockResolvedValue(null);

    await expect(
      service.ensureReceiptForSuccessfulPayment(tx as never, "payment-1")
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("derives refund summaries without mutating original receipt amount", async () => {
    const { service } = setup();
    const row = {
      customer: createCustomer(),
      invoice: createInvoice(),
      payment: createPayment(),
      receipt: createReceipt({ amountKobo: 100000 }),
      refunds: [
        createRefund({ amountKobo: 30000, status: "processed" }),
        createRefund({ id: "refund-2", amountKobo: 20000, status: "processing" })
      ]
    };
    const internals = service as unknown as {
      findReceiptRows: jest.Mock;
    };
    internals.findReceiptRows = jest.fn().mockResolvedValue([row]);

    const response = await service.listReceipts({ activeOrganisation: { id: "org-1" } } as never, {
      refundState: "partially_refunded"
    });

    expect(response.receipts).toHaveLength(1);
    expect(response.receipts[0]?.amountKobo).toBe(100000);
    expect(response.receipts[0]?.refundSummary).toEqual({
      originalAmountKobo: 100000,
      processedRefundedKobo: 30000,
      netRetainedKobo: 70000,
      refundState: "partially_refunded",
      hasRefundInProgress: true
    });
  });

  it("returns safe public receipt data without internal IDs", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPublicReceiptRows: jest.Mock;
    };
    internals.findPublicReceiptRows = jest.fn().mockResolvedValue([
      {
        customer: createCustomer(),
        invoice: createInvoice(),
        payment: createPayment(),
        receipt: createReceipt(),
        refunds: []
      }
    ]);

    const response = await service.getPublicReceipt("public-token");

    expect(JSON.stringify(response)).not.toContain("org-1");
    expect(response.receipt).toEqual(
      expect.objectContaining({
        receiptNumber: "RCT-000001",
        amountKobo: 100000,
        business: expect.objectContaining({ name: "Akin & Co Creative Services" }),
        customer: expect.not.objectContaining({ id: expect.anything() }),
        invoice: expect.not.objectContaining({ id: expect.anything() }),
        payment: expect.not.objectContaining({ id: expect.anything() })
      })
    );
  });

  it("returns a safe 404 for unavailable public receipts", async () => {
    const { service } = setup();
    const internals = service as unknown as {
      findPublicReceiptRows: jest.Mock;
    };
    internals.findPublicReceiptRows = jest.fn().mockResolvedValue([]);

    await expect(service.getPublicReceipt("missing-token")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
