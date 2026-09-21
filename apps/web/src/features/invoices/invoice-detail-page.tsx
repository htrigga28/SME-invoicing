"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SectionCard } from "@/components/ui/card";
import { DropdownMenu } from "@/components/ui/menu";
import { clearStoredSession } from "@/features/auth/session";
import {
  formatDateTime as formatPaymentDateTime,
  formatSettlementAccount,
  PaymentStatusBadge,
  ReconciliationBadge
} from "@/features/payments/payment-ui";
import { isApiRequestError } from "@/lib/api";

import {
  cancelInvoice,
  duplicateInvoice,
  getInvoice,
  getInvoiceActivity,
  resendInvoiceEmail,
  retryInvoiceEmailAttempt,
  sendInvoice,
  voidInvoice,
  type SendInvoiceEmailInput
} from "./invoices-api";
import { DeliveryBadge, InvoiceActivityTimeline } from "./invoice-activity";
import { InvoiceDocument } from "./invoice-document";
import { formatDate, formatMoney, InvoiceStatusBadge, StatusPanel } from "./invoice-ui";
import { SendInvoiceDialog } from "./send-invoice-dialog";
import type { DeliverySummary, InvoiceActivityItem, InvoiceDetailResponse } from "./types";
import { canCancelOrVoidInvoices, canManageInvoices } from "./types";

type LoadState = "loading" | "ready" | "error";
type DialogAction = "cancel" | "void" | null;
type SendDialogMode = "send" | "resend" | null;

type DeliveryNotice = {
  message: string;
  showCopyLink: boolean;
  showResend: boolean;
  showRetry: boolean;
};

export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  return (
    <AppShell>
      {({ accessToken, me }) => (
        <InvoiceDetailContent
          accessToken={accessToken}
          invoiceId={invoiceId}
          role={me.membership.role}
        />
      )}
    </AppShell>
  );
}

