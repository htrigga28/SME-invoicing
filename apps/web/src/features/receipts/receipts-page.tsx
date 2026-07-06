"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Select } from "@/components/ui/select";
import { clearStoredSession } from "@/features/auth/session";
import type { Pagination } from "@/features/customers/types";
import { isApiRequestError } from "@/lib/api";

import { listReceipts, type ListReceiptsInput } from "./receipts-api";
import {
  DetailLink,
  formatDateTime,
  formatMoney,
  PageHeader,
  RefundStateBadge,
  RetryButton,
  StatusPanel
} from "./receipt-ui";
import type { ReceiptListItem, ReceiptRefundState } from "./types";

type LoadState = "loading" | "ready" | "error";

const refundStates: { label: string; value: ReceiptRefundState | "all" }[] = [
  { label: "All", value: "all" },
  { label: "No refunds", value: "none" },
  { label: "Partially refunded", value: "partially_refunded" },
  { label: "Refunded", value: "refunded" }
];

export function ReceiptsPage() {
  return <AppShell>{({ accessToken }) => <ReceiptsContent accessToken={accessToken} />}</AppShell>;
}

export function ReceiptsContent({ accessToken }: { accessToken: string }) {
  const [receipts, setReceipts] = useState<ReceiptListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [refundState, setRefundState] = useState<ReceiptRefundState | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  const isFiltered = useMemo(
    () => search.trim().length > 0 || refundState !== "all" || dateFrom !== "" || dateTo !== "",
    [dateFrom, dateTo, refundState, search]
  );

  useEffect(() => {
    void loadReceipts(1);
  }, [accessToken, search, refundState, dateFrom, dateTo]);

  async function loadReceipts(page = pagination.page) {
    setState("loading");
    setError(null);

    try {
      const input: ListReceiptsInput = {
        ...(search.trim() ? { search: search.trim() } : {}),
        refundState,
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        page,
        limit: pagination.limit
      };
      const response = await listReceipts(accessToken, input);

      setReceipts(response.receipts);
      setPagination(response.pagination);
      setState("ready");
    } catch (loadError) {
      if (isApiRequestError(loadError) && loadError.status === 401) {
        clearStoredSession();
        window.location.assign("/login");
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Could not load receipts.");
      setState("error");
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput);
  }

  return (
    <section className="space-y-5">
      <PageHeader
        description="View immutable receipts generated after successful payment confirmation."
        title="Receipts"
      />

      {error ? <StatusPanel message={error} tone="error" /> : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <form
          className="grid gap-3 lg:grid-cols-[1fr_190px_150px_150px_auto]"
          onSubmit={handleSearch}
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Search</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Receipt, invoice, customer, or payment reference"
              value={searchInput}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Refund state</span>
            <Select
              onChange={(event) => setRefundState(event.target.value as ReceiptRefundState | "all")}
              value={refundState}
              wrapperClassName="mt-1"
            >
              {refundStates.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <DateInput label="From" onChange={setDateFrom} value={dateFrom} />
          <DateInput label="To" onChange={setDateTo} value={dateTo} />
          <button
            className="self-end rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            type="submit"
          >
            Apply
          </button>
        </form>
      </div>

      {state === "loading" ? <StatusPanel message="Loading receipts..." /> : null}

      {state === "error" ? (
        <StatusPanel
          action={<RetryButton onClick={() => void loadReceipts()} />}
          message="Receipts could not be loaded."
          tone="error"
        />
      ) : null}

      {state === "ready" && receipts.length === 0 ? (
        <StatusPanel
          message={
            isFiltered
              ? "No receipts match your filters."
              : "Receipts will appear here after successful payments are confirmed."
          }
        />
      ) : null}

      {state === "ready" && (receipts.length > 0 || pagination.total > 0) ? (
        <ReceiptResults
          onNext={() => void loadReceipts(pagination.page + 1)}
          onPrevious={() => void loadReceipts(pagination.page - 1)}
          pagination={pagination}
          receipts={receipts}
        />
      ) : null}
    </section>
  );
}

function DateInput({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}

function ReceiptResults({
  onNext,
  onPrevious,
  pagination,
  receipts
}: {
  onNext: () => void;
  onPrevious: () => void;
  pagination: Pagination;
  receipts: ReceiptListItem[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Payment reference</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Refund state</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {receipts.map((receipt) => (
              <ReceiptTableRow key={receipt.id} receipt={receipt} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 xl:hidden">
        {receipts.map((receipt) => (
          <ReceiptCard key={receipt.id} receipt={receipt} />
        ))}
      </div>

      <PaginationControls onNext={onNext} onPrevious={onPrevious} pagination={pagination} />
    </div>
  );
}

function ReceiptTableRow({ receipt }: { receipt: ReceiptListItem }) {
  return (
    <tr>
      <td className="px-4 py-3">
        <DetailLink href={`/receipts/${receipt.id}`}>{receipt.receiptNumber}</DetailLink>
      </td>
      <td className="px-4 py-3">
        <Link className="font-medium text-slate-950" href={`/invoices/${receipt.invoice.id}`}>
          {receipt.invoice.invoiceNumber}
        </Link>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-950">{receipt.customer.name}</p>
        <p className="text-slate-600">{receipt.customer.email}</p>
      </td>
      <td className="px-4 py-3 text-slate-600">{receipt.paymentReference}</td>
      <td className="px-4 py-3 text-slate-700">{formatMoney(receipt.amountKobo)}</td>
      <td className="px-4 py-3">
        <RefundStateBadge state={receipt.refundSummary.refundState} />
      </td>
      <td className="px-4 py-3 text-slate-600">{formatDateTime(receipt.issuedAt)}</td>
      <td className="px-4 py-3 text-right">
        <Link
          className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700"
          href={`/receipts/${receipt.id}`}
        >
          View
        </Link>
      </td>
    </tr>
  );
}

function ReceiptCard({ receipt }: { receipt: ReceiptListItem }) {
  return (
    <article className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <DetailLink href={`/receipts/${receipt.id}`}>{receipt.receiptNumber}</DetailLink>
          <p className="mt-1 text-sm text-slate-600">
            {receipt.invoice.invoiceNumber} • {receipt.customer.name}
          </p>
        </div>
        <RefundStateBadge state={receipt.refundSummary.refundState} />
      </div>
      <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        <span>{formatMoney(receipt.amountKobo)}</span>
        <span>{receipt.paymentReference}</span>
        <span>{formatDateTime(receipt.issuedAt)}</span>
      </div>
    </article>
  );
}

function PaginationControls({
  onNext,
  onPrevious,
  pagination
}: {
  onNext: () => void;
  onPrevious: () => void;
  pagination: Pagination;
}) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <span>
        Page {pagination.page} of {pagination.totalPages} • {pagination.total} receipts
      </span>
      <div className="flex gap-2">
        <button
          className="rounded-md border border-slate-300 px-3 py-2 font-medium disabled:opacity-50"
          disabled={pagination.page <= 1}
          onClick={onPrevious}
          type="button"
        >
          Previous
        </button>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 font-medium disabled:opacity-50"
          disabled={pagination.page >= pagination.totalPages}
          onClick={onNext}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}
