"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import {
  DataTable,
  DataTableContainer,
  Pagination as DataPagination,
  TableHeaderCell
} from "@/components/ui/data-table";
import { Alert, EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback";
import { FilterActions, FilterBar, FilterGrid } from "@/components/ui/filter-bar";
import { DateInput as DateControl, FieldLabel, FormField, Input } from "@/components/ui/form";
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

  return (
    <section className="space-y-5">
      <PageHeader
        description="Review important activity across your organisation."
        title="Audit Logs"
      />

      {error && state !== "error" ? (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      ) : null}

      <FilterBar aria-label="Audit log filters" onSubmit={handleSearch}>
        <FilterGrid className="lg:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(140px,170px))] 2xl:grid-cols-[minmax(220px,1fr)_170px_170px_170px_170px_150px_150px_auto]">
          <TextField
            label="Search"
            onChange={setSearchInput}
            placeholder="Actor, action, resource, or summary"
            value={searchInput}
          />
          <SelectField
            label="Category"
            onChange={(value) => setCategory(value as AuditLogCategory | "")}
            value={category}
          >
            <option value="">All categories</option>
            {auditCategories.map((item) => (
              <option key={item} value={item}>
                {categoryLabels[item]}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Action"
            onChange={setAction}
            placeholder="invoice_sent"
            value={action}
          />
          <TextField
            label="Actor ID"
            onChange={setActorUserId}
            placeholder="User UUID"
            value={actorUserId}
          />
          <TextField
            label="Resource"
            onChange={setResourceType}
            placeholder="invoice"
            value={resourceType}
          />
          <DateField label="From" onChange={setDateFrom} value={dateFrom} />
          <DateField label="To" onChange={setDateTo} value={dateTo} />
          <FilterActions>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </FilterActions>
        </FilterGrid>
      </FilterBar>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
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
                      <TableHeaderCell>View</TableHeaderCell>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((auditLog) => (
                      <tr key={auditLog.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDateTime(auditLog.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{auditLog.actorLabel}</td>
                        <td className="px-4 py-3 font-medium text-slate-950">
                          {auditLog.actionLabel}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={auditLog.category} tone="neutral">
                            {categoryLabels[auditLog.category]}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {auditLog.resource ? auditLog.resource.label : "None"}
                        </td>
                        <td className="max-w-sm px-4 py-3 text-slate-600">
                          {auditLog.metadataSummary || "No additional details"}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            onClick={() => void loadAuditLogDetail(auditLog.id)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            View
                          </Button>
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
        </div>

        <AuditLogDetailPanel auditLog={selectedAuditLog} error={detailError} state={detailState} />
      </div>
    </section>
  );
}

function AuditLogDetailPanel({
  auditLog,
  error,
  state
}: {
  auditLog: AuditLogDetail | null;
  error: string | null;
  state: LoadState;
}) {
  return (
    <SectionCard>
      <h2 className="text-lg font-semibold text-slate-950">Event detail</h2>
      {state === "loading" ? <p className="mt-4 text-sm text-slate-600">Loading event...</p> : null}
      {state === "error" ? (
        <p className="mt-4 rounded-[var(--radius-control)] border border-[var(--danger-border)] bg-[var(--danger-muted)] p-3 text-sm text-[var(--danger)]">
          {error ?? "Audit log detail could not be loaded."}
        </p>
      ) : null}
      {state === "ready" && !auditLog ? (
        <p className="mt-4 text-sm text-slate-600">Select an audit event to inspect details.</p>
      ) : null}
      {state === "ready" && auditLog ? (
        <div className="mt-4 space-y-4">
          <DetailRow label="Action" value={auditLog.actionLabel} />
          <DetailRow label="Category" value={categoryLabels[auditLog.category]} />
          <DetailRow label="Timestamp" value={formatDateTime(auditLog.createdAt)} />
          <DetailRow label="Actor" value={auditLog.actorLabel} />
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Related resource</p>
            {auditLog.resource ? (
              <RelatedResourceLink resource={auditLog.resource} />
            ) : (
              <p className="mt-1 text-sm text-slate-700">None</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Event details</p>
            {auditLog.metadataFields.length > 0 ? (
              <dl className="mt-2 divide-y divide-[var(--border-subtle)] rounded-[var(--radius-control)] border border-[var(--border-subtle)]">
                {auditLog.metadataFields.map((field) => (
                  <div className="grid gap-2 px-3 py-2 sm:grid-cols-[120px_1fr]" key={field.key}>
                    <dt className="text-xs font-semibold text-slate-500">{field.label}</dt>
                    <dd className="break-words text-sm text-slate-800">{field.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-1 text-sm text-slate-700">No additional details</p>
            )}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function RelatedResourceLink({ resource }: { resource: NonNullable<AuditLogDetail["resource"]> }) {
  const href = getResourceHref(resource.type, resource.id);

  if (!href) {
    return <p className="mt-1 text-sm text-slate-700">{resource.label}</p>;
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
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value}</p>
    </div>
  );
}

function TextField({
  label,
  onChange,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <FormField>
      <FieldLabel>{label}</FieldLabel>
      <Input
        className="mt-1"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </FormField>
  );
}

function DateField({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <FormField>
      <FieldLabel>{label}</FieldLabel>
      <DateControl
        className="mt-1"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </FormField>
  );
}

function SelectField({
  children,
  label,
  onChange,
  value
}: {
  children: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <FormField>
      <FieldLabel>{label}</FieldLabel>
      <Select
        onChange={(event) => onChange(event.target.value)}
        value={value}
        wrapperClassName="mt-1"
      >
        {children}
      </Select>
    </FormField>
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
