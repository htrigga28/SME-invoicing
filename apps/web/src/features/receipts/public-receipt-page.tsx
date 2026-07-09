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
      <main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--text-primary)]">
        <div className="mx-auto max-w-3xl">
          <StatusPanel message="Loading receipt..." />
        </div>
      </main>
    );
  }

  if (state === "error" || !response) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--text-primary)]">
        <div className="mx-auto max-w-3xl">
          <StatusPanel message={error ?? "Receipt could not be loaded."} tone="error" />
        </div>
      </main>
    );
  }

  const { receipt } = response;

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--text-primary)] print:bg-white print:p-0 print:text-slate-950">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex justify-end print:hidden">
          <Button onClick={() => window.print()} type="button">
            Print receipt
          </Button>
        </div>

        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
          <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Receipt
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                {receipt.receiptNumber}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Issued {formatDateTime(receipt.issuedAt)}
              </p>
              <p className="mt-3 text-sm font-medium text-emerald-700">
                Payment confirmed through Paystack.
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-3xl font-semibold text-slate-950">
                {formatMoney(receipt.amountKobo)}
              </p>
              <div className="mt-2">
                <RefundStateBadge state={receipt.refundSummary.refundState} />
              </div>
            </div>
          </header>

          <section className="grid gap-6 border-b border-slate-200 py-6 sm:grid-cols-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">From</h2>
              <p className="mt-2 font-semibold text-slate-950">{receipt.business.name}</p>
              <p className="mt-1 text-sm text-slate-600">{receipt.business.email}</p>
              <p className="text-sm text-slate-600">{receipt.business.phone}</p>
              <p className="mt-2 text-sm text-slate-600">{receipt.business.address}</p>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">To</h2>
              <p className="mt-2 font-semibold text-slate-950">{receipt.customer.name}</p>
              <p className="mt-1 text-sm text-slate-600">{receipt.customer.email}</p>
              <p className="text-sm text-slate-600">{receipt.customer.phone}</p>
              <p className="mt-2 text-sm text-slate-600">{receipt.customer.billingAddress}</p>
            </div>
          </section>

          <section className="grid gap-4 py-6 sm:grid-cols-2">
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
          <footer className="border-t border-slate-200 pt-5 text-center text-xs text-slate-500">
            Powered by SME Invoicing
          </footer>
        </article>
      </div>
    </main>
  );
}
