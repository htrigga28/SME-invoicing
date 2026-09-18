"use client";

import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { getPublicReceipt } from "./receipts-api";
import {
  DetailItem,
  formatDateTime,
  formatMoney,
  RefundStateBadge,
  StatusPanel
} from "./receipt-ui";
import type { ReceiptDetailResponse } from "./types";

type LoadState = "loading" | "ready" | "error";

export function PublicReceiptPage({ token }: { token: string }) {
  const [response, setResponse] = useState<ReceiptDetailResponse | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadReceipt();
  }, [token]);

  async function loadReceipt() {
    setState("loading");
    setError(null);

    try {
      setResponse(await getPublicReceipt(token));
      setState("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Receipt could not be loaded.");
      setState("error");
    }
  }

  if (state === "loading") {
    return (
      <main className="min-h-screen bg-[var(--canvas-warm)] px-4 py-8 text-[var(--text-primary)] sm:px-6">
        <div className="mx-auto max-w-3xl">
          <StatusPanel message="Loading receipt..." />
        </div>
      </main>
    );
  }

  if (state === "error" || !response) {
    return (
      <main className="min-h-screen bg-[var(--canvas-warm)] px-4 py-8 text-[var(--text-primary)] sm:px-6">
        <div className="mx-auto max-w-3xl">
          <StatusPanel message={error ?? "Receipt could not be loaded."} tone="error" />
        </div>
      </main>
    );
  }

  const { receipt } = response;

  return (
    <main className="min-h-screen bg-[var(--canvas-warm)] px-4 py-8 text-[var(--text-primary)] print:bg-white print:p-0 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex justify-end print:hidden">
          <Button onClick={() => window.print()} type="button" variant="outline">
            Print receipt
          </Button>
        </div>

        <article className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-document)] print:border-0 print:shadow-none">
          <header className="border-b border-[var(--border-subtle)] p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <div
                    aria-hidden="true"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent-muted)] text-lg font-semibold text-[var(--accent)]"
                  >
                    {receipt.business.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Receipt
                    </p>
                    <h1 className="mt-1 break-words font-mono text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                      {receipt.receiptNumber}
                    </h1>
                  </div>
                </div>
                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  Issued {formatDateTime(receipt.issuedAt)}
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--success)]">
                  Payment confirmed through Paystack.
                </p>
              </div>
              <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 sm:min-w-56 sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Amount paid
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">
                  {formatMoney(receipt.amountKobo)}
                </p>
                <div className="mt-3 flex sm:justify-end">
                  <RefundStateBadge state={receipt.refundSummary.refundState} />
                </div>
              </div>
            </div>
          </header>

          <section className="grid gap-6 border-b border-[var(--border-subtle)] p-6 sm:grid-cols-2">
            <div className="min-w-0">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                From
              </h2>
              <p className="mt-2 break-words font-semibold text-[var(--text-primary)]">
                {receipt.business.name}
              </p>
              <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">
                {receipt.business.email}
              </p>
              <p className="break-words text-sm text-[var(--text-secondary)]">
                {receipt.business.phone}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--text-secondary)]">
                {receipt.business.address}
              </p>
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                To
              </h2>
              <p className="mt-2 break-words font-semibold text-[var(--text-primary)]">
                {receipt.customer.name}
              </p>
              <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">
                {receipt.customer.email}
              </p>
              <p className="break-words text-sm text-[var(--text-secondary)]">
                {receipt.customer.phone}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--text-secondary)]">
                {receipt.customer.billingAddress}
              </p>
            </div>
          </section>

          <section className="grid gap-4 p-6 sm:grid-cols-2">
            <DetailItem label="Invoice" value={receipt.invoice.invoiceNumber} />
            <DetailItem label="Payment reference" value={receipt.paymentReference} />
            <DetailItem label="Payment provider" value={receipt.paymentProvider} />
            <DetailItem label="Payment channel" value={receipt.paymentChannel ?? "Not recorded"} />
            <DetailItem label="Paid" value={formatDateTime(receipt.paidAt)} />
            <DetailItem
              label="Net retained"
              value={formatMoney(receipt.refundSummary.netRetainedKobo)}
            />
            <DetailItem
              label="Processed refunds"
              value={formatMoney(receipt.refundSummary.processedRefundedKobo)}
            />
            <DetailItem
              label="Refund in progress"
              value={receipt.refundSummary.hasRefundInProgress ? "Yes" : "No"}
            />
          </section>
          <footer className="border-t border-[var(--border-subtle)] px-6 py-4 text-center text-xs text-[var(--text-muted)]">
            Powered by Lumina
          </footer>
        </article>
      </div>
    </main>
  );
}
