"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DataTable,
  DataTableContainer,
  MobileDataCard,
  Pagination as DataPagination,
  TableHeaderCell
} from "@/components/ui/data-table";
import {
  DataToolbar,
  DataToolbarActions,
  DataToolbarSearch,
  StatusTabs
} from "@/components/ui/data-toolbar";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { TableRowActionMenu } from "@/components/ui/menu";
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

const STATUS_TABS: Array<{ label: string; value: CustomerListStatus }> = [
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
  const router = useRouter();
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
    <section className="space-y-4">
      <PageHeader
        action={canManage ? <PrimaryLink href="/customers/new">New customer</PrimaryLink> : null}
        description="Manage billing contacts for invoices."
        title="Customers"
      />

      {error && state !== "error" ? <StatusPanel message={error} tone="error" /> : null}
      {success ? <StatusPanel message={success} tone="success" /> : null}

      <StatusTabs<CustomerListStatus>
        label="Customer status"
        onChange={setStatus}
        options={STATUS_TABS}
        value={status}
      />

      <DataToolbar>
        <DataToolbarSearch>
          <form aria-label="Search customers" onSubmit={handleSearch} role="search">
            <Input
              aria-label="Search customers"
              onChange={(event) => {
                setSearchInput(event.target.value);
                if (event.target.value === "") setSearch("");
              }}
              placeholder="Search name, email, or phone…"
              value={searchInput}
            />
          </form>
        </DataToolbarSearch>
        <DataToolbarActions>
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

      {state === "loading" ? <CustomerListSkeleton /> : null}

      {state === "error" ? (
        <ErrorState
          detail="Your search and status filters are still here. Try again now, or wait a moment before retrying."
          message={error ?? "Lumina could not reach the service that provides your customer records."}
          onRetry={() => void loadCustomers()}
          title="We can’t load customers right now"
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
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>Phone</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Created</TableHeaderCell>
                  <TableHeaderCell className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHeaderCell>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    aria-label={customer.name}
                    className="cursor-pointer hover:bg-[var(--surface-selected)]"
                    onClick={() => router.push(`/customers/${customer.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") router.push(`/customers/${customer.id}`);
                    }}
                    tabIndex={0}
                  >
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-[var(--text-primary)]">
                      {customer.name}
                    </td>
                    <td className="max-w-56 truncate px-4 py-3.5 text-[var(--text-secondary)]">
                      {customer.email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--text-secondary)]">
                      {customer.phone ?? "Not provided"}
                    </td>
                    <td className="px-4 py-3.5">
                      <CustomerStatusBadge status={customer.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--text-secondary)]">
                      {formatDate(customer.createdAt)}
                    </td>
                    <td
                      className="px-2 py-3.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <TableRowActionMenu
                        items={[
                          { label: "View", href: `/customers/${customer.id}` },
                          ...(canManage && customer.status === "active"
                            ? [
                                { label: "Edit", href: `/customers/${customer.id}/edit` },
                                {
                                  label: "Archive",
                                  destructive: true,
                                  onSelect: () => setCustomerPendingArchive(customer)
                                }
                              ]
                            : [])
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>

          <div className="divide-y divide-[var(--border-subtle)] md:hidden">
            {customers.map((customer) => (
              <MobileDataCard key={customer.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      className="font-medium text-[var(--text-primary)]"
                      href={`/customers/${customer.id}`}
                    >
                      {customer.name}
                    </Link>
                    <p className="break-all text-sm text-[var(--text-secondary)]">
                      {customer.email}
                    </p>
                  </div>
                  <CustomerStatusBadge status={customer.status} />
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  {customer.phone ?? "No phone provided"}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-[var(--text-muted)]">
                    Created {formatDate(customer.createdAt)}
                  </p>
                  {canManage && customer.status === "active" ? (
                    <TableRowActionMenu
                      items={[
                        { label: "View", href: `/customers/${customer.id}` },
                        { label: "Edit", href: `/customers/${customer.id}/edit` },
                        {
                          label: "Archive",
                          destructive: true,
                          onSelect: () => setCustomerPendingArchive(customer)
                        }
                      ]}
                    />
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
