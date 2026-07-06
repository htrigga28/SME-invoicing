"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { clearStoredSession } from "@/features/auth/session";
import { InvoiceStatusBadge } from "@/features/invoices/invoice-ui";
import { isApiRequestError } from "@/lib/api";

import { createPaymentRefund, getPayment } from "./payments-api";
import {
  AttemptStateBadge,
  formatDateTime,
  formatMoney,
  formatSettlementAccount,
  PageHeader,
  ReconciliationBadge,
  RetryButton,
  StatusPanel
} from "./payment-ui";
import type { PaymentDetailResponse } from "./types";

type LoadState = "loading" | "ready" | "error";

export function PaymentDetailPage({ paymentId }: { paymentId: string }) {
  return (
    <AppShell>
      {({ accessToken, me }) => (
        <PaymentDetailContent
          accessToken={accessToken}
          paymentId={paymentId}
          role={me.membership.role}
        />
      )}
    </AppShell>
  );
}

export function PaymentDetailContent({
  accessToken,
  paymentId,
  role
}: {
  accessToken: string;
  paymentId: string;
  role: "admin" | "owner" | "accountant" | "viewer";
}) {
  const [response, setResponse] = useState<PaymentDetailResponse | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);

  useEffect(() => {
    void loadPayment();
  }, [accessToken, paymentId]);

  async function loadPayment() {
    setState("loading");
    setError(null);

    try {
      setResponse(await getPayment(accessToken, paymentId));
      setState("ready");
    } catch (loadError) {
      if (isApiRequestError(loadError) && loadError.status === 401) {
        clearStoredSession();
        window.location.assign("/login");
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Could not load payment.");
      setState("error");
    }
  }

  function handleAuthError(apiError: unknown) {
    if (isApiRequestError(apiError) && apiError.status === 401) {
      clearStoredSession();
      window.location.assign("/login");
    }
  }

  async function handleRefundExcess() {
    if (!response?.financialSummary?.overpaymentKobo || !refundReason.trim()) {
      setError("A refund reason is required.");
      return;
    }

    setIsRefunding(true);
    setError(null);

    try {
      await createPaymentRefund(accessToken, paymentId, {
        amountKobo: response.financialSummary.overpaymentKobo,
        reason: refundReason.trim()
      });
      toast.success("Refund request sent to Paystack.", { id: "payment-refund-created" });
      setRefundDialogOpen(false);
      setRefundReason("");
      await loadPayment();
    } catch (refundError) {
      handleAuthError(refundError);
      const message =
        refundError instanceof Error ? refundError.message : "Could not initiate refund.";
      setError(message);
      toast.error(message, { id: "payment-refund-error" });
    } finally {
      setIsRefunding(false);
    }
  }

  if (state === "loading") {
    return (
      <section className="space-y-5">
        <PageHeader
          description="Inspect payment reference matching and safe event history."
          title="Payment detail"
        />
        <StatusPanel message="Loading payment..." />
      </section>
    );
  }

  if (state === "error" || !response) {
    return (
      <section className="space-y-5">
        <PageHeader
          description="Inspect payment reference matching and safe event history."
          title="Payment detail"
        />
        <StatusPanel
          action={<RetryButton onClick={() => void loadPayment()} />}
          message={error ?? "Payment could not be loaded."}
          tone="error"
        />
      </section>
    );
  }

  const {
    customer,
    events,
    financialSummary,
    invoice,
    payment,
    refunds,
    settlementAccount,
    settlementAccountContext
  } = response;
  const canRefundOverpayment =
    (role === "owner" || role === "admin") &&
    payment.status === "successful" &&
    Boolean(financialSummary?.hasOverpayment);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          description="Inspect payment reference matching and safe event history."
          title={payment.providerReference}
        />
        <Link
          className="self-start rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          href="/payments"
        >
          Back to payments
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap gap-2">
            <AttemptStateBadge state={payment.attemptState} />
            {shouldShowDetailReconciliation(payment) ? (
              <ReconciliationBadge state={payment.reconciliationState} />
            ) : null}
          </div>
          <StatusPanel
            message={getAttemptLifecycleCopy(payment)}
            tone={getAttemptPanelTone(payment)}
          />
          {payment.reviewDetails ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Review details</p>
              <p className="mt-1">
                Expected: {formatReviewAmount(payment.reviewDetails.expectedAmountKobo)} · Received:{" "}
                {formatReviewAmount(payment.reviewDetails.receivedAmountKobo)}
              </p>
            </div>
          ) : null}
          {financialSummary?.hasOverpayment ? (
            <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
              <p className="font-semibold">Overpayment detected</p>
              <p className="mt-1">
                Customer payments exceed the invoice total by{" "}
                {formatMoney(financialSummary.overpaymentKobo)}.
              </p>
              {canRefundOverpayment ? (
                <button
                  className="mt-3 rounded-md bg-orange-800 px-3 py-2 text-sm font-semibold text-white"
                  onClick={() => setRefundDialogOpen(true)}
                  type="button"
                >
                  Resolve overpayment
                </button>
              ) : null}
            </div>
          ) : null}
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <DetailItem label="Amount" value={formatMoney(payment.amountKobo)} />
            <DetailItem label="Provider" value={payment.provider} />
            <DetailItem label="Paystack status" value={payment.status.replaceAll("_", " ")} />
            <DetailItem label="Channel" value={payment.channel ?? "Not recorded"} />
            <DetailItem
              label="Gateway response"
              value={payment.gatewayResponse ?? "Not recorded"}
            />
            <DetailItem label="Initialized" value={formatDateTime(payment.initializedAt)} />
            <DetailItem label="Paid" value={formatDateTime(payment.paidAt)} />
            <DetailItem label="Failed" value={formatDateTime(payment.failedAt)} />
            <DetailItem label="Abandoned" value={formatDateTime(payment.abandonedAt)} />
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Settlement account used</h2>
          <p className="mt-2 text-sm font-medium text-slate-900">
            {formatSettlementAccount(settlementAccount)}
          </p>
          {settlementAccountContext ? (
            <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {settlementAccountContext.isCurrentActiveAccount
                ? "Current payout account"
                : "Historical account"}
            </span>
          ) : null}
          {settlementAccount ? (
            <dl className="mt-4 space-y-3">
              <DetailItem label="Account name" value={settlementAccount.accountName} />
              <DetailItem
                label="Current account context"
                value={
                  settlementAccountContext?.isCurrentActiveAccount
                    ? "Active"
                    : "Historical payout account"
                }
              />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-amber-800">
              No matching stored payout account was found for this payment.
            </p>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Linked invoice</h2>
          {invoice ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <Link className="font-medium text-teal-800" href={`/invoices/${invoice.id}`}>
                  {invoice.invoiceNumber}
                </Link>
                <InvoiceStatusBadge status={invoice.status} />
              </div>
              <DetailItem label="Total" value={formatMoney(invoice.totalKobo)} />
              <DetailItem
                label="Received"
                value={formatMoney(financialSummary?.netReceivedKobo ?? invoice.amountPaidKobo)}
              />
              <DetailItem
                label="Balance"
                value={formatMoney(financialSummary?.balanceDueKobo ?? invoice.balanceDueKobo)}
              />
              {financialSummary?.hasOverpayment ? (
                <DetailItem
                  label="Overpayment"
                  value={formatMoney(financialSummary.overpaymentKobo)}
                />
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No invoice is linked to this payment.</p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Linked customer</h2>
          {customer ? (
            <div className="mt-4 space-y-3 text-sm">
              <Link className="font-medium text-teal-800" href={`/customers/${customer.id}`}>
                {customer.name}
              </Link>
              <DetailItem label="Email" value={customer.email} />
              <DetailItem label="Phone" value={customer.phone ?? "Not provided"} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No customer is linked to this payment.</p>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Event timeline</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No webhook events are linked yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {events.map((event) => (
              <article className="py-3 text-sm" key={event.id}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">{event.eventType}</p>
                    <p className="text-slate-600">
                      {event.processed ? "Processed" : "Unprocessed"} •{" "}
                      {event.providerReference ?? "No reference"}
                    </p>
                  </div>
                  <span className="text-slate-500">{formatDateTime(event.createdAt)}</span>
                </div>
                {event.errorMessage ? (
                  <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900">
                    {event.errorMessage}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <StatusPanel message={response.receiptPlaceholder} />

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Refunds</h2>
        {refunds.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No refunds are linked to this payment.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {refunds.map((refund) => (
              <article className="py-3 text-sm" key={refund.id}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">{formatMoney(refund.amountKobo)}</p>
                    <p className="text-slate-600">
                      {refund.status.replaceAll("_", " ")} • {refund.reason}
                    </p>
                  </div>
                  <span className="text-slate-500">{formatDateTime(refund.createdAt)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        confirmLabel="Refund excess"
        description={`Paystack will process a refund for ${formatMoney(financialSummary?.overpaymentKobo ?? 0)}. Invoice paid totals will update only after Paystack confirms the refund is processed.`}
        isLoading={isRefunding}
        loadingLabel="Sending refund..."
        onCancel={() => setRefundDialogOpen(false)}
        onConfirm={() => void handleRefundExcess()}
        open={refundDialogOpen}
        title="Resolve overpayment"
      >
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Reason</span>
          <textarea
            className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
            onChange={(event) => setRefundReason(event.target.value)}
            placeholder="Duplicate customer payment"
            value={refundReason}
          />
        </label>
      </ConfirmDialog>
    </section>
  );
}

function getAttemptLifecycleCopy(payment: PaymentDetailResponse["payment"]) {
  if (payment.attemptState === "superseded") {
    return (
      payment.supersededReason ??
      "This checkout attempt is kept for audit history but no longer affects the invoice balance."
    );
  }

  if (payment.attemptState === "failed_attempt") {
    return "This was a failed checkout attempt. It does not affect the invoice balance.";
  }

  if (payment.attemptState === "abandoned_attempt") {
    return "This was an abandoned checkout attempt. It does not affect the invoice balance.";
  }

  if (payment.attemptState === "active_pending") {
    return "Waiting for Paystack webhook confirmation.";
  }

  if (payment.attemptState === "stale_pending") {
    return "This payment attempt has not received confirmation and may have been abandoned.";
  }

  if (payment.attemptState === "review_required") {
    return payment.reviewReason ?? "This payment attempt needs manual reconciliation review.";
  }

  if (payment.attemptState === "successful") {
    return "This payment has been matched to the linked invoice.";
  }

  return "This payment attempt is kept for audit history.";
}

function getAttemptPanelTone(payment: PaymentDetailResponse["payment"]) {
  if (payment.attemptState === "review_required" || payment.attemptState === "stale_pending") {
    return "warning" as const;
  }

  return "info" as const;
}

function shouldShowDetailReconciliation(payment: PaymentDetailResponse["payment"]) {
  return [
    "matched",
    "overpaid",
    "resolution_in_progress",
    "resolved",
    "review_required",
    "superseded"
  ].includes(payment.reconciliationState);
}

function formatReviewAmount(value: number | null) {
  return value === null ? "Not recorded" : formatMoney(value);
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-900">{value}</dd>
    </div>
  );
}