export function InvoiceDetailContent({
  accessToken,
  invoiceId,
  role
}: {
  accessToken: string;
  invoiceId: string;
  role: "owner" | "admin" | "accountant" | "viewer";
}) {
  const [response, setResponse] = useState<InvoiceDetailResponse | null>(null);
  const [activity, setActivity] = useState<InvoiceActivityItem[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deliveryNotice, setDeliveryNotice] = useState<DeliveryNotice | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [dialogAction, setDialogAction] = useState<DialogAction>(null);
  const [sendDialogMode, setSendDialogMode] = useState<SendDialogMode>(null);
  const [sendDialogError, setSendDialogError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isMutating, setIsMutating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const router = useRouter();
  const invoice = response?.invoice;
  const canManage = canManageInvoices(role);
  const canCancelVoid = canCancelOrVoidInvoices(role);

  useEffect(() => {
    void loadInvoice();
  }, [accessToken, invoiceId]);

  useEffect(() => {
    if (state !== "ready" || !invoice || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    if (params.get("send") === "1" && canManage && invoice.status === "draft") {
      params.delete("send");
      const nextQuery = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`
      );
      setSendDialogMode("send");
    }
  }, [state, invoice, canManage]);

  async function loadInvoice() {
    setState("loading");
    setError(null);

    try {
      const nextResponse = await getInvoice(accessToken, invoiceId);
      setResponse(nextResponse);
      setState("ready");
      void loadActivity();
    } catch (loadError) {
      handleAuthError(loadError);
      setError(loadError instanceof Error ? loadError.message : "Could not load invoice.");
      setState("error");
    }
  }

  async function loadActivity() {
    setActivityError(null);

    try {
      const activityResponse = await getInvoiceActivity(accessToken, invoiceId);
      setActivity(activityResponse.activity);
    } catch (activityLoadError) {
      handleAuthError(activityLoadError);
      setActivityError(
        activityLoadError instanceof Error ? activityLoadError.message : "Could not load activity."
      );
    }
  }

  async function handleConfirmAction() {
    if (!invoice || !dialogAction) {
      return;
    }

    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }

    setIsMutating(true);
    setError(null);
    setSuccess(null);
    setDeliveryNotice(null);

    try {
      const nextResponse =
        dialogAction === "cancel"
          ? await cancelInvoice(accessToken, invoice.id, reason.trim())
          : await voidInvoice(accessToken, invoice.id, reason.trim());
      setResponse(nextResponse);
      setSuccess(dialogAction === "cancel" ? "Invoice cancelled." : "Invoice voided.");
      setDialogAction(null);
      setReason("");
      void loadActivity();
    } catch (actionError) {
      handleAuthError(actionError);
      setError(actionError instanceof Error ? actionError.message : "Could not update invoice.");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleSendSubmit(input: SendInvoiceEmailInput) {
    if (!invoice || !sendDialogMode) {
      return;
    }

    setIsSending(true);
    setSendDialogError(null);
    setError(null);
    setSuccess(null);
    setDeliveryNotice(null);

    try {
      if (sendDialogMode === "send") {
        const nextResponse = await sendInvoice(accessToken, invoice.id, input);
        setResponse(nextResponse);
        handleDeliveryResult(nextResponse.delivery, input.to?.[0]);
      } else {
        const resendResponse = await resendInvoiceEmail(accessToken, invoice.id, input);
        setResponse((current) =>
          current ? { ...current, delivery: resendResponse.delivery } : current
        );
        handleDeliveryResult(resendResponse.delivery, input.to?.[0]);
      }

      setSendDialogMode(null);
      void loadActivity();
    } catch (submitError) {
      handleAuthError(submitError);
      setSendDialogError(
        submitError instanceof Error ? submitError.message : "Could not send the email."
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleRetryDelivery() {
    const attemptId = response?.delivery.lastCommunication?.id;

    if (!invoice || !attemptId) {
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);
    setDeliveryNotice(null);

    try {
      const retryResponse = await retryInvoiceEmailAttempt(accessToken, invoice.id, attemptId);
      setResponse((current) =>
        current ? { ...current, delivery: retryResponse.delivery } : current
      );
      handleDeliveryResult(retryResponse.delivery);
      void loadActivity();
    } catch (retryError) {
      handleAuthError(retryError);
      setError(retryError instanceof Error ? retryError.message : "Could not retry delivery.");
    } finally {
      setIsSending(false);
    }
  }

  function handleDeliveryResult(delivery: DeliverySummary, firstRecipient?: string) {
    const recipientSuffix = firstRecipient ? ` to ${firstRecipient}` : "";

    if (delivery.state === "accepted" || delivery.state === "delivered") {
      setSuccess(`Invoice emailed${recipientSuffix}.`);
      return;
    }

    setDeliveryNotice({
      message: delivery.message,
      showCopyLink: true,
      showResend: delivery.state === "failed" || delivery.state === "partially_failed",
      showRetry: delivery.state === "uncertain" && Boolean(delivery.lastCommunication)
    });
  }

  function handleAuthError(apiError: unknown) {
    if (isApiRequestError(apiError) && apiError.status === 401) {
      clearStoredSession();
      window.location.assign("/login");
    }
  }

  async function handleDuplicate() {
    if (!invoice) {
      return;
    }

    setIsDuplicating(true);
    setError(null);
    setSuccess(null);

    try {
      const duplicated = await duplicateInvoice(accessToken, invoice.id);
      setSuccess(`Duplicated as draft ${duplicated.invoice.invoiceNumber}.`);
      router.push(`/invoices/${duplicated.invoice.id}/edit`);
    } catch (duplicateError) {
      handleAuthError(duplicateError);
      setError(
        duplicateError instanceof Error ? duplicateError.message : "Could not duplicate invoice."
      );
    } finally {
      setIsDuplicating(false);
    }
  }

  async function handleCopyPublicUrl(publicUrl: string) {
    setCopySuccess(null);

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopySuccess("Public URL copied.");
    } catch {
      setCopySuccess("Copy failed. Select and copy the URL manually.");
    }
  }

  if (state === "loading") {
    return <StatusPanel message="Loading invoice..." />;
  }

  if (state === "error" || !invoice || !response) {
    return (
      <StatusPanel
        action={
          <Button onClick={() => void loadInvoice()} size="sm" type="button">
            Retry
          </Button>
        }
        message={error ?? "Could not load invoice."}
        tone="error"
      />
    );
  }

  const canEdit = canManage && invoice.status === "draft";
  const canSend = canManage && invoice.status === "draft";
  const canResend =
    canManage &&
    invoice.publicAccessEnabled &&
    ["sent", "viewed", "overdue", "partially_paid", "paid"].includes(invoice.status);
  const canCancel =
    canCancelVoid && ["draft", "sent", "viewed", "overdue"].includes(invoice.status);
  const canVoid =
    canCancelVoid && ["draft", "sent", "viewed", "overdue", "cancelled"].includes(invoice.status);
  const canDuplicate = canManage;
  const isSourceCustomerArchived = Boolean(invoice.customer.archivedAt);
  const canManagePaymentSetup = role === "owner" || role === "admin";
  const financialSummary = response.financialSummary;
  const canSharePublicUrl =
    response.publicUrl &&
    invoice.publicAccessEnabled &&
    ["sent", "viewed", "overdue", "partially_paid", "paid"].includes(invoice.status);
  const canRetryDelivery =
    canResend &&
    response.delivery.state === "uncertain" &&
    Boolean(response.delivery.lastCommunication);

  const overflowItems = [
    ...(canEdit ? [{ label: "Edit", href: `/invoices/${invoice.id}/edit` }] : []),
    ...(canRetryDelivery
      ? [
          {
            label: isSending ? "Retrying delivery…" : "Retry delivery",
            onSelect: () => void handleRetryDelivery(),
            disabled: isSending
          }
        ]
      : canResend
        ? [{ label: "Resend email", onSelect: () => setSendDialogMode("resend") }]
        : []),
    ...(canDuplicate
      ? [
          {
            label: isDuplicating ? "Duplicating…" : "Duplicate",
            onSelect: () => void handleDuplicate(),
            disabled: isDuplicating || isSourceCustomerArchived
          }
        ]
      : []),
    ...(canCancel
      ? [{ label: "Cancel invoice", onSelect: () => setDialogAction("cancel"), destructive: true }]
      : []),
    ...(canVoid
      ? [{ label: "Void invoice", onSelect: () => setDialogAction("void"), destructive: true }]
      : [])
  ];

  return (
    <section className="space-y-4">
      <Link
        href="/invoices"
        className="inline-flex text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)]"
      >
        ← Invoices
      </Link>

      {/* Document header — number / status / customer / balance / due + one primary action */}
      <header className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {invoice.invoiceNumber}
              </h1>
              <InvoiceStatusBadge status={invoice.status} />
              {invoice.status !== "draft" ? (
                <DeliveryBadge state={response.delivery.state} />
              ) : null}
            </div>
            <p className="mt-1.5 truncate text-sm text-[var(--text-secondary)]">
              {invoice.customer.name} · {invoice.customer.email}
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Balance due</p>
                <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums">
                  {formatMoney(financialSummary.balanceDueKobo)}
                </p>
              </div>
              <div className="pb-1 text-sm">
                <p className="text-[var(--text-secondary)]">
                  Total {formatMoney(invoice.totalKobo)} · Paid{" "}
                  {formatMoney(financialSummary.netReceivedKobo)}
                </p>
                <p className="mt-0.5 text-[var(--text-muted)]">
                  Due {formatDate(invoice.dueDate)}
                  {invoice.paidAt ? ` · Paid ${formatDate(invoice.paidAt)}` : " · Not paid yet"}
                </p>
                {invoice.paidAt ? (
                  <p className="sr-only">{formatDate(invoice.paidAt)}</p>
                ) : (
                  <p className="sr-only">Not paid yet</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canSend ? (
              <Button onClick={() => setSendDialogMode("send")} type="button">
                Send invoice
              </Button>
            ) : canSharePublicUrl ? (
              <Button onClick={() => void handleCopyPublicUrl(response.publicUrl!)} type="button">
                Copy public URL
              </Button>
            ) : canEdit ? (
              <Button onClick={() => router.push(`/invoices/${invoice.id}/edit`)} type="button">
                Edit draft
              </Button>
            ) : null}
            {overflowItems.length ? (
              <DropdownMenu
                label="More invoice actions"
                trigger={<span>•••</span>}
                items={overflowItems}
              />
            ) : null}
          </div>
        </div>
        {copySuccess ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{copySuccess}</p>
        ) : null}
        {canDuplicate && isSourceCustomerArchived ? (
          <p className="mt-3 rounded-[var(--radius-control)] border border-[var(--warning-border)] bg-[var(--warning-muted)] p-3 text-sm text-[var(--warning)]">
            Archived customers cannot be used for duplicated invoices. Reactivate the customer or
            choose an active customer.
          </p>
        ) : null}
      </header>

      {error ? <StatusPanel message={error} tone="error" /> : null}
      {success ? <StatusPanel message={success} tone="success" /> : null}
      {deliveryNotice ? (
        <StatusPanel
          action={
            <span className="flex flex-wrap gap-2">
              {deliveryNotice.showCopyLink && canSharePublicUrl ? (
                <Button
                  onClick={() => void handleCopyPublicUrl(response.publicUrl!)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Copy public link
                </Button>
              ) : null}
              {deliveryNotice.showResend && canResend ? (
                <Button onClick={() => setSendDialogMode("resend")} size="sm" type="button">
                  Resend email
                </Button>
              ) : null}
              {deliveryNotice.showRetry && canRetryDelivery ? (
                <Button
                  disabled={isSending}
                  onClick={() => void handleRetryDelivery()}
                  size="sm"
                  type="button"
                >
                  {isSending ? "Retrying…" : "Retry delivery"}
                </Button>
              ) : null}
            </span>
          }
          message={deliveryNotice.message}
          tone="warning"
        />
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <div className="shadow-[var(--shadow-document)]">
            <InvoiceDocument
              balanceDueKobo={financialSummary.balanceDueKobo}
              customer={{
                name: invoice.customer.name,
                email: invoice.customer.email,
                phone: invoice.customer.phone,
                billingAddress: invoice.customer.billingAddress
              }}
              customerMemo={invoice.notes || null}
              customerReference={invoice.customerReference || null}
              discountKobo={invoice.discountKobo}
              dueDate={invoice.dueDate}
              invoiceNumber={invoice.invoiceNumber}
              issueDate={invoice.issueDate}
              lineItems={response.lineItems.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPriceKobo: item.unitPriceKobo,
                lineTotalKobo: item.lineTotalKobo
              }))}
              status={invoice.status}
              subtotalKobo={invoice.subtotalKobo}
              taxKobo={invoice.taxKobo}
              totalKobo={invoice.totalKobo}
            />
          </div>

          <SectionCard>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Payments</h2>
            {financialSummary.hasOverpayment ? (
              <div className="mt-3 rounded-[var(--radius-control)] border border-[var(--warning-border)] bg-[var(--warning-muted)] p-4 text-sm text-[var(--warning)]">
                <p className="font-semibold text-[var(--text-primary)]">Overpayment detected</p>
                <p className="mt-1">
                  Customer payments exceed this invoice by{" "}
                  {formatMoney(financialSummary.overpaymentKobo)}.
                </p>
                <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                  <SummaryRow
                    label="Received"
                    value={formatMoney(financialSummary.netReceivedKobo)}
                  />
                  <SummaryRow
                    label="Invoice total"
                    value={formatMoney(response.invoice.totalKobo)}
                  />
                  <SummaryRow
                    label="Excess"
                    strong
                    value={formatMoney(financialSummary.overpaymentKobo)}
                  />
                </dl>
                {role === "owner" || role === "admin" ? (
                  <p className="mt-3 text-xs">
                    Open a successful payment detail to refund the excess through Paystack.
                  </p>
                ) : null}
              </div>
            ) : null}
            {response.payments.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                No payment records are linked to this invoice yet.
              </p>
            ) : (
              <div className="mt-2 divide-y divide-[var(--border-subtle)]">
                {response.payments.map((payment) => (
                  <article className="py-3 text-sm" key={payment.id}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <Link
                          className="font-medium text-[var(--accent)] hover:underline [overflow-wrap:anywhere]"
                          href={`/payments/${payment.id}`}
                        >
                          {payment.providerReference}
                        </Link>
                        <p className="mt-1 text-[var(--text-secondary)]">
                          {formatMoney(payment.amountKobo)} •{" "}
                          {formatSettlementAccount(payment.settlementAccount)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          {formatPaymentDateTime(payment.paidAt ?? payment.createdAt)}
                        </p>
                        {payment.receipt ? (
                          <p className="mt-2 text-xs">
                            Receipt:{" "}
                            <Link
                              className="font-medium text-[var(--accent)] hover:underline"
                              href={`/receipts/${payment.receipt.id}`}
                            >
                              {payment.receipt.receiptNumber}
                            </Link>
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <PaymentStatusBadge status={payment.status} />
                        <ReconciliationBadge state={payment.reconciliationState} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <aside className="space-y-4">
          <SectionCard>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Activity</h2>
            {activityError ? (
              <p className="mt-3 text-sm text-[var(--danger)]">{activityError}</p>
            ) : activity === null ? (
              <p className="mt-3 text-sm text-[var(--text-secondary)]">Loading activity…</p>
            ) : (
              <InvoiceActivityTimeline activity={activity} />
            )}
          </SectionCard>

          <SectionCard>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Summary</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <SummaryRow label="Subtotal" value={formatMoney(invoice.subtotalKobo)} />
              <SummaryRow label="Discount" value={formatMoney(invoice.discountKobo)} />
              <SummaryRow label="Tax" value={formatMoney(invoice.taxKobo)} />
              <SummaryRow
                label={financialSummary.hasOverpayment ? "Amount received" : "Amount paid"}
                value={formatMoney(financialSummary.netReceivedKobo)}
              />
              {financialSummary.hasOverpayment ? (
                <>
                  <SummaryRow
                    label="Applied to invoice"
                    value={formatMoney(financialSummary.appliedToInvoiceKobo)}
                  />
                  <SummaryRow
                    label="Overpayment"
                    value={formatMoney(financialSummary.overpaymentKobo)}
                  />
                </>
              ) : null}
              <SummaryRow
                label="Balance due"
                strong
                value={formatMoney(financialSummary.balanceDueKobo)}
              />
              <SummaryRow label="Total" strong value={formatMoney(invoice.totalKobo)} />
            </dl>
          </SectionCard>

          <SectionCard>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Customer payment</h2>
            {canSharePublicUrl ? (
              <>
                <p className="mt-2 break-all rounded-[var(--radius-control)] bg-[var(--surface-raised)] p-3 font-mono text-xs text-[var(--text-secondary)]">
                  {response.publicUrl}
                </p>
                {response.paymentSummary.available ? (
                  <p className="mt-3 rounded-[var(--radius-control)] border border-[var(--accent-border)] bg-[var(--accent-muted)] p-3 text-sm text-[var(--accent)]">
                    Payment enabled: customers can pay{" "}
                    {formatMoney(response.paymentSummary.amountKobo)} via Paystack.
                  </p>
                ) : response.paymentSummary.reason.startsWith("payment_setup_") ? (
                  <div className="mt-3 rounded-[var(--radius-control)] border border-[var(--warning-border)] bg-[var(--warning-muted)] p-3 text-sm text-[var(--warning)]">
                    <p>{response.paymentSummary.message}</p>
                    {canManagePaymentSetup ? (
                      <Link
                        className="mt-3 inline-flex rounded-[var(--radius-control)] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-foreground)]"
                        href="/settings/payment-setup"
                      >
                        Go to Payment Setup
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">
                    {response.paymentSummary.message}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Send this draft to enable public access. Cancelled and void invoices are not
                publicly available.
              </p>
            )}
          </SectionCard>
        </aside>
      </div>

      <ConfirmDialog
        confirmLabel={dialogAction === "cancel" ? "Cancel invoice" : "Void invoice"}
        description={
          dialogAction === "cancel"
            ? "Cancelled invoices are retained for records and cannot be paid."
            : "Voided invoices are retained for audit history and public access will be disabled."
        }
        destructive
        isLoading={isMutating}
        loadingLabel="Saving..."
        onCancel={() => {
          setDialogAction(null);
          setReason("");
        }}
        onConfirm={() => void handleConfirmAction()}
        open={dialogAction !== null}
        title={dialogAction === "cancel" ? "Cancel invoice?" : "Void invoice?"}
      >
        <label className="block">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Reason</span>
          <textarea
            className="mt-1 min-h-24 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm"
            disabled={isMutating}
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </label>
      </ConfirmDialog>

      {invoice ? (
        <SendInvoiceDialog
          defaultSubject={`Invoice ${invoice.invoiceNumber}`}
          defaultToEmail={invoice.customer.email}
          error={sendDialogError}
          invoiceNumber={invoice.invoiceNumber}
          isSubmitting={isSending}
          mode={sendDialogMode === "resend" ? "resend" : "send"}
          onCancel={() => {
            setSendDialogMode(null);
            setSendDialogError(null);
          }}
          onSubmit={(input) => void handleSendSubmit(input)}
          open={sendDialogMode !== null}
        />
      ) : null}
    </section>
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
