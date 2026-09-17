import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import { and, asc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";

import { assertKoboAmount } from "../../common/money-limits";
import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { DatabaseService } from "../../database/database.service";
import { catalogueItems, type CatalogueItem } from "../../database/schema";
import { AuditLogService } from "../audit-log/audit-log.service";
import type { CreateCatalogueItemDto } from "./dto/create-catalogue-item.dto";
import type { ListCatalogueItemsQueryDto } from "./dto/list-catalogue-items-query.dto";
import type { UpdateCatalogueItemDto } from "./dto/update-catalogue-item.dto";

@Injectable()
export class CatalogueService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService
  ) {}

  async listCatalogueItems(context: ActiveOrganisationContext, query: ListCatalogueItemsQueryDto) {
    const conditions = [eq(catalogueItems.organisationId, context.activeOrganisation.id)];

    if ((query.status ?? "active") === "active") {
      conditions.push(isNull(catalogueItems.archivedAt));
    }

    if (query.status === "archived") {
      conditions.push(isNotNull(catalogueItems.archivedAt));
    }

    const search = query.search?.trim();

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(ilike(catalogueItems.name, pattern), ilike(catalogueItems.description, pattern))!
      );
    }

    const rows = await this.databaseService.db
      .select()
      .from(catalogueItems)
      .where(and(...conditions))
      .orderBy(asc(catalogueItems.name));

    return { catalogueItems: rows.map((item) => this.toSafeCatalogueItem(item)) };
  }

  async createCatalogueItem(context: ActiveOrganisationContext, input: CreateCatalogueItemDto) {
    const normalized = this.normalizeCreateInput(input);
    const [item] = await this.databaseService.db
      .insert(catalogueItems)
      .values({
        organisationId: context.activeOrganisation.id,
        createdByUserId: context.user.id,
        ...normalized
      })
      .returning();

    if (!item) {
      throw new Error("Catalogue item creation failed.");
    }

    await this.auditLogService.create({
      organisationId: context.activeOrganisation.id,
      actorUserId: context.user.id,
      action: "catalogue_item_created",
      entityType: "catalogue_item",
      entityId: item.id,
      metadataRedacted: { name: item.name, defaultUnitPriceKobo: item.defaultUnitPriceKobo }
    });

    return { catalogueItem: this.toSafeCatalogueItem(item) };
  }

  async updateCatalogueItem(
    context: ActiveOrganisationContext,
    itemId: string,
    input: UpdateCatalogueItemDto
  ) {
    const item = await this.requireItem(context.activeOrganisation.id, itemId);

    if (item.archivedAt) {
      throw new UnprocessableEntityException("Archived catalogue items cannot be updated.");
    }

    const normalized = this.normalizeUpdateInput(input);

    if (Object.keys(normalized).length === 0) {
      throw new BadRequestException("Provide at least one catalogue item field to update.");
    }

    const [updated] = await this.databaseService.db
      .update(catalogueItems)
      .set({ ...normalized, updatedAt: new Date() })
      .where(eq(catalogueItems.id, item.id))
      .returning();

    if (!updated) {
      throw new Error("Catalogue item update failed.");
    }

    await this.auditLogService.create({
      organisationId: context.activeOrganisation.id,
      actorUserId: context.user.id,
      action: "catalogue_item_updated",
      entityType: "catalogue_item",
      entityId: item.id,
      metadataRedacted: { fields: Object.keys(normalized) }
    });

    return { catalogueItem: this.toSafeCatalogueItem(updated) };
  }

  async archiveCatalogueItem(context: ActiveOrganisationContext, itemId: string) {
    const item = await this.requireItem(context.activeOrganisation.id, itemId);

    if (item.archivedAt) {
      throw new ConflictException("Catalogue item is already archived.");
    }

    return this.setArchivedState(context, item, new Date(), "catalogue_item_archived");
  }

  async restoreCatalogueItem(context: ActiveOrganisationContext, itemId: string) {
    const item = await this.requireItem(context.activeOrganisation.id, itemId);

    if (!item.archivedAt) {
      throw new ConflictException("Catalogue item is already active.");
    }

    return this.setArchivedState(context, item, null, "catalogue_item_restored");
  }

  private async setArchivedState(
    context: ActiveOrganisationContext,
    item: CatalogueItem,
    archivedAt: Date | null,
    action: "catalogue_item_archived" | "catalogue_item_restored"
  ) {
    const [updated] = await this.databaseService.db
      .update(catalogueItems)
      .set({ archivedAt, updatedAt: new Date() })
      .where(eq(catalogueItems.id, item.id))
      .returning();

    if (!updated) {
      throw new Error("Catalogue item update failed.");
    }

    await this.auditLogService.create({
      organisationId: context.activeOrganisation.id,
      actorUserId: context.user.id,
      action,
      entityType: "catalogue_item",
      entityId: item.id,
      metadataRedacted: { name: item.name }
    });

    return { catalogueItem: this.toSafeCatalogueItem(updated) };
  }

  private async requireItem(organisationId: string, itemId: string) {
    const [item] = await this.databaseService.db
      .select()
      .from(catalogueItems)
      .where(and(eq(catalogueItems.organisationId, organisationId), eq(catalogueItems.id, itemId)))
      .limit(1);

    if (!item) {
      throw new NotFoundException("Catalogue item was not found.");
    }

    return item;
  }

  private normalizeCreateInput(input: CreateCatalogueItemDto) {
    return {
      name: this.requiredText(input.name, "Catalogue item name"),
      description: this.nullableText(input.description),
      defaultUnitPriceKobo: assertKoboAmount(input.defaultUnitPriceKobo, "Default unit price")
    };
  }

  private normalizeUpdateInput(input: UpdateCatalogueItemDto) {
    return {
      ...(input.name !== undefined
        ? { name: this.requiredText(input.name, "Catalogue item name") }
        : {}),
      ...(input.description !== undefined
        ? { description: this.nullableText(input.description) }
        : {}),
      ...(input.defaultUnitPriceKobo !== undefined
        ? {
            defaultUnitPriceKobo: assertKoboAmount(input.defaultUnitPriceKobo, "Default unit price")
          }
        : {})
    };
  }

  private requiredText(value: string | null | undefined, label: string) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${label} is required.`);
    }

    return value.trim();
  }

  private nullableText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "string") {
      throw new BadRequestException("Optional catalogue item fields must be strings.");
    }

    const trimmed = value.trim();
    return trimmed || null;
  }

  private toSafeCatalogueItem(item: CatalogueItem) {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      defaultUnitPriceKobo: item.defaultUnitPriceKobo,
      status: item.archivedAt ? "archived" : "active",
      archivedAt: item.archivedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }
}
