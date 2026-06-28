import { BadRequestException, NotFoundException } from "@nestjs/common";

import type { BusinessProfile, Customer, Invoice, InvoiceLineItem } from "../../database/schema";
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
  findPublicInvoice: jest.Mock;
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

function createPublicInvoiceRow(invoice: Invoice = createInvoice()) {
  return {
    invoice,
    customer: createCustomer(),
    businessProfile: createBusinessProfile(),
    organisation: { name: "Akin & Co Creative Services" }
  };
}

function setup(databaseService: { db?: unknown } = {}) {
  const service = new InvoicesService(databaseService as never, {} as never, {} as never);
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

    const response = await (service as unknown as InvoicesService).getPublicInvoice("public-token");

    expect(response.invoice).toMatchObject({
      invoiceNumber: "INV-000001",
      status: "sent",
      totalKobo: 97500
    });
    expect(response.business).toMatchObject({ businessName: "Akin & Co Creative Services" });
    expect(response.customer).toMatchObject({ name: "Lagos Bright Prints" });
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
      /organisationId|customerId|createdByUserId|publicToken|metadataRedacted|auditLogs/
    );
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
