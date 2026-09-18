"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  INVOICE_STATUS_LABELS,
  formatKoboToNaira,
  type InvoiceStatus
} from "@sme-invoicing/shared";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { StatusBadge as SharedStatusBadge } from "@/components/ui/status-badge";
import { InvoiceDocument } from "@/features/invoices/invoice-document";
import { isApiRequestError } from "@/lib/api";

import {
  getPublicInvoice,
  initializePublicInvoicePayment,
  markPublicInvoiceViewed,
  verifyPublicInvoicePayment
} from "./public-invoices-api";
import type { PublicInvoiceResponse } from "./types";

type LoadState = "loading" | "ready" | "error";
type PaymentConfirmationState = {
  message: string;
  status: "confirming" | "failed" | "pending" | "successful";
} | null;

const PAYMENT_CALLBACK_POLL_INTERVAL_MS = 3000;
const PAYMENT_CALLBACK_POLL_LIMIT = 10;

export function PublicInvoicePage({
  paymentCallback = false,
  paymentReference,
  token
}: {
  paymentCallback?: boolean;
  paymentReference?: string;
  token: string;
}) {
  const [invoice, setInvoice] = useState<PublicInvoiceResponse | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentConfirmation, setPaymentConfirmation] = useState<PaymentConfirmationState>(null);
  const [isInitializingPayment, setIsInitializingPayment] = useState(false);
  const verificationStartedRef = useRef(false);
  const viewTrackedRef = useRef(false);

  useEffect(() => {
    async function loadInvoice() {
      setState("loading");
      setError(null);
      viewTrackedRef.current = false;
      verificationStartedRef.current = false;
      setPaymentConfirmation(null);

      try {
        const response = await getPublicInvoice(token);
        setInvoice(response);
        setState("ready");
      } catch (loadError) {
        setError(
          isApiRequestError(loadError) && loadError.status === 404
            ? "This invoice link is unavailable. Please confirm the invoice details with the business."
            : "This invoice could not be loaded. Please try again later."
        );
        setState("error");
      }
    }

    void loadInvoice();
  }, [token]);

  useEffect(() => {
    if (
      !paymentCallback ||
      !paymentReference ||
      state !== "ready" ||
      verificationStartedRef.current
    ) {
      return;
    }

    let cancelled = false;
    verificationStartedRef.current = true;
    setPaymentConfirmation({
      status: "confirming",
      message: "Confirming payment with Paystack..."
    });

    void verifyPublicInvoicePayment(token, paymentReference)
      .then(async (verification) => {
        if (cancelled) {
          return;
        }

        const refreshedInvoice = await getPublicInvoice(token);

        if (cancelled) {
          return;
        }

        setInvoice(refreshedInvoice);

        if (verification.status === "successful") {
          setPaymentConfirmation({
            status: "successful",
            message: verification.invoiceUpdated
              ? "Payment confirmed. The invoice balance has been updated."
              : "Payment was already confirmed. The invoice has been refreshed."
          });
        } else if (verification.status === "pending") {
          setPaymentConfirmation({
            status: "pending",
            message:
              "Payment confirmation is still pending. This invoice will update after confirmation."
          });
        } else {
          setPaymentConfirmation({
            status: "failed",
            message: "Paystack did not confirm a successful payment for this checkout attempt."
          });
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setPaymentConfirmation({
          status: "pending",
          message:
            "Payment confirmation is still pending. If you completed payment, this invoice will update after Paystack confirms it."
        });
      });

    return () => {
      cancelled = true;
    };
  }, [paymentCallback, paymentReference, state, token]);

  useEffect(() => {
    if (
      paymentReference ||
      !paymentCallback ||
      state !== "ready" ||
      !invoice?.paymentSummary.available
    ) {
      return;
    }

    let pollCount = 0;
    let cancelled = false;

    const intervalId = window.setInterval(() => {
      pollCount += 1;

      if (pollCount > PAYMENT_CALLBACK_POLL_LIMIT) {
        window.clearInterval(intervalId);
        return;
      }

      void getPublicInvoice(token)
        .then((response) => {
          if (cancelled) {
            return;
          }

          setInvoice(response);

          if (!response.paymentSummary.available) {
            window.clearInterval(intervalId);
          }
        })
        .catch(() => undefined);
    }, PAYMENT_CALLBACK_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [invoice?.paymentSummary.available, paymentCallback, state, token]);

  useEffect(() => {
    if (state !== "ready" || viewTrackedRef.current) {
      return;
    }

    viewTrackedRef.current = true;
    void markPublicInvoiceViewed(token).catch(() => undefined);
  }, [state, token]);

  async function handlePayOnline() {
    setPaymentError(null);
    setIsInitializingPayment(true);

    try {
      const payment = await initializePublicInvoicePayment(token);
      window.location.assign(payment.authorizationUrl);
    } catch (apiError) {
      setPaymentError(
        isApiRequestError(apiError)
          ? apiError.message
          : "Payment could not be started. Please try again or contact the business."
      );
      setIsInitializingPayment(false);
    }
  }

  if (state === "loading") {
    return (
      <PublicInvoiceShell>
        <StatusPanel message="Loading invoice..." />
      </PublicInvoiceShell>
    );
  }

  if (state === "error" || !invoice) {
    return (
      <PublicInvoiceShell>
        <StatusPanel
          message={error ?? "This invoice link is unavailable."}
          title="Invoice unavailable"
          tone="error"
        />
      </PublicInvoiceShell>
    );
  }

  const callbackNotice =
    paymentReference || invoice.paymentSummary.available || paymentConfirmation
      ? getCallbackNotice(paymentCallback, paymentConfirmation, paymentReference)
      : null;
  const showPaymentCallbackNotice = Boolean(callbackNotice);
  const showUnavailablePaymentButton =
    !invoice.paymentSummary.available && invoice.paymentSummary.reason !== "no_outstanding_balance";

  return (
    <PublicInvoiceShell>
      <div className="mx-auto w-full max-w-5xl">
        {showPaymentCallbackNotice ? (
          <Alert
            className="mb-4"
            tone={callbackNotice?.title === "Payment confirmed" ? "success" : "warning"}
          >
            <p className="font-semibold text-[var(--text-primary)]">{callbackNotice?.title}</p>
            <p className="mt-1">{callbackNotice?.message}</p>
          </Alert>
        ) : null}

        <header className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-document)] sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <div
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent-muted)] text-lg font-semibold text-[var(--accent)]"
                >
                  {invoice.business.businessName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Invoice from
                  </p>
                  <h1 className="mt-1 break-words text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                    {invoice.business.businessName}
                  </h1>
                  <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">
                    {invoice.invoice.invoiceNumber}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-0.5 text-sm text-[var(--text-secondary)]">
                {invoice.business.email ? (
                  <p className="break-words">{invoice.business.email}</p>
                ) : null}
                {invoice.business.phone ? <p>{invoice.business.phone}</p> : null}
                {invoice.business.address ? (
                  <p className="whitespace-pre-wrap break-words">{invoice.business.address}</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 sm:min-w-72 sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Amount due
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">
                {formatKoboToNaira(invoice.invoice.balanceDueKobo)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 sm:justify-end">
                <StatusBadge status={invoice.invoice.status} />
                <span className="text-sm text-[var(--text-secondary)]">
                  Due {formatDate(invoice.invoice.dueDate)}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="order-2 min-w-0 lg:order-1">
            <InvoiceDocument
              balanceDueKobo={invoice.invoice.balanceDueKobo}
              business={invoice.business}
              customer={invoice.customer}
              customerMemo={invoice.invoice.notes}
              customerReference={invoice.invoice.customerReference}
              discountKobo={invoice.invoice.discountKobo}
              dueDate={invoice.invoice.dueDate}
              invoiceNumber={invoice.invoice.invoiceNumber}
              issueDate={invoice.invoice.issueDate}
              lineItems={invoice.lineItems}
              status={invoice.invoice.status}
              subtotalKobo={invoice.invoice.subtotalKobo}
              taxKobo={invoice.invoice.taxKobo}
              totalKobo={invoice.invoice.totalKobo}
            />
          </div>

          <aside className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-6">
            <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-document)]">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Summary</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <SummaryRow
                  label="Subtotal"
                  value={formatKoboToNaira(invoice.invoice.subtotalKobo)}
                />
                <SummaryRow
                  label="Discount"
                  value={formatKoboToNaira(invoice.invoice.discountKobo)}
                />
                <SummaryRow label="Tax" value={formatKoboToNaira(invoice.invoice.taxKobo)} />
                <SummaryRow
                  label="Total"
                  strong
                  value={formatKoboToNaira(invoice.invoice.totalKobo)}
                />
                <SummaryRow
                  label="Amount paid"
                  value={formatKoboToNaira(invoice.invoice.amountPaidKobo)}
                />
                <SummaryRow
                  label="Balance due"
                  strong
                  value={formatKoboToNaira(invoice.invoice.balanceDueKobo)}
                />
              </dl>
            </div>

            <div
              className="rounded-[var(--radius-card)] border border-[var(--accent-border)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-document)]"
              id="public-invoice-payment"
            >
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Payment</h2>
              {invoice.paymentSummary.available ? (
                <Button
                  className="mt-4 w-full"
                  disabled={isInitializingPayment}
                  isLoading={isInitializingPayment}
                  loadingLabel="Redirecting..."
                  onClick={() => void handlePayOnline()}
                  size="lg"
                  type="button"
                >
                  Pay {formatKoboToNaira(invoice.paymentSummary.amountKobo)} online
                </Button>
              ) : showUnavailablePaymentButton ? (
                <Button className="mt-4 w-full" disabled size="lg" type="button" variant="outline">
                  Pay online unavailable
                </Button>
              ) : null}
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                {invoice.paymentSummary.message}
              </p>
              {invoice.paymentSummary.available ? (
                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                  You will be redirected to Paystack to complete payment.
                </p>
              ) : null}
              {paymentError ? (
                <p className="mt-3 text-sm leading-6 text-[var(--danger)]" role="alert">
                  {paymentError}
                </p>
              ) : null}
            </div>

            <p className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-xs leading-5 text-[var(--text-muted)]">
              This invoice was generated by Lumina. Confirm details with the business before
              payment.
            </p>
          </aside>
        </div>

        <footer className="py-6 text-center text-xs text-[var(--text-muted)]">
          Powered by Lumina
        </footer>
      </div>
    </PublicInvoiceShell>
  );
}

function PublicInvoiceShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--canvas-warm)] px-4 py-8 text-[var(--text-primary)] print:bg-white sm:px-6 lg:px-8">
      {children}
    </main>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return <SharedStatusBadge status={status}>{INVOICE_STATUS_LABELS[status]}</SharedStatusBadge>;
}

function getCallbackNotice(
  paymentCallback: boolean,
  paymentConfirmation: PaymentConfirmationState,
  paymentReference?: string
) {
  if (!paymentCallback) {
    return null;
  }

  if (!paymentReference) {
    return {
      title: "Payment confirmation pending",
      message:
        "If you completed payment, this invoice will update after Paystack confirms the transaction."
    };
  }

  if (!paymentConfirmation) {
    return {
      title: "Confirming payment",
      message: "Confirming payment with Paystack..."
    };
  }

  if (paymentConfirmation.status === "successful") {
    return {
      title: "Payment confirmed",
      message: paymentConfirmation.message
    };
  }

  if (paymentConfirmation.status === "failed") {
    return {
      title: "Payment not confirmed",
      message: paymentConfirmation.message
    };
  }

  return {
    title: "Payment confirmation pending",
    message: paymentConfirmation.message
  };
}

function StatusPanel({
  message,
  title = "Invoice",
  tone = "info"
}: {
  message: string;
  title?: string;
  tone?: "error" | "info";
}) {
  return (
    <Alert className="mx-auto max-w-2xl" tone={tone === "error" ? "error" : "info"}>
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{title}</h1>
      <p className="mt-3 text-sm">{message}</p>
    </Alert>
  );
}

function SummaryRow({ label, strong, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "text-base font-semibold" : ""}`}>
      <dt className="text-[var(--text-secondary)]">{label}</dt>
      <dd className="tabular-nums text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00.000Z`));
}
