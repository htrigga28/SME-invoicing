"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableContainer,
  Pagination as DataPagination,
  TableHeaderCell
} from "@/components/ui/data-table";
import {
  DataToolbar,
  DataToolbarActions,
  DataToolbarFilters,
  DataToolbarSearch
} from "@/components/ui/data-toolbar";
import { Drawer } from "@/components/ui/drawer";
import { Alert, EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback";
import { DateInput as DateControl, Input } from "@/components/ui/form";
import { TableRowActionMenu } from "@/components/ui/menu";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { clearStoredSession } from "@/features/auth/session";
import type { Pagination } from "@/features/customers/types";
import { getApiErrorMessage, isApiRequestError } from "@/lib/api";

import { getAuditLog, listAuditLogs, type ListAuditLogsInput } from "./audit-logs-api";
import type { AuditLogDetail, AuditLogListItem, AuditLogCategory } from "./types";

const auditLogRoles = ["owner", "admin"] as const;
type LoadState = "error" | "loading" | "ready";

export function AuditLogsPage() {
  return (
    <AppShell
      deniedMessage="Owner or Admin access is required for audit logs."
      requiredRoles={auditLogRoles}
    >
      {({ accessToken }) => <AuditLogsContent accessToken={accessToken} />}
    </AppShell>
  );
}

export function AuditLogsContent({ accessToken }: { accessToken: string }) {
  const [auditLogs, setAuditLogs] = useState<AuditLogListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1
  });
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailState, setDetailState] = useState<LoadState>("ready");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<AuditLogCategory | "">("");
  const [action, setAction] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isFiltered = useMemo(
    () =>
      search.trim().length > 0 ||
      category !== "" ||
      action.trim().length > 0 ||
      actorUserId.trim().length > 0 ||
      resourceType.trim().length > 0 ||
      dateFrom !== "" ||
      dateTo !== "",
    [action, actorUserId, category, dateFrom, dateTo, resourceType, search]
  );

  useEffect(() => {
    void loadAuditLogs(1);
  }, [accessToken, search, category, action, actorUserId, resourceType, dateFrom, dateTo]);

  async function loadAuditLogs(page = pagination.page) {
    setState("loading");
    setError(null);

    try {
      const input: ListAuditLogsInput = {
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(category ? { category } : {}),
        ...(action.trim() ? { action: action.trim() } : {}),
        ...(actorUserId.trim() ? { actorUserId: actorUserId.trim() } : {}),
        ...(resourceType.trim() ? { resourceType: resourceType.trim() } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        page,
        limit: pagination.limit
      };
      const response = await listAuditLogs(accessToken, input);
      setAuditLogs(response.auditLogs);
      setPagination(response.pagination);
      setState("ready");
    } catch (loadError) {
      if (isApiRequestError(loadError) && loadError.status === 401) {
        clearStoredSession();
        window.location.assign("/login");
        return;
      }

      setError(getApiErrorMessage(loadError, "Audit logs could not be loaded."));
      setState("error");
    }
  }

  async function loadAuditLogDetail(auditLogId: string) {
    setDetailOpen(true);
    setDetailState("loading");
    setDetailError(null);

    try {
      const response = await getAuditLog(accessToken, auditLogId);
      setSelectedAuditLog(response.auditLog);
      setDetailState("ready");
    } catch (loadError) {
      setDetailError(getApiErrorMessage(loadError, "Audit log detail could not be loaded."));
      setDetailState("error");
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput);
  }

  function handleClearFilters() {
    setSearch("");
    setSearchInput("");
    setCategory("");
    setAction("");
    setActorUserId("");
    setResourceType("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <section className="space-y-4">
      <PageHeader
        description="Review important activity across your organisation."
        title="Audit Logs"
      />

      {error && state !== "error" ? (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      ) : null}

      <DataToolbar aria-label="Audit log filters">
        <DataToolbarSearch>
          <form aria-label="Search audit logs" onSubmit={handleSearch} role="search">
            <Input
              aria-label="Search"
              onChange={(event) => {
                setSearchInput(event.target.value);
                if (event.target.value === "") setSearch("");
              }}
              placeholder="Actor, action, resource, or summary…"
              value={searchInput}
            />
          </form>
        </DataToolbarSearch>
        <DataToolbarFilters>
          <label className="sr-only" htmlFor="audit-category-filter">
            Category
          </label>
          <Select
            aria-label="Category"
            id="audit-category-filter"
            onChange={(event) => setCategory(event.target.value as AuditLogCategory | "")}
            value={category}
            wrapperClassName="w-44"
          >
            <option value="">All categories</option>
            {auditCategories.map((item) => (
              <option key={item} value={item}>
                {categoryLabels[item]}
              </option>
            ))}
          </Select>
          <label className="sr-only" htmlFor="audit-action-filter">
            Action
          </label>
          <Input
            aria-label="Action"
            className="w-40"
            id="audit-action-filter"
            onChange={(event) => setAction(event.target.value)}
            placeholder="invoice_sent"
            value={action}
          />
          <label className="sr-only" htmlFor="audit-actor-filter">
            Actor ID
          </label>
          <Input
            aria-label="Actor ID"
            className="w-36"
            id="audit-actor-filter"
            onChange={(event) => setActorUserId(event.target.value)}
            placeholder="User UUID"
            value={actorUserId}
          />
          <label className="sr-only" htmlFor="audit-resource-filter">
            Resource
          </label>
          <Input
            aria-label="Resource"
            className="w-32"
            id="audit-resource-filter"
            onChange={(event) => setResourceType(event.target.value)}
            placeholder="invoice"
            value={resourceType}
          />
          <label className="sr-only" htmlFor="audit-date-from">
            From
          </label>
          <DateControl
            aria-label="From"
            className="w-40"
            id="audit-date-from"
            onChange={(event) => setDateFrom(event.target.value)}
            value={dateFrom}
          />
          <label className="sr-only" htmlFor="audit-date-to">
            To
          </label>
          <DateControl
            aria-label="To"
            className="w-40"
            id="audit-date-to"
            onChange={(event) => setDateTo(event.target.value)}
            value={dateTo}
          />
        </DataToolbarFilters>
        <DataToolbarActions>
          {isFiltered ? (
            <Button onClick={handleClearFilters} size="sm" type="button" variant="ghost">
              Clear
            </Button>
          ) : null}
        </DataToolbarActions>
      </DataToolbar>

      {state === "loading" ? <LoadingSkeleton rows={7} /> : null}

      {state === "error" ? (
        <ErrorState
          message={error ?? "Audit logs could not be loaded."}
          onRetry={() => void loadAuditLogs()}
          title="Audit logs could not be loaded."
        />
      ) : null}

      {state === "ready" && auditLogs.length === 0 ? (
        <EmptyState
          description={
            isFiltered
              ? "No audit events match your filters."
              : "No audit activity has been recorded yet."
          }
          filtered={isFiltered}
          title={isFiltered ? "No audit events match these filters." : "No audit activity yet."}
        />
      ) : null}

      {state === "ready" && auditLogs.length > 0 ? (
        <DataTableContainer>
          <div className="overflow-x-auto">
            <DataTable className="min-w-[960px]">
              <thead>
                <tr>
                  <TableHeaderCell>Time</TableHeaderCell>
                  <TableHeaderCell>Actor</TableHeaderCell>
                  <TableHeaderCell>Action</TableHeaderCell>
                  <TableHeaderCell>Category</TableHeaderCell>
                  <TableHeaderCell>Resource</TableHeaderCell>
                  <TableHeaderCell>Summary</TableHeaderCell>
                  <TableHeaderCell className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHeaderCell>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {auditLogs.map((auditLog) => (
                  <tr
                    className="transition duration-150 hover:bg-[var(--surface-selected)]"
                    key={auditLog.id}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">
                      {formatDateTime(auditLog.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">{auditLog.actorLabel}</td>
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      {auditLog.actionLabel}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={auditLog.category} tone="neutral">
                        {categoryLabels[auditLog.category]}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {auditLog.resource ? auditLog.resource.label : "None"}
                    </td>
                    <td className="max-w-sm px-4 py-3 text-[var(--text-secondary)]">
                      {auditLog.metadataSummary || "No additional details"}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <TableRowActionMenu
                        items={[
                          {
                            label: "View details",
                            onSelect: () => void loadAuditLogDetail(auditLog.id)
                          }
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
          <DataPagination
            canGoNext={pagination.page < pagination.totalPages}
            canGoPrevious={pagination.page > 1}
            label={
              <span>
                Page {pagination.page} of {pagination.totalPages} • {pagination.total} events
              </span>
            }
            onNext={() => void loadAuditLogs(pagination.page + 1)}
            onPrevious={() => void loadAuditLogs(pagination.page - 1)}
          />
        </DataTableContainer>
      ) : null}

      <Drawer
        description="Safe metadata for this organisation event."
        onClose={() => setDetailOpen(false)}
        open={detailOpen}
        title="Event detail"
      >
        <AuditLogDetailBody
          auditLog={selectedAuditLog}
          error={detailError}
          state={detailState}
        />
      </Drawer>
    </section>
  );
}

function AuditLogDetailBody({
  auditLog,
  error,
  state
}: {
  auditLog: AuditLogDetail | null;
  error: string | null;
  state: LoadState;
}) {
  if (state === "loading") {
    return <p className="text-sm text-[var(--text-secondary)]">Loading event...</p>;
  }

  if (state === "error") {
    return (
      <Alert tone="error">
        <p>{error ?? "Audit log detail could not be loaded."}</p>
      </Alert>
    );
  }

  if (!auditLog) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        Select an audit event to inspect details.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <DetailRow label="Action" value={auditLog.actionLabel} />
      <DetailRow label="Category" value={categoryLabels[auditLog.category]} />
      <DetailRow label="Timestamp" value={formatDateTime(auditLog.createdAt)} />
      <DetailRow label="Actor" value={auditLog.actorLabel} />
      <div>
        <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">
          Related resource
        </p>
        {auditLog.resource ? (
          <RelatedResourceLink resource={auditLog.resource} />
        ) : (
          <p className="mt-1 text-sm text-[var(--text-primary)]">None</p>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">Event details</p>
        {auditLog.metadataFields.length > 0 ? (
          <dl className="mt-2 divide-y divide-[var(--border-subtle)] rounded-[var(--radius-control)] border border-[var(--border-subtle)]">
            {auditLog.metadataFields.map((field) => (
              <div className="grid gap-2 px-3 py-2 sm:grid-cols-[120px_1fr]" key={field.key}>
                <dt className="text-xs font-semibold text-[var(--text-muted)]">{field.label}</dt>
                <dd className="break-words text-sm text-[var(--text-primary)]">{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-1 text-sm text-[var(--text-primary)]">No additional details</p>
        )}
      </div>
    </div>
  );
}

function RelatedResourceLink({ resource }: { resource: NonNullable<AuditLogDetail["resource"]> }) {
  const href = getResourceHref(resource.type, resource.id);

  if (!href) {
    return <p className="mt-1 text-sm text-[var(--text-primary)]">{resource.label}</p>;
  }

  return (
    <Link
      className="mt-1 inline-flex text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
      href={href}
    >
      {resource.label}
    </Link>
  );
}

function getResourceHref(resourceType: string, resourceId: string) {
  const paths: Record<string, string> = {
    customer: `/customers/${resourceId}`,
    invoice: `/invoices/${resourceId}`,
    payment: `/payments/${resourceId}`,
    receipt: `/receipts/${resourceId}`
  };

  return paths[resourceType] ?? null;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

const auditCategories: AuditLogCategory[] = [
  "authentication",
  "team",
  "customer",
  "invoice",
  "payment_setup",
  "payment",
  "reconciliation",
  "refund",
  "receipt",
  "export",
  "system"
];

const categoryLabels: Record<AuditLogCategory, string> = {
  authentication: "Authentication",
  customer: "Customer",
  export: "Export",
  invoice: "Invoice",
  payment: "Payment",
  payment_setup: "Payment setup",
  receipt: "Receipt",
  reconciliation: "Reconciliation",
  refund: "Refund",
  system: "System",
  team: "Team"
};
