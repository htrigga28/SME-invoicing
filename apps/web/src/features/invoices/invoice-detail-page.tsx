"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { compactPrimaryActionClassName } from "@/components/ui/styles";
import { clearStoredSession } from "@/features/auth/session";
import { isApiRequestError } from "@/lib/api";

import { cancelInvoice, getInvoice, sendInvoice, voidInvoice } from "./invoices-api";
import { formatDate, formatMoney, InvoiceStatusBadge, PageHeader, StatusPanel } from "./invoice-ui";
import type { InvoiceDetailResponse } from "./types";
import { canCancelOrVoidInvoices, canManageInvoices } from "./types";

type LoadState = "loading" | "ready" | "error";
type DialogAction = "send" | "cancel" | "void" | null;

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
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [dialogAction, setDialogAction] = useState<DialogAction>(null);
  const [reason, setReason] = useState("");
  const [isMutating, setIsMutating] = useState(false);
  const invoice = response?.invoice;
  const canManage = canManageInvoices(role);
  const canCancelVoid = canCancelOrVoidInvoices(role);

  useEffect(() => {
    void loadInvoice();
  }, [accessToken, invoiceId]);

  async function loadInvoice() {
    setState("loading");
    setError(null);

    try {
      const nextResponse = await getInvoice(accessToken, invoiceId);
      setResponse(nextResponse);
      setState("ready");
    } catch (loadError) {
      handleAuthError(loadError);
      setError(loadError instanceof Error ? loadError.message : "Could not load invoice.");
      setState("error");
    }
  }

  async function handleConfirmAction() {
    if (!invoice || !dialogAction) {
      return;
    }

    if ((dialogAction === "cancel" || dialogAction === "void") && !reason.trim()) {
      setError("A reason is required.");
      return;
    }

    setIsMutating(true);
    setError(null);
    setSuccess(null);

    try {
      const nextResponse =
        dialogAction === "send"
          ? await sendInvoice(accessToken, invoice.id)
          : dialogAction === "cancel"
            ? await cancelInvoice(accessToken, invoice.id, reason.trim())
            : await voidInvoice(accessToken, invoice.id, reason.trim());
      setResponse(nextResponse);
      setSuccess(
        dialogAction === "send"
          ? "Invoice sent. Public access is enabled."
          : dialogAction === "cancel"
            ? "Invoice cancelled."
            : "Invoice voided."
      );
      setDialogAction(null);
      setReason("");
    } catch (actionError) {
      handleAuthError(actionError);
      setError(actionError instanceof Error ? actionError.message : "Could not update invoice.");
    } finally {
      setIsMutating(false);
    }
  }

  function handleAuthError(apiError: unknown) {
    if (isApiRequestError(apiError) && apiError.status === 401) {
      clearStoredSession();
      window.location.assign("/login");
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
          <button
            className={compactPrimaryActionClassName}
            onClick={() => void loadInvoice()}
            type="button"
          >
            Retry
          </button>
        }
        message={error ?? "Could not load invoice."}
        tone="error"
      />
    );
  }

  const canEdit = canManage && invoice.status === "draft";
  const canSend = canManage && invoice.status === "draft";
  const canCancel =
    canCancelVoid && ["draft", "sent", "viewed", "overdue"].includes(invoice.status);
  const canVoid =
    canCancelVoid && ["draft", "sent", "viewed", "overdue", "cancelled"].includes(invoice.status);
  const canSharePublicUrl =
    response.publicUrl &&
    invoice.publicAccessEnabled &&
    ["sent", "viewed", "overdue", "partially_paid", "paid"].includes(invoice.status);

  return (
    <section className="space-y-5">
      <PageHeader
        action={
          <Link
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            href="/invoices"
          >
            Back to invoices
          </Link>
        }
        description={`${invoice.customer.name} · Due ${formatDate(invoice.dueDate)}`}
        title={invoice.invoiceNumber}
      />

      {error ? <StatusPanel message={error} tone="error" /> : null}
      {success ? <StatusPanel message={success} tone="success" /> : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <InvoiceStatusBadge status={invoice.status} />
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <DetailItem
                    label="Customer"
                    value={`${invoice.customer.name}\n${invoice.customer.email}`}
                  />
                  <DetailItem label="Issue date" value={formatDate(invoice.issueDate)} />
                  <DetailItem label="Due date" value={formatDate(invoice.dueDate)} />
                  <DetailItem label="Notes" value={invoice.notes || "No notes"} />
                </dl>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEdit ? (
                  <Link
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                    href={`/invoices/${invoice.id}/edit`}
                  >
                    Edit
                  </Link>
                ) : null}
                {canSend ? (
                  <button
                    className={compactPrimaryActionClassName}
                    onClick={() => setDialogAction("send")}
                    type="button"
                  >
                    Send
                  </button>
                ) : null}
                {canCancel ? (
                  <button
                    className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"
                    onClick={() => setDialogAction("cancel")}
                    type="button"
                  >
                    Cancel
                  </button>
                ) : null}
                {canVoid ? (
                  <button
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700"
                    onClick={() => setDialogAction("void")}
                    type="button"
                  >
                    Void
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {response.lineItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">{item.description}</td>
                    <td className="px-4 py-3 text-slate-600">{item.quantity}</td>
                    <td className="px-4 py-3 text-slate-600">{formatMoney(item.unitPriceKobo)}</td>
                    <td className="px-4 py-3 text-right text-slate-900">
                      {formatMoney(item.lineTotalKobo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">Status timeline</h2>
            <div className="mt-4 space-y-3">
              {response.statusEvents.map((event) => (
                <div className="border-l-2 border-slate-200 pl-3" key={event.id}>
                  <p className="text-sm font-medium text-slate-950">
                    {event.fromStatus ? `${event.fromStatus} to ` : ""}
                    {event.toStatus}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(event.createdAt).toLocaleString("en-NG")}
                    {event.reason ? ` · ${event.reason}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">Summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <SummaryRow label="Subtotal" value={formatMoney(invoice.subtotalKobo)} />
              <SummaryRow label="Discount" value={formatMoney(invoice.discountKobo)} />
              <SummaryRow label="Tax" value={formatMoney(invoice.taxKobo)} />
              <SummaryRow label="Amount paid" value={formatMoney(invoice.amountPaidKobo)} />
              <SummaryRow label="Balance due" strong value={formatMoney(invoice.balanceDueKobo)} />
              <SummaryRow label="Total" strong value={formatMoney(invoice.totalKobo)} />
            </dl>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">Public link</h2>
            {canSharePublicUrl ? (
              <>
                <p className="mt-2 break-all rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                  {response.publicUrl}
                </p>
                <button
                  className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  onClick={() => void handleCopyPublicUrl(response.publicUrl!)}
                  type="button"
                >
                  Copy public URL
                </button>
                {copySuccess ? <p className="mt-2 text-sm text-slate-600">{copySuccess}</p> : null}
                {response.paymentSummary.available ? (
                  <p className="mt-3 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm font-medium text-teal-900">
                    Payment enabled: customers can pay{" "}
                    {formatMoney(response.paymentSummary.amountKobo)} via Paystack from this public
                    page.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                Send this draft to enable public access. Cancelled and void invoices are not
                publicly available.
              </p>
            )}
            <p className="mt-3 text-xs text-slate-500">
              The public page is customer-facing and does not expose internal app data.
            </p>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        confirmLabel={
          dialogAction === "send"
            ? "Send invoice"
            : dialogAction === "cancel"
              ? "Cancel invoice"
              : "Void invoice"
        }
        description={
          dialogAction === "send"
            ? "This enables public access and creates a shareable URL. Email sending is out of scope for T006."
            : dialogAction === "cancel"
              ? "Cancelled invoices are retained for records and cannot be paid."
              : "Voided invoices are retained for audit history and public access will be disabled."
        }
        destructive={dialogAction !== "send"}
        isLoading={isMutating}
        loadingLabel="Saving..."
        onCancel={() => {
          setDialogAction(null);
          setReason("");
        }}
        onConfirm={() => void handleConfirmAction()}
        open={dialogAction !== null}
        title={
          dialogAction === "send"
            ? "Send invoice?"
            : dialogAction === "cancel"
              ? "Cancel invoice?"
              : "Void invoice?"
        }
      >
        {dialogAction === "cancel" || dialogAction === "void" ? (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Reason</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={isMutating}
              onChange={(event) => setReason(event.target.value)}
              value={reason}
            />
          </label>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">{value}</dd>
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
