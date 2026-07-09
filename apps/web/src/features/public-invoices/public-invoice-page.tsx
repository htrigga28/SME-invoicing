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
      {showPaymentCallbackNotice ? (
        <Alert className="mx-auto mb-4 max-w-5xl" tone="warning">
          <p className="font-semibold">{callbackNotice?.title}</p>
          <p className="mt-1">{callbackNotice?.message}</p>
        </Alert>
      ) : null}
      <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 bg-slate-950 px-5 py-6 text-white sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 text-lg font-semibold">
                {invoice.business.businessName.slice(0, 1).toUpperCase()}
              </div>
              <h1 className="mt-4 text-2xl font-semibold">{invoice.business.businessName}</h1>
              <div className="mt-2 space-y-1 text-sm text-slate-300">
                {invoice.business.email ? <p>{invoice.business.email}</p> : null}
                {invoice.business.phone ? <p>{invoice.business.phone}</p> : null}
                {invoice.business.address ? <p>{invoice.business.address}</p> : null}
              </div>
            </div>
            <div className="rounded-lg bg-white p-4 text-slate-950 sm:min-w-72">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Balance due
              </p>
              <p className="mt-1 text-3xl font-semibold">
                {formatKoboToNaira(invoice.invoice.balanceDueKobo)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge status={invoice.invoice.status} />
                <span className="text-slate-500">Due {formatDate(invoice.invoice.dueDate)}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoBlock
                label="Invoice"
                lines={[
                  invoice.invoice.invoiceNumber,
                  `Issued ${formatDate(invoice.invoice.issueDate)}`,
                  `Due ${formatDate(invoice.invoice.dueDate)}`
                ]}
              />
              <InfoBlock
                label="Billed to"
                lines={[
                  invoice.customer.name,
                  invoice.customer.email,
                  invoice.customer.phone,
                  invoice.customer.billingAddress
                ]}
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="hidden px-4 py-3 text-right sm:table-cell">Unit</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.lineItems.map((item) => (
                    <tr key={`${item.sortOrder}-${item.description}`}>
                      <td className="px-4 py-3 font-medium text-slate-950">{item.description}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.quantity}</td>
                      <td className="hidden px-4 py-3 text-right text-slate-600 sm:table-cell">
                        {formatKoboToNaira(item.unitPriceKobo)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900">
                        {formatKoboToNaira(item.lineTotalKobo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invoice.invoice.notes ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-sm font-semibold text-slate-950">Notes</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {invoice.invoice.notes}
                </p>
              </div>
            ) : null}
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-lg font-semibold text-slate-950">Summary</h2>
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

            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
              <h2 className="text-lg font-semibold text-slate-950">Payment</h2>
              {invoice.paymentSummary.available ? (
                <Button
                  className="mt-4 w-full"
                  disabled={isInitializingPayment}
                  isLoading={isInitializingPayment}
                  loadingLabel="Redirecting..."
                  onClick={() => void handlePayOnline()}
                  type="button"
                >
                  Pay {formatKoboToNaira(invoice.paymentSummary.amountKobo)} online
                </Button>
              ) : showUnavailablePaymentButton ? (
                <Button className="mt-4 w-full" disabled type="button" variant="outline">
                  Pay online unavailable
                </Button>
              ) : null}
              <p className="mt-3 text-sm text-slate-700">{invoice.paymentSummary.message}</p>
              {invoice.paymentSummary.available ? (
                <p className="mt-2 text-xs text-slate-600">
                  You will be redirected to Paystack to complete payment.
                </p>
              ) : null}
              {paymentError ? <p className="mt-3 text-sm text-red-700">{paymentError}</p> : null}
            </div>

            <p className="rounded-lg border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
              This invoice was generated by SME Invoicing. Confirm details with the business before
              payment.
            </p>
          </aside>
        </section>
      </article>

      <footer className="py-6 text-center text-xs text-slate-500">Powered by SME Invoicing</footer>
    </PublicInvoiceShell>
  );
}

function PublicInvoiceShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--text-primary)] print:bg-white print:text-slate-950 sm:px-6 lg:px-8">
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
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm">{message}</p>
    </Alert>
  );
}

function InfoBlock({ label, lines }: { label: string; lines: Array<string | null | undefined> }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</h2>
      <div className="mt-3 space-y-1 text-sm text-slate-700">
        {lines.filter(Boolean).map((line) => (
          <p className="whitespace-pre-wrap break-words" key={line}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function SummaryRow({ label, strong, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "text-base font-semibold" : ""}`}>
      <dt className="text-slate-600">{label}</dt>
      <dd className="text-slate-950">{value}</dd>
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
