import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException
} from "@nestjs/common";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import type { Customer } from "../../database/schema";
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

function createService(
  options: {
    duplicate?: boolean;
    existing?: Customer;
    inserted?: Customer;
    updated?: Customer;
  } = {}
) {
  const duplicateRows = options.duplicate ? [{ id: "duplicate-customer" }] : [];
  const existingRows = options.existing ? [options.existing] : [];
  const selectResults = options.existing
    ? [existingRows, duplicateRows]
    : [duplicateRows, existingRows];
  const db = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve(selectResults.shift() ?? [])),
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => ({
              offset: jest.fn(() => Promise.resolve([]))
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

  it("returns conflict when archiving an already archived customer", async () => {
    const { service } = createService({
      existing: createCustomer({ archivedAt: new Date("2026-01-02T00:00:00.000Z") })
    });

    await expect(
      service.archiveCustomer(createContext("accountant"), "customer-1", {})
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
