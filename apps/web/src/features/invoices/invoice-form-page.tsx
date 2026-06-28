"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Select } from "@/components/ui/select";
import { primaryActionClassName } from "@/components/ui/styles";
import { clearStoredSession } from "@/features/auth/session";
import { listCustomers } from "@/features/customers/customers-api";
import type { Customer } from "@/features/customers/types";
import { isApiRequestError } from "@/lib/api";
import type { InvoiceStatus } from "@sme-invoicing/shared";

import { createInvoice, getInvoice, updateInvoice } from "./invoices-api";
import { formatMoney, InvoiceStatusBadge, PageHeader, StatusPanel } from "./invoice-ui";
import type { InvoiceFormState } from "./types";
import { invoiceManagerRoles } from "./types";
import { getInvoicePreview, toInvoicePayload, validateInvoiceForm } from "./validation";

type InvoiceFormPageProps =
  | {
      mode: "create";
    }
  | {
      invoiceId: string;
      mode: "edit";
    };

type LoadState = "loading" | "ready" | "error";

const blankLineItem = {
  description: "",
  quantity: "1",
  unitPriceNaira: ""
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function defaultDueDate() {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  return dueDate.toISOString().slice(0, 10);
}

const initialForm: InvoiceFormState = {
  customerId: "",
  issueDate: todayDate(),
  dueDate: defaultDueDate(),
  notes: "",
  discountNaira: "0",
  taxNaira: "0",
  lineItems: [{ ...blankLineItem }]
};

export function InvoiceFormPage(props: InvoiceFormPageProps) {
  return (
    <AppShell
      deniedMessage="Owner, Admin, or Accountant access is required to manage invoices."
      requiredRoles={invoiceManagerRoles}
    >
      {({ accessToken }) => <InvoiceFormContent accessToken={accessToken} {...props} />}
    </AppShell>
  );
}

function InvoiceFormContent({
  accessToken,
  invoiceId,
  mode
}: {
  accessToken: string;
  invoiceId?: string;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<InvoiceFormState>(initialForm);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setState("loading");
      setPageError(null);

      try {
        const customersResponse = await listCustomers(accessToken, {
          status: "active",
          limit: 100
        });
        setCustomers(customersResponse.customers);

        if (mode === "edit" && invoiceId) {
          const invoiceResponse = await getInvoice(accessToken, invoiceId);
          setInvoiceStatus(invoiceResponse.invoice.status);
          setForm({
            customerId: invoiceResponse.invoice.customer.id,
            issueDate: invoiceResponse.invoice.issueDate,
            dueDate: invoiceResponse.invoice.dueDate,
            notes: invoiceResponse.invoice.notes ?? "",
            discountNaira: String(invoiceResponse.invoice.discountKobo / 100),
            taxNaira: String(invoiceResponse.invoice.taxKobo / 100),
            lineItems: invoiceResponse.lineItems.map((item) => ({
              description: item.description,
              quantity: String(item.quantity),
              unitPriceNaira: String(item.unitPriceKobo / 100)
            }))
          });
        }

        setState("ready");
      } catch (loadError) {
        handleAuthError(loadError);
        setPageError(
          loadError instanceof Error ? loadError.message : "Could not load invoice form."
        );
        setState("error");
      }
    }

    void load();
  }, [accessToken, invoiceId, mode]);

  const preview = useMemo(() => {
    try {
      return getInvoicePreview(form);
    } catch {
      return {
        subtotalKobo: 0,
        discountKobo: 0,
        taxKobo: 0,
        totalKobo: 0,
        amountPaidKobo: 0,
        balanceDueKobo: 0,
        lineTotalsKobo: []
      };
    }
  }, [form]);

  function updateField(field: keyof InvoiceFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function updateLineItem(
    index: number,
    field: keyof InvoiceFormState["lineItems"][number],
    value: string
  ) {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    }));
    setErrors((current) => ({ ...current, lineItems: "" }));
  }

  function addLineItem() {
    setForm((current) => ({ ...current, lineItems: [...current.lineItems, { ...blankLineItem }] }));
  }

  function removeLineItem(index: number) {
    setForm((current) => ({
      ...current,
      lineItems:
        current.lineItems.length === 1
          ? current.lineItems
          : current.lineItems.filter((_item, itemIndex) => itemIndex !== index)
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPageError(null);
    setSuccess(null);

    const validationErrors = validateInvoiceForm(form);
    setErrors(validationErrors);

    if (Object.values(validationErrors).some(Boolean)) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = toInvoicePayload(form);
      const response =
        mode === "create"
          ? await createInvoice(accessToken, payload)
          : await updateInvoice(accessToken, invoiceId!, payload);
      setSuccess(mode === "create" ? "Invoice created." : "Invoice updated.");
      router.push(`/invoices/${response.invoice.id}`);
    } catch (saveError) {
      handleAuthError(saveError);
      setPageError(saveError instanceof Error ? saveError.message : "Could not save invoice.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAuthError(error: unknown) {
    if (isApiRequestError(error) && error.status === 401) {
      clearStoredSession();
      window.location.assign("/login");
    }
  }

  if (state === "loading") {
    return <StatusPanel message="Loading invoice form..." />;
  }

  if (state === "error") {
    return <StatusPanel message={pageError ?? "Could not load invoice form."} tone="error" />;
  }

  if (mode === "edit" && invoiceStatus !== "draft") {
    return (
      <StatusPanel
        action={
          <Link className="font-semibold text-teal-700" href={`/invoices/${invoiceId}`}>
            Back to invoice
          </Link>
        }
        message="Only draft invoices can be edited."
        tone="warning"
      />
    );
  }

  return (
    <section className="space-y-5">
      <PageHeader
        description={
          mode === "create"
            ? "Create a draft invoice with server-calculated totals."
            : "Edit this draft invoice before sending."
        }
        title={mode === "create" ? "New invoice" : "Edit invoice"}
      />

      {pageError ? <StatusPanel message={pageError} tone="error" /> : null}
      {success ? <StatusPanel message={success} tone="success" /> : null}

      <form className="grid gap-5 xl:grid-cols-[1fr_320px]" onSubmit={handleSubmit}>
        <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Customer" error={errors.customerId}>
              <Select
                disabled={isSubmitting}
                onChange={(event) => updateField("customerId", event.target.value)}
                value={form.customerId}
                wrapperClassName="mt-1"
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Issue date" error={errors.issueDate}>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={isSubmitting}
                onChange={(event) => updateField("issueDate", event.target.value)}
                type="date"
                value={form.issueDate}
              />
            </Field>
            <Field label="Due date" error={errors.dueDate}>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={isSubmitting}
                onChange={(event) => updateField("dueDate", event.target.value)}
                type="date"
                value={form.dueDate}
              />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-950">Line items</h2>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                disabled={isSubmitting}
                onClick={addLineItem}
                type="button"
              >
                Add line
              </button>
            </div>
            {errors.lineItems ? (
              <p className="mt-2 text-sm text-red-700">{errors.lineItems}</p>
            ) : null}
            <div className="mt-3 space-y-3">
              {form.lineItems.map((item, index) => (
                <div
                  className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[1fr_120px_160px_auto]"
                  key={index}
                >
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    disabled={isSubmitting}
                    onChange={(event) => updateLineItem(index, "description", event.target.value)}
                    placeholder="Description"
                    value={item.description}
                  />
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    disabled={isSubmitting}
                    min="0.01"
                    onChange={(event) => updateLineItem(index, "quantity", event.target.value)}
                    step="0.01"
                    type="number"
                    value={item.quantity}
                  />
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    disabled={isSubmitting}
                    min="0"
                    onChange={(event) =>
                      updateLineItem(index, "unitPriceNaira", event.target.value)
                    }
                    placeholder="Unit price (NGN)"
                    step="0.01"
                    type="number"
                    value={item.unitPriceNaira}
                  />
                  <button
                    className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:text-slate-400"
                    disabled={isSubmitting || form.lineItems.length === 1}
                    onClick={() => removeLineItem(index)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Discount (NGN)" error={errors.discountNaira}>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={isSubmitting}
                min="0"
                onChange={(event) => updateField("discountNaira", event.target.value)}
                step="0.01"
                type="number"
                value={form.discountNaira}
              />
            </Field>
            <Field label="Tax (NGN)">
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={isSubmitting}
                min="0"
                onChange={(event) => updateField("taxNaira", event.target.value)}
                step="0.01"
                type="number"
                value={form.taxNaira}
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={isSubmitting}
              onChange={(event) => updateField("notes", event.target.value)}
              value={form.notes}
            />
          </Field>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Link
              className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700"
              href={mode === "edit" ? `/invoices/${invoiceId}` : "/invoices"}
            >
              Cancel
            </Link>
            <button className={primaryActionClassName} disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving..." : mode === "create" ? "Create invoice" : "Save changes"}
            </button>
          </div>
        </div>

        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Preview</h2>
            {invoiceStatus ? <InvoiceStatusBadge status={invoiceStatus} /> : null}
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <SummaryRow label="Subtotal" value={formatMoney(preview.subtotalKobo)} />
            <SummaryRow label="Discount" value={formatMoney(preview.discountKobo)} />
            <SummaryRow label="Tax" value={formatMoney(preview.taxKobo)} />
            <SummaryRow strong label="Total" value={formatMoney(preview.totalKobo)} />
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Preview totals are for usability. The API recalculates all totals server-side.
          </p>
        </aside>
      </form>
    </section>
  );
}

function Field({
  children,
  error,
  label
}: {
  children: React.ReactNode;
  error?: string | undefined;
  label: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-red-700">{error}</span> : null}
    </label>
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
