import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException
} from "@nestjs/common";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import type { Customer, Invoice } from "../../database/schema";
import { CustomersService } from "./customers.service";

const now = new Date("2026-01-01T00:00:00.000Z");

function createContext(
  role: "owner" | "admin" | "accountant" | "viewer" = "owner"
): ActiveOrganisationContext {
  return {
    user: {
      id: "user-1",
      email: "owner@example.com",
      name: "Owner User",
      createdAt: now,
      updatedAt: now
    },
    activeOrganisation: {
      id: "org-1",
      name: "Demo Org",
      slug: "demo-org",
      onboardingCompletedAt: now,
      createdAt: now,
      updatedAt: now
    },
    membership: {
      id: "member-1",
      organisationId: "org-1",
      userId: "user-1",
      role,
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    businessProfile: {
      id: "profile-1",
      organisationId: "org-1",
      businessName: "Demo Org",
      email: "billing@example.com",
      phone: "+2348010000000",
      address: "Lagos",
      logoFileId: null,
      setupCompletedAt: now,
      createdAt: now,
      updatedAt: now
    }
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

function createInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    organisationId: "org-1",
    customerId: "customer-1",
    invoiceNumber: "INV-000007",
    publicToken: "public-token",
    publicAccessEnabled: true,
    status: "sent",
    currency: "NGN",
    issueDate: "2026-06-01",
    dueDate: "2026-06-15",
    notes: "Payment due in 14 days.",
    subtotalKobo: 100000,
    discountKobo: 10000,
    taxKobo: 7500,
    totalKobo: 97500,
    amountPaidKobo: 25000,
    balanceDueKobo: 72500,
    sentAt: new Date("2026-06-01T10:00:00.000Z"),
    viewedAt: null,
    paidAt: null,
    cancelledAt: null,
    voidedAt: null,
    createdByUserId: "user-1",
    createdAt: new Date("2026-06-01T10:00:00.000Z"),
    updatedAt: new Date("2026-06-01T10:00:00.000Z"),
    ...overrides
  };
}

function createService(
  options: {
    duplicate?: boolean;
    existing?: Customer;
    invoices?: Invoice[];
    inserted?: Customer;
    updated?: Customer;
  } = {}
) {
  const duplicateRows = options.duplicate ? [{ id: "duplicate-customer" }] : [];
  const existingRows = options.existing ? [options.existing] : [];
  const invoiceRows = options.invoices ?? [];
  const selectResults =
    options.invoices !== undefined
      ? [existingRows, invoiceRows, duplicateRows]
      : options.existing
        ? [existingRows, duplicateRows]
        : [duplicateRows, existingRows];
  const db = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve(selectResults.shift() ?? [])),
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => ({
              offset: jest.fn(() => Promise.resolve(selectResults.shift() ?? []))
            }))
          }))
        }))
      }))
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve([options.inserted ?? createCustomer()]))
      }))
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([options.updated ?? createCustomer()]))
        }))
      }))
    }))
  };
  const auditLogService = { create: jest.fn().mockResolvedValue(undefined) };
  const service = new CustomersService({ db } as never, auditLogService as never);

  return { auditLogService, db, service };
}

describe("CustomersService", () => {
  it.each(["owner", "admin", "accountant"] as const)(
    "creates a customer for %s context",
    async (role) => {
      const inserted = createCustomer({ email: "accounts@lagosbrightprints.test" });
      const { auditLogService, service } = createService({ inserted });

      const result = await service.createCustomer(createContext(role), {
        name: " Lagos Bright Prints ",
        email: "ACCOUNTS@LAGOSBRIGHTPRINTS.TEST",
        phone: " +2348010000001 ",
        billingAddress: " 14 Allen Avenue, Ikeja, Lagos "
      });

      expect(result.customer.email).toBe("accounts@lagosbrightprints.test");
      expect(result.customer).not.toHaveProperty("organisationId");
      expect(auditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: "customer_created", entityType: "customer" })
      );
    }
  );

  it("blocks duplicate active customer email", async () => {
    const { service } = createService({ duplicate: true });

    await expect(
      service.createCustomer(createContext("owner"), {
        name: "Duplicate Customer",
        email: "duplicate@example.test"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects updating an archived customer", async () => {
    const { service } = createService({
      existing: createCustomer({ archivedAt: new Date("2026-01-02T00:00:00.000Z") })
    });

    await expect(
      service.updateCustomer(createContext("admin"), "customer-1", {
        name: "Updated Customer"
      })
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("rejects empty update payloads", async () => {
    const { service } = createService({ existing: createCustomer() });

    await expect(
      service.updateCustomer(createContext("admin"), "customer-1", {})
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns customer invoice history and summary totals", async () => {
    const { service } = createService({
      existing: createCustomer(),
      invoices: [
        createInvoice(),
        createInvoice({
          id: "invoice-2",
          invoiceNumber: "INV-000008",
          status: "paid",
          totalKobo: 50000,
          amountPaidKobo: 50000,
          balanceDueKobo: 0,
          paidAt: new Date("2026-06-05T10:00:00.000Z")
        })
      ]
    });

    const result = await service.getCustomer(createContext("viewer"), "customer-1");

    expect(result.invoiceSummary).toEqual({
      available: true,
      message: "2 invoices found for this customer.",
      totalBalanceDueKobo: 72500,
      totalInvoices: 2,
      totalInvoicedKobo: 147500,
      totalPaidKobo: 75000
    });
    expect(result.invoices).toEqual([
      expect.objectContaining({
        balanceDueKobo: 72500,
        id: "invoice-1",
        invoiceNumber: "INV-000007",
        status: "overdue",
        totalKobo: 97500
      }),
      expect.objectContaining({
        balanceDueKobo: 0,
        id: "invoice-2",
        invoiceNumber: "INV-000008",
        status: "paid",
        totalKobo: 50000
      })
    ]);
    expect(result.customer).not.toHaveProperty("organisationId");
  });

  it("returns conflict when archiving an already archived customer", async () => {
    const { service } = createService({
      existing: createCustomer({ archivedAt: new Date("2026-01-02T00:00:00.000Z") })
    });

    await expect(
      service.archiveCustomer(createContext("accountant"), "customer-1", {})
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
