import { apiGet, apiRequest } from "@/lib/api";

import type {
  CatalogueItem,
  CatalogueListResponse,
  CatalogueItemMutationPayload,
  CatalogueListStatus
} from "./types";

type ListCatalogueItemsInput = {
  search?: string;
  status?: CatalogueListStatus;
};

export function listCatalogueItems(accessToken: string, input: ListCatalogueItemsInput = {}) {
  const params = new URLSearchParams();

  if (input.search?.trim()) params.set("search", input.search.trim());
  if (input.status) params.set("status", input.status);

  const query = params.toString();
  return apiGet<CatalogueListResponse>(`/catalogue-items${query ? `?${query}` : ""}`, {
    accessToken
  });
}

export function createCatalogueItem(accessToken: string, input: CatalogueItemMutationPayload) {
  return apiRequest<{ catalogueItem: CatalogueItem }>("/catalogue-items", {
    method: "POST",
    accessToken,
    body: input
  });
}

export function updateCatalogueItem(
  accessToken: string,
  itemId: string,
  input: Partial<CatalogueItemMutationPayload>
) {
  return apiRequest<{ catalogueItem: CatalogueItem }>(
    `/catalogue-items/${encodeURIComponent(itemId)}`,
    {
      method: "PATCH",
      accessToken,
      body: input
    }
  );
}

export function archiveCatalogueItem(accessToken: string, itemId: string) {
  return apiRequest<{ catalogueItem: CatalogueItem }>(
    `/catalogue-items/${encodeURIComponent(itemId)}/archive`,
    {
      method: "POST",
      accessToken
    }
  );
}

export function restoreCatalogueItem(accessToken: string, itemId: string) {
  return apiRequest<{ catalogueItem: CatalogueItem }>(
    `/catalogue-items/${encodeURIComponent(itemId)}/restore`,
    {
      method: "POST",
      accessToken
    }
  );
}
