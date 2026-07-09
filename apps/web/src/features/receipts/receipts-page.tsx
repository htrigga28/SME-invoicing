"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button, LinkButton } from "@/components/ui/button";
import {
  DataTable,
  DataTableContainer,
  MobileDataCard,
  Pagination as DataPagination,
  TableHeaderCell
} from "@/components/ui/data-table";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { FilterActions, FilterBar, FilterGrid } from "@/components/ui/filter-bar";
import { DateInput as DateControl, FieldLabel, FormField, Input } from "@/components/ui/form";
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

      <FilterBar aria-label="Receipt filters" onSubmit={handleSearch}>
        <FilterGrid className="lg:grid-cols-[minmax(180px,1fr)_190px_150px_150px_auto]">
          <FormField>
            <FieldLabel>Search</FieldLabel>
            <Input
              className="mt-1"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Receipt, invoice, customer, or payment reference"
              value={searchInput}
            />
          </FormField>
          <FormField>
            <FieldLabel>Refund state</FieldLabel>
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
          </FormField>
          <DateInput label="From" onChange={setDateFrom} value={dateFrom} />
          <DateInput label="To" onChange={setDateTo} value={dateTo} />
          <FilterActions>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </FilterActions>
        </FilterGrid>
      </FilterBar>

      {state === "loading" ? <LoadingSkeleton rows={5} /> : null}

      {state === "error" ? (
        <StatusPanel
          action={<RetryButton onClick={() => void loadReceipts()} />}
          message="Receipts could not be loaded."
          tone="error"
        />
      ) : null}

      {state === "ready" && receipts.length === 0 ? (
        <EmptyState
          description={
            isFiltered
              ? "No receipts match your filters."
              : "Receipts will appear here after successful payments are confirmed."
          }
          filtered={isFiltered}
          title={isFiltered ? "No receipts match these filters." : "No receipts yet."}
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
    <DataTableContainer>
      <div className="hidden overflow-x-auto xl:block">
        <DataTable>
          <thead>
            <tr>
              <TableHeaderCell>Receipt</TableHeaderCell>
              <TableHeaderCell>Invoice</TableHeaderCell>
              <TableHeaderCell>Customer</TableHeaderCell>
              <TableHeaderCell>Payment reference</TableHeaderCell>
              <TableHeaderCell className="text-right">Amount</TableHeaderCell>
              <TableHeaderCell>Refund state</TableHeaderCell>
              <TableHeaderCell>Issued</TableHeaderCell>
              <TableHeaderCell className="text-right">Action</TableHeaderCell>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {receipts.map((receipt) => (
              <ReceiptTableRow key={receipt.id} receipt={receipt} />
            ))}
          </tbody>
        </DataTable>
      </div>

      <div className="divide-y divide-slate-100 xl:hidden">
        {receipts.map((receipt) => (
          <ReceiptCard key={receipt.id} receipt={receipt} />
        ))}
      </div>

      <DataPagination
        canGoNext={pagination.page < pagination.totalPages}
        canGoPrevious={pagination.page > 1}
        label={
          <span>
            Page {pagination.page} of {pagination.totalPages} • {pagination.total} receipts
          </span>
        }
        onNext={onNext}
        onPrevious={onPrevious}
      />
    </DataTableContainer>
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
      <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
        {formatMoney(receipt.amountKobo)}
      </td>
      <td className="px-4 py-3">
        <RefundStateBadge state={receipt.refundSummary.refundState} />
      </td>
      <td className="px-4 py-3 text-slate-600">{formatDateTime(receipt.issuedAt)}</td>
      <td className="px-4 py-3 text-right">
        <LinkButton href={`/receipts/${receipt.id}`} size="sm" variant="outline">
          View
        </LinkButton>
      </td>
    </tr>
  );
}

function ReceiptCard({ receipt }: { receipt: ReceiptListItem }) {
  return (
    <MobileDataCard>
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
        <span className="font-mono tabular-nums">{formatMoney(receipt.amountKobo)}</span>
        <span>{receipt.paymentReference}</span>
        <span>{formatDateTime(receipt.issuedAt)}</span>
      </div>
      <LinkButton href={`/receipts/${receipt.id}`} size="sm" variant="outline">
        View
      </LinkButton>
    </MobileDataCard>
  );
}
