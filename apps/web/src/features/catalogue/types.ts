export type CatalogueItemStatus = "active" | "archived";

export type CatalogueItem = {
  id: string;
  name: string;
  description: string | null;
  defaultUnitPriceKobo: number;
  status: CatalogueItemStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CatalogueListResponse = {
  catalogueItems: CatalogueItem[];
};

export type CatalogueItemMutationPayload = {
  name: string;
  description?: string | null;
  defaultUnitPriceKobo: number;
};

export type CatalogueListStatus = CatalogueItemStatus | "all";

export const catalogueManagerRoles = ["owner", "admin", "accountant"] as const;

export function canManageCatalogue(role: string) {
  return catalogueManagerRoles.includes(role as (typeof catalogueManagerRoles)[number]);
}
