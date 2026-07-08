"use client";

import React, { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { Select } from "@/components/ui/select";
import type { Membership } from "@/features/auth/types";
import { getApiErrorMessage } from "@/lib/api";

import { downloadExportCsv, type ExportDataset, type ExportFilters } from "./exports-api";

const exportRoles = ["owner", "admin", "accountant"] as const;

type DatasetConfig = {
  dataset: ExportDataset;
  description: string;
  ownerAdminOnly?: boolean;
  title: string;
};

const datasets: DatasetConfig[] = [
  {
    dataset: "customers",
    title: "Customers",
    description: "Download active or archived customer contact records."
  },
  {
    dataset: "invoices",
    title: "Invoices",
    description: "Download invoice totals, balances, statuses, and dates."
  },
  {
    dataset: "payments",
    title: "Payments",
    description: "Download payment attempts and reconciliation states."
  },
  {
    dataset: "receipts",
    title: "Receipts",
    description: "Download confirmed payment receipts and refund summaries."
  },
  {
    dataset: "audit-logs",
    title: "Audit Logs",
    description: "Download the organisation's operational audit history.",
    ownerAdminOnly: true
  }
];

export function ExportsPage() {
  return (
    <AppShell deniedMessage="Viewer access cannot generate exports." requiredRoles={exportRoles}>
      {({ accessToken, me }) => (
        <ExportsContent accessToken={accessToken} role={me.membership.role} />
      )}
    </AppShell>
  );
}

export function ExportsContent({
  accessToken,
  role
}: {
  accessToken: string;
  role: Membership["role"];
}) {
  const [pendingDataset, setPendingDataset] = useState<ExportDataset | null>(null);
  const [filters, setFilters] = useState<Record<ExportDataset, ExportFilters>>({
    customers: { status: "active" },
    invoices: {},
    payments: { view: "reconciliation", status: "all" },
    receipts: { refundState: "all" },
    "audit-logs": {}
  });

  const visibleDatasets = datasets.filter(
    (dataset) => !dataset.ownerAdminOnly || role === "owner" || role === "admin"
  );

  async function handleDownload(dataset: ExportDataset) {
    setPendingDataset(dataset);

    try {
      await downloadExportCsv(accessToken, dataset, filters[dataset]);
      toast.success(`${datasetLabels[dataset]} export downloaded.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Export could not be downloaded."));
    } finally {
      setPendingDataset(null);
    }
  }

  function updateFilter(dataset: ExportDataset, key: string, value: string) {
    setFilters((current) => ({
      ...current,
      [dataset]: {
        ...current[dataset],
        [key]: value
      }
    }));
  }

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-3xl font-semibold text-slate-950">Exports</h1>
        <p className="mt-2 text-sm text-slate-600">
          Download organisation data for reporting and offline analysis.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        {visibleDatasets.map((config) => (
          <ExportPanel
            config={config}
            filters={filters[config.dataset]}
            isDownloading={pendingDataset === config.dataset}
            key={config.dataset}
            onDownload={() => void handleDownload(config.dataset)}
            onFilterChange={(key, value) => updateFilter(config.dataset, key, value)}
          />
        ))}
      </div>
    </section>
  );
}

function ExportPanel({
  config,
  filters,
  isDownloading,
  onDownload,
  onFilterChange
}: {
  config: DatasetConfig;
  filters: ExportFilters;
  isDownloading: boolean;
  onDownload: () => void;
  onFilterChange: (key: string, value: string) => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{config.title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{config.description}</p>
        </div>
        <button
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={isDownloading}
          onClick={onDownload}
          type="button"
        >
          {isDownloading ? "Downloading..." : "Download CSV"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {config.dataset === "customers" ? (
          <>
            <SelectField
              label="Status"
              onChange={(value) => onFilterChange("status", value)}
              value={filters.status ?? "active"}
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </SelectField>
            <TextField
              label="Search"
              onChange={(value) => onFilterChange("search", value)}
              placeholder="Name, email, or phone"
              value={filters.search ?? ""}
            />
          </>
        ) : null}

        {config.dataset === "invoices" ? (
          <>
            <SelectField
              label="Status"
              onChange={(value) => onFilterChange("status", value)}
              value={filters.status ?? ""}
            >
              <option value="">All statuses</option>
              {invoiceStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status] ?? status}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Search"
              onChange={(value) => onFilterChange("search", value)}
              placeholder="Invoice, customer, or email"
              value={filters.search ?? ""}
            />
            <DateField
              label="Issue from"
              onChange={(value) => onFilterChange("issueDateFrom", value)}
              value={filters.issueDateFrom ?? ""}
            />
            <DateField
              label="Issue to"
              onChange={(value) => onFilterChange("issueDateTo", value)}
              value={filters.issueDateTo ?? ""}
            />
            <DateField
              label="Due from"
              onChange={(value) => onFilterChange("dueDateFrom", value)}
              value={filters.dueDateFrom ?? ""}
            />
            <DateField
              label="Due to"
              onChange={(value) => onFilterChange("dueDateTo", value)}
              value={filters.dueDateTo ?? ""}
            />
          </>
        ) : null}

        {config.dataset === "payments" ? (
          <>
            <SelectField
              label="View"
              onChange={(value) => onFilterChange("view", value)}
              value={filters.view ?? "reconciliation"}
            >
              <option value="reconciliation">Reconciliation</option>
              <option value="all_attempts">All attempts</option>
              <option value="review_required">Needs review</option>
            </SelectField>
            <SelectField
              label="Status"
              onChange={(value) => onFilterChange("status", value)}
              value={filters.status ?? "all"}
            >
              <option value="all">All</option>
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status] ?? status}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Reconciliation"
              onChange={(value) => onFilterChange("reconciliationState", value)}
              value={filters.reconciliationState ?? ""}
            >
              <option value="">All states</option>
              {reconciliationStates.map((state) => (
                <option key={state} value={state}>
                  {statusLabels[state] ?? state}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Search"
              onChange={(value) => onFilterChange("search", value)}
              placeholder="Reference, invoice, customer"
              value={filters.search ?? ""}
            />
            <DateField
              label="From"
              onChange={(value) => onFilterChange("dateFrom", value)}
              value={filters.dateFrom ?? ""}
            />
            <DateField
              label="To"
              onChange={(value) => onFilterChange("dateTo", value)}
              value={filters.dateTo ?? ""}
            />
          </>
        ) : null}

        {config.dataset === "receipts" ? (
          <>
            <SelectField
              label="Refund state"
              onChange={(value) => onFilterChange("refundState", value)}
              value={filters.refundState ?? "all"}
            >
              <option value="all">All</option>
              <option value="none">No refunds</option>
              <option value="partially_refunded">Partially refunded</option>
              <option value="refunded">Refunded</option>
            </SelectField>
            <TextField
              label="Search"
              onChange={(value) => onFilterChange("search", value)}
              placeholder="Receipt, invoice, customer"
              value={filters.search ?? ""}
            />
            <DateField
              label="From"
              onChange={(value) => onFilterChange("dateFrom", value)}
              value={filters.dateFrom ?? ""}
            />
            <DateField
              label="To"
              onChange={(value) => onFilterChange("dateTo", value)}
              value={filters.dateTo ?? ""}
            />
          </>
        ) : null}

        {config.dataset === "audit-logs" ? (
          <>
            <SelectField
              label="Category"
              onChange={(value) => onFilterChange("category", value)}
              value={filters.category ?? ""}
            >
              <option value="">All categories</option>
              {auditCategories.map((category) => (
                <option key={category} value={category}>
                  {statusLabels[category] ?? category}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Action"
              onChange={(value) => onFilterChange("action", value)}
              placeholder="invoice_sent"
              value={filters.action ?? ""}
            />
            <TextField
              label="Search"
              onChange={(value) => onFilterChange("search", value)}
              placeholder="Actor, resource, summary"
              value={filters.search ?? ""}
            />
            <DateField
              label="From"
              onChange={(value) => onFilterChange("dateFrom", value)}
              value={filters.dateFrom ?? ""}
            />
            <DateField
              label="To"
              onChange={(value) => onFilterChange("dateTo", value)}
              value={filters.dateTo ?? ""}
            />
          </>
        ) : null}
      </div>
    </article>
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

const datasetLabels: Record<ExportDataset, string> = {
  customers: "Customer",
  invoices: "Invoice",
  payments: "Payment",
  receipts: "Receipt",
  "audit-logs": "Audit logs"
};

const invoiceStatuses = [
  "draft",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
  "void"
];
const paymentStatuses = ["pending", "successful", "failed", "abandoned", "refunded"];
const reconciliationStates = [
  "matched",
  "pending_confirmation",
  "stale_pending",
  "failed",
  "abandoned",
  "refunded",
  "superseded",
  "overpaid",
  "resolution_in_progress",
  "resolved",
  "review_required",
  "unknown"
];
const auditCategories = [
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

const statusLabels: Record<string, string> = {
  abandoned: "Abandoned",
  authentication: "Authentication",
  cancelled: "Cancelled",
  customer: "Customer",
  draft: "Draft",
  export: "Export",
  failed: "Failed",
  invoice: "Invoice",
  matched: "Matched",
  overpaid: "Overpayment review",
  overdue: "Overdue",
  paid: "Paid",
  partially_paid: "Partially paid",
  payment: "Payment",
  payment_setup: "Payment setup",
  pending: "Pending",
  pending_confirmation: "Pending confirmation",
  receipt: "Receipt",
  reconciliation: "Reconciliation",
  refunded: "Refunded",
  resolution_in_progress: "Resolution in progress",
  resolved: "Resolved",
  review_required: "Review required",
  sent: "Sent",
  stale_pending: "Stale pending",
  successful: "Successful",
  superseded: "Superseded",
  system: "System",
  team: "Team",
  unknown: "Unknown",
  viewed: "Viewed",
  void: "Void"
};
