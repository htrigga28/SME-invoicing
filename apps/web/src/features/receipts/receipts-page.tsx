"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
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
  DataToolbarFilters,
  DataToolbarSearch,
  StatusTabs
} from "@/components/ui/data-toolbar";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { DateInput, Input } from "@/components/ui/form";
import { TableRowActionMenu } from "@/components/ui/menu";
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
type RefundTab = ReceiptRefundState | "all";

const refundTabs: { label: string; value: RefundTab }[] = [
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
  const [refundState, setRefundState] = useState<RefundTab>("all");
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

  function handleClearFilters() {
    setSearch("");
    setSearchInput("");
    setRefundState("all");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <section className="space-y-4">
      <PageHeader
        description="View immutable receipts generated after successful payment confirmation."
        title="Receipts"
      />

      {error ? <StatusPanel message={error} tone="error" /> : null}

      <StatusTabs<RefundTab>
        label="Filter receipts by refund state"
        onChange={setRefundState}
        options={refundTabs}
        value={refundState}
      />

      <DataToolbar>
        <DataToolbarSearch>
          <form onSubmit={handleSearch} role="search">
            <Input
              aria-label="Search receipts"
              onChange={(event) => {
                setSearchInput(event.target.value);
                if (event.target.value === "") setSearch("");
              }}
              placeholder="Search receipt, invoice, customer…"
              value={searchInput}
            />
          </form>
        </DataToolbarSearch>
        <DataToolbarFilters>
          <label className="sr-only" htmlFor="receipt-refund-filter">
            Refund state
          </label>
          <Select
            aria-label="Refund state"
            id="receipt-refund-filter"
            onChange={(event) => setRefundState(event.target.value as RefundTab)}
            value={refundState}
            wrapperClassName="w-44"
          >
            {refundTabs.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <label className="sr-only" htmlFor="receipt-date-from">
            From
          </label>
          <DateInput
            aria-label="From"
            className="w-40"
            id="receipt-date-from"
            onChange={(event) => setDateFrom(event.target.value)}
            value={dateFrom}
          />
          <label className="sr-only" htmlFor="receipt-date-to">
            To
          </label>
          <DateInput
            aria-label="To"
            className="w-40"
            id="receipt-date-to"
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
              ? "Adjust search, refund state, or date filters to widen the receipt list."
              : "Receipts will appear here after successful payments are confirmed."
          }
          filtered={isFiltered}
          title={isFiltered ? "No receipts match these filters." : "No receipts yet."}
        />
      ) : null}

      {state === "ready" && receipts.length > 0 ? (
        <DataTableContainer>
          <div className="hidden overflow-x-auto lg:block">
            <DataTable>
              <thead>
                <tr>
                  <TableHeaderCell>Receipt</TableHeaderCell>
                  <TableHeaderCell>Customer</TableHeaderCell>
                  <TableHeaderCell>Invoice</TableHeaderCell>
                  <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                  <TableHeaderCell>Refund state</TableHeaderCell>
                  <TableHeaderCell>Issued</TableHeaderCell>
                  <TableHeaderCell className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHeaderCell>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {receipts.map((receipt) => (
                  <ReceiptTableRow key={receipt.id} receipt={receipt} />
                ))}
              </tbody>
            </DataTable>
          </div>

          <div className="divide-y divide-[var(--border-subtle)] lg:hidden">
            {receipts.map((receipt) => (
              <ReceiptCard key={receipt.id} receipt={receipt} />
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
              Page {pagination.page} of {pagination.totalPages} • {pagination.total} receipts
            </span>
          }
          onNext={() => void loadReceipts(pagination.page + 1)}
          onPrevious={() => void loadReceipts(pagination.page - 1)}
        />
      ) : null}
    </section>
  );
}

function ReceiptTableRow({ receipt }: { receipt: ReceiptListItem }) {
  return (
    <tr className="transition duration-150 hover:bg-[var(--surface-selected)]">
      <td className="px-4 py-3.5">
        <DetailLink href={`/receipts/${receipt.id}`}>{receipt.receiptNumber}</DetailLink>
        <p className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">
          {receipt.paymentReference}
        </p>
      </td>
      <td className="px-4 py-3.5">
        <p className="font-medium text-[var(--text-primary)]">{receipt.customer.name}</p>
        <p className="text-xs text-[var(--text-muted)]">{receipt.customer.email}</p>
      </td>
      <td className="px-4 py-3.5">
        <Link
          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
          href={`/invoices/${receipt.invoice.id}`}
        >
          {receipt.invoice.invoiceNumber}
        </Link>
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-[var(--text-primary)]">
        {formatMoney(receipt.amountKobo)}
      </td>
      <td className="px-4 py-3.5">
        <RefundStateBadge state={receipt.refundSummary.refundState} />
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-[var(--text-secondary)]">
        {formatDateTime(receipt.issuedAt)}
      </td>
      <td className="px-2 py-3.5 text-right">
        <TableRowActionMenu
          items={[
            { label: "View receipt", href: `/receipts/${receipt.id}` },
            { label: "View invoice", href: `/invoices/${receipt.invoice.id}` }
          ]}
        />
      </td>
    </tr>
  );
}

function ReceiptCard({ receipt }: { receipt: ReceiptListItem }) {
  return (
    <MobileDataCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <DetailLink href={`/receipts/${receipt.id}`}>{receipt.receiptNumber}</DetailLink>
          <p className="truncate text-sm text-[var(--text-secondary)]">
            {receipt.invoice.invoiceNumber} • {receipt.customer.name}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {formatDateTime(receipt.issuedAt)}
          </p>
        </div>
        <RefundStateBadge state={receipt.refundSummary.refundState} />
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold tabular-nums text-[var(--text-primary)]">
          {formatMoney(receipt.amountKobo)}
        </span>
        <span className="truncate font-mono text-xs text-[var(--text-muted)]">
          {receipt.paymentReference}
        </span>
      </div>
    </MobileDataCard>
  );
}
