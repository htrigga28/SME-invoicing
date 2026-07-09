"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DataTable,
  DataTableContainer,
  MobileDataCard,
  Pagination as DataPagination,
  TableHeaderCell
} from "@/components/ui/data-table";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { FilterActions, FilterBar, FilterGrid } from "@/components/ui/filter-bar";
import { FieldLabel, FormField, Input } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { clearStoredSession } from "@/features/auth/session";
import { isApiRequestError } from "@/lib/api";

import { archiveCustomer, listCustomers } from "./customers-api";
import {
  CustomerStatusBadge,
  formatDate,
  PageHeader,
  PrimaryLink,
  StatusPanel
} from "./customer-ui";
import type { Customer, CustomerListStatus, Pagination } from "./types";
import { canManageCustomers } from "./types";

type LoadState = "loading" | "ready" | "error";

const statusOptions: { label: string; value: CustomerListStatus }[] = [
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
  { label: "All", value: "all" }
];

export function CustomerListPage() {
  return (
    <AppShell>
      {({ accessToken, me }) => (
        <CustomerListContent accessToken={accessToken} role={me.membership.role} />
      )}
    </AppShell>
  );
}

export function CustomerListContent({
  accessToken,
  role
}: {
  accessToken: string;
  role: "owner" | "admin" | "accountant" | "viewer";
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const [status, setStatus] = useState<CustomerListStatus>("active");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [customerPendingArchive, setCustomerPendingArchive] = useState<Customer | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const canManage = canManageCustomers(role);

  const isFiltered = useMemo(
    () => search.trim().length > 0 || status !== "active",
    [search, status]
  );

  useEffect(() => {
    void loadCustomers(1);
  }, [accessToken, search, status]);

  async function loadCustomers(page = pagination.page) {
    setState("loading");
    setError(null);

    try {
      const searchTerm = search.trim();
      const response = await listCustomers(accessToken, {
        ...(searchTerm ? { search: searchTerm } : {}),
        status,
        page,
        limit: pagination.limit
      });
      setCustomers(response.customers);
      setPagination(response.pagination);
      setState("ready");
    } catch (loadError) {
      if (isApiRequestError(loadError) && loadError.status === 401) {
        clearStoredSession();
        window.location.assign("/login");
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Could not load customers.");
      setState("error");
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput);
  }

  async function handleArchiveConfirm() {
    if (!customerPendingArchive) {
      return;
    }

    setIsArchiving(true);
    setError(null);
    setSuccess(null);

    try {
      await archiveCustomer(accessToken, customerPendingArchive.id, "Archived from customer list.");
      setSuccess("Customer archived.");
      setCustomerPendingArchive(null);
      await loadCustomers(1);
    } catch (archiveError) {
      setError(
        archiveError instanceof Error ? archiveError.message : "Could not archive customer."
      );
    } finally {
      setIsArchiving(false);
    }
  }

  return (
    <section className="space-y-5">
      <PageHeader
        action={canManage ? <PrimaryLink href="/customers/new">New customer</PrimaryLink> : null}
        description="Manage billing contacts for invoices."
        title="Customers"
      />

      {error ? <StatusPanel message={error} tone="error" /> : null}
      {success ? <StatusPanel message={success} tone="success" /> : null}

      <FilterBar aria-label="Customer filters" onSubmit={handleSearch}>
        <FilterGrid className="md:grid-cols-[1fr_180px_auto]">
          <FormField>
            <FieldLabel>Search</FieldLabel>
            <Input
              className="mt-1"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name, email, or phone"
              value={searchInput}
            />
          </FormField>
          <FormField>
            <FieldLabel>Status</FieldLabel>
            <Select
              onChange={(event) => setStatus(event.target.value as CustomerListStatus)}
              value={status}
              wrapperClassName="mt-1"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FilterActions>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </FilterActions>
        </FilterGrid>
      </FilterBar>

      {state === "loading" ? <CustomerListSkeleton /> : null}

      {state === "error" ? (
        <StatusPanel
          action={
            <Button onClick={() => void loadCustomers()} size="sm" type="button">
              Retry
            </Button>
          }
          message="Customer list could not be loaded."
          tone="error"
        />
      ) : null}

      {state === "ready" && customers.length === 0 ? (
        <EmptyState
          action={
            canManage && !isFiltered ? (
              <PrimaryLink href="/customers/new">New customer</PrimaryLink>
            ) : null
          }
          description={
            isFiltered
              ? "Adjust search or status filters to widen the customer list."
              : "Create a customer before issuing invoices."
          }
          filtered={isFiltered}
          title={isFiltered ? "No customers match these filters." : "No customers yet."}
        />
      ) : null}

      {state === "ready" && customers.length > 0 ? (
        <DataTableContainer>
          <div className="hidden overflow-x-auto md:block">
            <DataTable>
              <thead>
                <tr>
                  <TableHeaderCell>Customer</TableHeaderCell>
                  <TableHeaderCell>Phone</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Created</TableHeaderCell>
                  <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-4 py-3">
                      <Link
                        className="font-medium text-slate-950"
                        href={`/customers/${customer.id}`}
                      >
                        {customer.name}
                      </Link>
                      <p className="text-slate-600">{customer.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{customer.phone ?? "Not provided"}</td>
                    <td className="px-4 py-3">
                      <CustomerStatusBadge status={customer.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(customer.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <LinkButton href={`/customers/${customer.id}`} size="sm" variant="outline">
                          View
                        </LinkButton>
                        {canManage && customer.status === "active" ? (
                          <>
                            <LinkButton
                              href={`/customers/${customer.id}/edit`}
                              size="sm"
                              variant="outline"
                            >
                              Edit
                            </LinkButton>
                            <Button
                              onClick={() => setCustomerPendingArchive(customer)}
                              size="sm"
                              type="button"
                              variant="destructive"
                            >
                              Archive
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {customers.map((customer) => (
              <MobileDataCard key={customer.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="font-medium text-slate-950" href={`/customers/${customer.id}`}>
                      {customer.name}
                    </Link>
                    <p className="break-all text-sm text-slate-600">{customer.email}</p>
                  </div>
                  <CustomerStatusBadge status={customer.status} />
                </div>
                <p className="text-sm text-slate-600">{customer.phone ?? "No phone provided"}</p>
                <p className="text-xs text-slate-500">Created {formatDate(customer.createdAt)}</p>
                <div className="flex flex-wrap gap-2 text-sm">
                  <LinkButton href={`/customers/${customer.id}`} size="sm" variant="outline">
                    View
                  </LinkButton>
                  {canManage && customer.status === "active" ? (
                    <LinkButton href={`/customers/${customer.id}/edit`} size="sm" variant="outline">
                      Edit
                    </LinkButton>
                  ) : null}
                </div>
              </MobileDataCard>
            ))}
          </div>
        </DataTableContainer>
      ) : null}

      {state === "ready" && pagination.totalPages > 1 ? (
        <DataPagination
          canGoNext={pagination.page < pagination.totalPages}
          canGoPrevious={pagination.page > 1}
          label={
            <span>
              Page {pagination.page} of {pagination.totalPages} • {pagination.total} customers
            </span>
          }
          onNext={() => void loadCustomers(pagination.page + 1)}
          onPrevious={() => void loadCustomers(pagination.page - 1)}
        />
      ) : null}

      <ConfirmDialog
        confirmLabel="Archive customer"
        description="Archived customers are read-only and hidden from the active customer list. Historical records remain available."
        destructive
        isLoading={isArchiving}
        loadingLabel="Archiving..."
        onCancel={() => setCustomerPendingArchive(null)}
        onConfirm={() => void handleArchiveConfirm()}
        open={customerPendingArchive !== null}
        title="Archive customer?"
      />
    </section>
  );
}

function CustomerListSkeleton() {
  return <LoadingSkeleton rows={5} />;
}
