"use client";

import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { formatKoboToNaira } from "@sme-invoicing/shared";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DataTable,
  DataTableContainer,
  MobileDataCard,
  TableHeaderCell
} from "@/components/ui/data-table";
import {
  DataToolbar,
  DataToolbarActions,
  DataToolbarFilters,
  DataToolbarSearch
} from "@/components/ui/data-toolbar";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { FieldLabel, FormField, Input, Textarea } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { clearStoredSession } from "@/features/auth/session";
import { formatDate, PageHeader, StatusPanel } from "@/features/invoices/invoice-ui";
import { isApiRequestError } from "@/lib/api";

import {
  archiveCatalogueItem,
  createCatalogueItem,
  listCatalogueItems,
  restoreCatalogueItem,
  updateCatalogueItem
} from "./catalogue-api";
import type { CatalogueItem, CatalogueListStatus } from "./types";
import { canManageCatalogue } from "./types";
import { toCataloguePayload, validateCatalogueForm, type CatalogueFormInput } from "./validation";

type LoadState = "loading" | "ready" | "error";

const statusOptions: { label: string; value: CatalogueListStatus }[] = [
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
  { label: "All", value: "all" }
];

const blankForm: CatalogueFormInput = { name: "", description: "", unitPriceNaira: "" };

export function CataloguePage() {
  return (
    <AppShell>
      {({ accessToken, me }) => (
        <CatalogueContent accessToken={accessToken} role={me.membership.role} />
      )}
    </AppShell>
  );
}

