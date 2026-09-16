import { BadRequestException, NotFoundException } from "@nestjs/common";
import { validate } from "class-validator";

import { MAX_KOBO } from "../../common/money-limits";
import type { CatalogueItem } from "../../database/schema";
import { CatalogueService } from "./catalogue.service";
import { CreateCatalogueItemDto } from "./dto/create-catalogue-item.dto";

const now = new Date("2026-09-17T00:00:00.000Z");
const context = {
  activeOrganisation: { id: "org-1" },
  user: { id: "user-1" }
} as never;

function createCatalogueItem(overrides: Partial<CatalogueItem> = {}): CatalogueItem {
  return {
    id: "catalogue-item-1",
    organisationId: "org-1",
    name: "Monthly bookkeeping",
    description: "Monthly bookkeeping and reconciliation support.",
    defaultUnitPriceKobo: 150000,
    archivedAt: null,
    createdByUserId: "user-1",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("Catalogue DTO validation", () => {
  it("rejects invalid catalogue prices at the HTTP boundary", async () => {
    const dto = Object.assign(new CreateCatalogueItemDto(), {
      name: "Monthly bookkeeping",
      defaultUnitPriceKobo: MAX_KOBO + 1
    });

    expect(await validate(dto)).not.toEqual([]);
  });
});

describe("CatalogueService", () => {
  it("creates a tenant-scoped item and omits internal IDs from the response", async () => {
    const inserted = createCatalogueItem();
    const values = jest.fn(() => ({ returning: jest.fn().mockResolvedValue([inserted]) }));
    const auditLogService = { create: jest.fn().mockResolvedValue(undefined) };
    const service = new CatalogueService(
      { db: { insert: jest.fn(() => ({ values })) } } as never,
      auditLogService as never
    );

    const result = await service.createCatalogueItem(context, {
      name: " Monthly bookkeeping ",
      description: " Monthly support ",
      defaultUnitPriceKobo: 150000
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        createdByUserId: "user-1",
        name: "Monthly bookkeeping",
        description: "Monthly support"
      })
    );
    expect(result.catalogueItem).not.toHaveProperty("organisationId");
    expect(result.catalogueItem).not.toHaveProperty("createdByUserId");
    expect(auditLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: "catalogue_item_created", entityType: "catalogue_item" })
    );
  });

  it("rejects blank names and foreign item IDs safely", async () => {
    const auditLogService = { create: jest.fn() };
    const service = new CatalogueService(
      {
        db: {
          select: jest.fn(() => ({
            from: jest.fn(() => ({
              where: jest.fn(() => ({ limit: jest.fn().mockResolvedValue([]) }))
            }))
          }))
        }
      } as never,
      auditLogService as never
    );

    await expect(
      service.createCatalogueItem(context, {
        name: " ",
        defaultUnitPriceKobo: 0
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.archiveCatalogueItem(context, "foreign-item")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
