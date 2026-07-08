"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Select } from "@/components/ui/select";
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
      <header>
        <h1 className="text-3xl font-semibold text-slate-950">Audit Logs</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review important activity across your organisation.
        </p>
      </header>

      {error ? <StatusPanel message={error} tone="error" /> : null}

      <form className="rounded-lg border border-slate-200 bg-white p-4" onSubmit={handleSearch}>
        <div className="grid gap-3 lg:grid-cols-[1fr_170px_170px_170px_170px_150px_150px_auto]">
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
          <button
            className="self-end rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            type="submit"
          >
            Apply
          </button>
        </div>
      </form>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {state === "loading" ? <StatusPanel message="Loading audit logs..." /> : null}

          {state === "error" ? (
            <StatusPanel
              action={<RetryButton onClick={() => void loadAuditLogs()} />}
              message="Audit logs could not be loaded."
              tone="error"
            />
          ) : null}

          {state === "ready" && auditLogs.length === 0 ? (
            <StatusPanel
              message={
                isFiltered
                  ? "No audit events match your filters."
                  : "No audit activity has been recorded yet."
              }
            />
          ) : null}

          {state === "ready" && auditLogs.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Resource</th>
                      <th className="px-4 py-3">Summary</th>
                      <th className="px-4 py-3">View</th>
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
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                            {categoryLabels[auditLog.category]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {auditLog.resource ? auditLog.resource.label : "None"}
                        </td>
                        <td className="max-w-sm px-4 py-3 text-slate-600">
                          {auditLog.metadataSummary || "No additional details"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
                            onClick={() => void loadAuditLogDetail(auditLog.id)}
                            type="button"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls pagination={pagination} onPageChange={loadAuditLogs} />
            </>
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
    <aside className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-950">Event detail</h2>
      {state === "loading" ? <p className="mt-4 text-sm text-slate-600">Loading event...</p> : null}
      {state === "error" ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
              <dl className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200">
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
    </aside>
  );
}

function RelatedResourceLink({ resource }: { resource: NonNullable<AuditLogDetail["resource"]> }) {
  const href = getResourceHref(resource.type, resource.id);

  if (!href) {
    return <p className="mt-1 text-sm text-slate-700">{resource.label}</p>;
  }

  return (
    <Link className="mt-1 inline-flex text-sm font-semibold text-teal-700" href={href}>
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

function PaginationControls({
  onPageChange,
  pagination
}: {
  onPageChange: (page: number) => void;
  pagination: Pagination;
}) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <span>
        Page {pagination.page} of {pagination.totalPages} · {pagination.total} events
      </span>
      <div className="flex gap-2">
        <button
          className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
          type="button"
        >
          Previous
        </button>
        <button
          className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function StatusPanel({
  action,
  message,
  tone = "neutral"
}: {
  action?: React.ReactNode;
  message: string;
  tone?: "error" | "neutral";
}) {
  const className =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-white text-slate-600";

  return (
    <div className={`m-4 rounded-lg border p-5 text-sm ${className}`}>
      <p>{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
      onClick={onClick}
      type="button"
    >
      Retry
    </button>
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
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function DateField(props: Omit<React.ComponentProps<typeof TextField>, "placeholder">) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{props.label}</span>
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => props.onChange(event.target.value)}
        type="date"
        value={props.value}
      />
    </label>
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
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <Select
        onChange={(event) => onChange(event.target.value)}
        value={value}
        wrapperClassName="mt-1"
      >
        {children}
      </Select>
    </label>
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