export function CatalogueContent({
  accessToken,
  role
}: {
  accessToken: string;
  role: "owner" | "admin" | "accountant" | "viewer";
}) {
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [status, setStatus] = useState<CatalogueListStatus>("active");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<CatalogueFormInput>(blankForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<CatalogueItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<CatalogueItem | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const canManage = canManageCatalogue(role);

  const isFiltered = useMemo(
    () => search.trim().length > 0 || status !== "active",
    [search, status]
  );

  useEffect(() => {
    void loadItems();
  }, [accessToken, search, status]);

  async function loadItems() {
    setState("loading");
    setError(null);

    try {
      const response = await listCatalogueItems(accessToken, {
        ...(search.trim() ? { search: search.trim() } : {}),
        status
      });
      setItems(response.catalogueItems);
      setState("ready");
    } catch (loadError) {
      if (isApiRequestError(loadError) && loadError.status === 401) {
        clearStoredSession();
        window.location.assign("/login");
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Could not load catalogue.");
      setState("error");
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput);
  }

  function startCreate() {
    setEditing(null);
    setForm({ ...blankForm });
    setFormErrors({});
  }

  function startEdit(item: CatalogueItem) {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description ?? "",
      unitPriceNaira: String(item.defaultUnitPriceKobo / 100)
    });
    setFormErrors({});
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);

    const validationErrors = validateCatalogueForm(form);
    setFormErrors(validationErrors);

    if (Object.values(validationErrors).some(Boolean)) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = toCataloguePayload(form);

      if (editing) {
        await updateCatalogueItem(accessToken, editing.id, payload);
        setSuccess(`Updated ${payload.name}.`);
      } else {
        await createCatalogueItem(accessToken, payload);
        setSuccess(`Created ${payload.name}.`);
      }

      setForm({ ...blankForm });
      setEditing(null);
      await loadItems();
    } catch (saveError) {
      if (isApiRequestError(saveError) && saveError.status === 401) {
        clearStoredSession();
        window.location.assign("/login");
        return;
      }

      setError(saveError instanceof Error ? saveError.message : "Could not save catalogue item.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchiveToggle(item: CatalogueItem) {
    setIsMutating(true);
    setError(null);

    try {
      if (item.status === "active") {
        await archiveCatalogueItem(accessToken, item.id);
        setSuccess(`Archived ${item.name}. Saved invoices keep their snapshots.`);
      } else {
        await restoreCatalogueItem(accessToken, item.id);
        setSuccess(`Restored ${item.name}.`);
      }

      setPendingArchive(null);
      await loadItems();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Could not update item.");
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <section className="space-y-4">
      <PageHeader
        description="Reusable products and services for invoice lines. Saved invoices keep independent snapshots."
        title="Products & Services"
      />

      {error ? <StatusPanel message={error} tone="error" /> : null}
      {success ? <StatusPanel message={success} tone="success" /> : null}

      <form aria-label="Catalogue filters" onSubmit={handleSearch}>
        <DataToolbar>
          <DataToolbarSearch>
            <Input
              aria-label="Search catalogue"
              onChange={(event) => {
                setSearchInput(event.target.value);
                if (event.target.value === "") setSearch("");
              }}
              placeholder="Search name or description…"
              value={searchInput}
            />
          </DataToolbarSearch>
          <DataToolbarFilters>
            <label className="sr-only" htmlFor="catalogue-status-filter">
              Status
            </label>
            <Select
              aria-label="Status"
              id="catalogue-status-filter"
              onChange={(event) => setStatus(event.target.value as CatalogueListStatus)}
              value={status}
              wrapperClassName="w-40"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </DataToolbarFilters>
          <DataToolbarActions>
            <Button size="sm" type="submit" variant="outline">
              Search
            </Button>
            {isFiltered ? (
              <Button
                onClick={() => {
                  setSearch("");
                  setSearchInput("");
                  setStatus("active");
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Clear
              </Button>
            ) : null}
          </DataToolbarActions>
        </DataToolbar>
      </form>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_360px]">
        <DataTableContainer>
          {state === "loading" ? (
            <LoadingSkeleton />
          ) : items.length === 0 ? (
            <EmptyState
              title={isFiltered ? "No catalogue items match these filters." : "No catalogue items yet."}
              description={
                canManage
                  ? "Create a reusable product or service to speed up invoice authoring."
                  : "An Owner, Admin, or Accountant can add reusable items."
              }
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <DataTable aria-label="Catalogue items">
                <thead>
                  <tr>
                    <TableHeaderCell>Item</TableHeaderCell>
                    <TableHeaderCell className="text-right">Default price</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Updated</TableHeaderCell>
                    {canManage ? (
                      <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--text-primary)]">{item.name}</p>
                        {item.description ? (
                          <p className="mt-1 max-w-md whitespace-pre-wrap break-words text-sm text-[var(--text-secondary)]">
                            {item.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[var(--text-secondary)]">
                        {formatKoboToNaira(item.defaultUnitPriceKobo)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm capitalize text-[var(--text-secondary)]">{item.status}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-secondary)]">
                        {formatDate(item.updatedAt.slice(0, 10))}
                      </td>
                      {canManage ? (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              disabled={item.status === "archived"}
                              onClick={() => startEdit(item)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              Edit
                            </Button>
                            <Button
                              onClick={() => setPendingArchive(item)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {item.status === "active" ? "Archive" : "Restore"}
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              </div>

              <div className="divide-y divide-[var(--border-subtle)] lg:hidden">
                {items.map((item) => (
                  <MobileDataCard key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{item.name}</p>
                        <p className="text-sm tabular-nums text-[var(--text-secondary)]">
                          {formatKoboToNaira(item.defaultUnitPriceKobo)}
                        </p>
                      </div>
                      <span className="text-xs capitalize text-[var(--text-muted)]">{item.status}</span>
                    </div>
                    {item.description ? (
                      <p className="whitespace-pre-wrap break-words text-sm text-[var(--text-secondary)]">
                        {item.description}
                      </p>
                    ) : null}
                    {canManage ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={item.status === "archived"}
                          onClick={() => startEdit(item)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => setPendingArchive(item)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {item.status === "active" ? "Archive" : "Restore"}
                        </Button>
                      </div>
                    ) : null}
                  </MobileDataCard>
                ))}
              </div>
            </>
          )}
        </DataTableContainer>

        {canManage ? (
          <form
            aria-label={editing ? "Edit catalogue item" : "Create catalogue item"}
            className="h-fit space-y-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-5"
            onSubmit={handleSave}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {editing ? `Edit ${editing.name}` : "New item"}
              </h2>
              {editing ? (
                <Button onClick={startCreate} size="sm" type="button" variant="ghost">
                  Cancel edit
                </Button>
              ) : null}
            </div>

            <FormField>
              <FieldLabel htmlFor="catalogue-name">Name</FieldLabel>
              <Input
                disabled={isSaving}
                id="catalogue-name"
                maxLength={200}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Monthly bookkeeping"
                value={form.name}
              />
              {formErrors.name ? <p className="mt-1 text-sm text-[var(--danger)]">{formErrors.name}</p> : null}
            </FormField>

            <FormField>
              <FieldLabel htmlFor="catalogue-description">Description (optional)</FieldLabel>
              <Textarea
                disabled={isSaving}
                id="catalogue-description"
                maxLength={2000}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="What the customer receives"
                value={form.description}
              />
              {formErrors.description ? (
                <p className="mt-1 text-sm text-[var(--danger)]">{formErrors.description}</p>
              ) : null}
            </FormField>

            <FormField>
              <FieldLabel htmlFor="catalogue-price">Default price (NGN)</FieldLabel>
              <Input
                disabled={isSaving}
                id="catalogue-price"
                min="0"
                onChange={(event) =>
                  setForm((current) => ({ ...current, unitPriceNaira: event.target.value }))
                }
                placeholder="1500.00"
                step="0.01"
                type="number"
                value={form.unitPriceNaira}
              />
              {formErrors.unitPriceNaira ? (
                <p className="mt-1 text-sm text-[var(--danger)]">{formErrors.unitPriceNaira}</p>
              ) : null}
            </FormField>

            <Button className="w-full" disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : editing ? "Save changes" : "Create item"}
            </Button>
            <p className="text-xs text-[var(--text-muted)]">
              Archived items stay out of invoice authoring. Saved invoices never read live catalogue
              prices.
            </p>
          </form>
        ) : (
          <div className="h-fit rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)]">
            Viewers can browse reusable items. Only Owner, Admin, or Accountant roles can create or
            archive catalogue items.
          </div>
        )}
      </div>

      <ConfirmDialog
        confirmLabel={pendingArchive?.status === "active" ? "Archive item" : "Restore item"}
        description={
          pendingArchive?.status === "active"
            ? `Archive ${pendingArchive?.name}? It will leave invoice authoring, but saved invoices keep their snapshots.`
            : `Restore ${pendingArchive?.name} to invoice authoring?`
        }
        destructive={pendingArchive?.status === "active"}
        isLoading={isMutating}
        loadingLabel="Saving..."
        onCancel={() => setPendingArchive(null)}
        onConfirm={() => {
          if (pendingArchive) void handleArchiveToggle(pendingArchive);
        }}
        open={pendingArchive !== null}
        title={pendingArchive?.status === "active" ? "Archive item?" : "Restore item?"}
      />
    </section>
  );
}
