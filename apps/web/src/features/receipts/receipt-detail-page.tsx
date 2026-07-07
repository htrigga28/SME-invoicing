"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { clearStoredSession } from "@/features/auth/session";
import { isApiRequestError } from "@/lib/api";

import { getReceipt } from "./receipts-api";
import {
  DetailItem,
  formatDateTime,
  formatMoney,
  PageHeader,
  RefundStateBadge,
  RetryButton,
  StatusPanel
} from "./receipt-ui";
import type { ReceiptDetailResponse } from "./types";

type LoadState = "loading" | "ready" | "error";

export function ReceiptDetailPage({ receiptId }: { receiptId: string }) {
  return (
    <AppShell>
      {({ accessToken }) => (
        <ReceiptDetailContent accessToken={accessToken} receiptId={receiptId} />
      )}
    </AppShell>
  );
}

export function ReceiptDetailContent({
  accessToken,
  receiptId
}: {
  accessToken: string;
  receiptId: string;
}) {
  const [response, setResponse] = useState<ReceiptDetailResponse | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadReceipt();
  }, [accessToken, receiptId]);

  async function loadReceipt() {
    setState("loading");
    setError(null);

    try {
      setResponse(await getReceipt(accessToken, receiptId));
      setState("ready");
    } catch (loadError) {
      if (isApiRequestError(loadError) && loadError.status === 401) {
        clearStoredSession();
        window.location.assign("/login");
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Could not load receipt.");
      setState("error");
    }
  }

  async function copyPublicUrl() {
    const publicUrl = response?.receipt.publicUrl;

    if (!publicUrl) {
      return;
    }

    await navigator.clipboard.writeText(publicUrl);
    toast.success("Public receipt link copied.");
  }

  if (state === "loading") {
    return (
      <section className="space-y-5">
        <PageHeader
          description="View receipt details generated from a successful payment."
          title="Receipt detail"
        />
        <StatusPanel message="Loading receipt..." />
      </section>
    );
  }

  if (state === "error" || !response) {
    return (
      <section className="space-y-5">
        <PageHeader
          description="View receipt details generated from a successful payment."
          title="Receipt detail"
        />
        <StatusPanel
          action={<RetryButton onClick={() => void loadReceipt()} />}
          message={error ?? "Receipt could not be loaded."}
          tone="error"
        />
      </section>
    );
  }

  const { receipt } = response;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          description="Receipts are immutable payment records. Refund information is shown as a derived summary."
          title={receipt.receiptNumber}
        />
        <Link
          className="self-start rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 print:hidden"
          href="/receipts"
        >
          Back to receipts
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-3xl font-semibold text-slate-950">
              {formatMoney(receipt.amountKobo)}
            </p>
            <RefundStateBadge state={receipt.refundSummary.refundState} />
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <DetailItem label="Payment reference" value={receipt.paymentReference} />
            <DetailItem label="Payment provider" value={receipt.paymentProvider} />
            <DetailItem label="Payment channel" value={receipt.paymentChannel ?? "Not recorded"} />
            <DetailItem label="Paid" value={formatDateTime(receipt.paidAt)} />
            <DetailItem label="Issued" value={formatDateTime(receipt.issuedAt)} />
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
          </dl>
        </section>

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Public receipt</h2>
          <p className="mt-2 break-all text-sm text-slate-600">{receipt.publicUrl}</p>
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            <button
              className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white"
              onClick={() => void copyPublicUrl()}
              type="button"
            >
              Copy public link
            </button>
            {receipt.publicUrl ? (
              <Link
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                href={receipt.publicUrl}
                target="_blank"
              >
                Open public receipt
              </Link>
            ) : null}
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              onClick={() => window.print()}
              type="button"
            >
              Print receipt
            </button>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Business</h2>
          <dl className="mt-4 space-y-3">
            <DetailItem label="Name" value={receipt.business.name} />
            <DetailItem label="Email" value={receipt.business.email ?? "Not provided"} />
            <DetailItem label="Phone" value={receipt.business.phone ?? "Not provided"} />
            <DetailItem label="Address" value={receipt.business.address ?? "Not provided"} />
          </dl>
        </section>

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Customer</h2>
          <dl className="mt-4 space-y-3">
            <DetailItem
              label="Name"
              value={
                receipt.customer.id ? (
                  <Link
                    className="font-medium text-teal-800 [overflow-wrap:anywhere]"
                    href={`/customers/${receipt.customer.id}`}
                  >
                    {receipt.customer.name}
                  </Link>
                ) : (
                  receipt.customer.name
                )
              }
            />
            <DetailItem label="Email" value={receipt.customer.email} />
            <DetailItem label="Phone" value={receipt.customer.phone ?? "Not provided"} />
            <DetailItem
              label="Billing address"
              value={receipt.customer.billingAddress ?? "Not provided"}
            />
          </dl>
        </section>

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Links</h2>
          <dl className="mt-4 space-y-3">
            <DetailItem
              label="Invoice"
              value={
                receipt.invoice.id ? (
                  <Link
                    className="font-medium text-teal-800 [overflow-wrap:anywhere]"
                    href={`/invoices/${receipt.invoice.id}`}
                  >
                    {receipt.invoice.invoiceNumber}
                  </Link>
                ) : (
                  receipt.invoice.invoiceNumber
                )
              }
            />
            <DetailItem
              label="Payment"
              value={
                receipt.payment.id ? (
                  <Link
                    className="font-medium text-teal-800 [overflow-wrap:anywhere]"
                    href={`/payments/${receipt.payment.id}`}
                  >
                    {receipt.payment.providerReference}
                  </Link>
                ) : (
                  receipt.payment.providerReference
                )
              }
            />
          </dl>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Refund history</h2>
        {!receipt.refunds || receipt.refunds.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No refunds are linked to this receipt.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {receipt.refunds.map((refund) => (
              <article className="py-3 text-sm" key={refund.id}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">{formatMoney(refund.amountKobo)}</p>
                    <p className="text-slate-600">
                      {refund.status.replaceAll("_", " ")} • {refund.reason}
                    </p>
                  </div>
                  <span className="text-slate-500">
                    {formatDateTime(refund.processedAt ?? refund.createdAt)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
