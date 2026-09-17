"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, FieldLabel, FormField, Input, Textarea } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { clearStoredSession } from "@/features/auth/session";
import { listCatalogueItems, createCatalogueItem } from "@/features/catalogue/catalogue-api";
import type { CatalogueItem } from "@/features/catalogue/types";
import { listCustomers } from "@/features/customers/customers-api";
import type { Customer } from "@/features/customers/types";
import { isApiRequestError } from "@/lib/api";
import type { InvoiceStatus } from "@sme-invoicing/shared";
import { convertNairaToKobo } from "@sme-invoicing/shared";

import { InvoiceDocument } from "./invoice-document";
import { createInvoice, getInvoice, sendInvoice, updateInvoice } from "./invoices-api";
import { formatMoney, InvoiceStatusBadge, PageHeader, StatusPanel } from "./invoice-ui";
import type { InvoiceFormState } from "./types";
import { invoiceManagerRoles } from "./types";
import {
  applyDueDatePreset,
  DUE_DATE_PRESETS,
  getInvoicePreview,
  toInvoicePayload,
  validateInvoiceForm
} from "./validation";

type InvoiceFormPageProps =
  | {
      mode: "create";
    }
  | {
      invoiceId: string;
      mode: "edit";
    };

type LoadState = "loading" | "ready" | "error";
type SaveMode = "draft" | "send";
type SendOutcome =
  | { kind: "confirmed-failure"; invoiceId: string }
  | { kind: "committed"; invoiceId: string }
  | { kind: "ambiguous"; invoiceId: string };

const blankLineItem = {
  description: "",
  quantity: "1",
  unitPriceNaira: ""
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function defaultDueDate() {
  return applyDueDatePreset(todayDate(), 14);
}

const initialForm: InvoiceFormState = {
  customerId: "",
  issueDate: todayDate(),
  dueDate: defaultDueDate(),
  customerReference: "",
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
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [catalogueState, setCatalogueState] = useState<"loading" | "ready" | "error">("loading");
  const [form, setForm] = useState<InvoiceFormState>(initialForm);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sendOutcome, setSendOutcome] = useState<SendOutcome | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode | null>(null);
  const [showPreviewTablet, setShowPreviewTablet] = useState(false);
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);
  const [cataloguePickerId, setCataloguePickerId] = useState("");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreate, setQuickCreate] = useState({ name: "", unitPriceNaira: "" });
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null);
  const [isQuickCreating, setIsQuickCreating] = useState(false);
  const mobilePreviewCloseRef = useRef<HTMLButtonElement | null>(null);
  const mobilePreviewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pendingSaveModeRef = useRef<SaveMode>("draft");

  useEffect(() => {
    async function load() {
      setState("loading");
      setPageError(null);

      try {
        const [customersResponse, catalogueResponse] = await Promise.all([
          listCustomers(accessToken, { status: "active", limit: 100 }),
          listCatalogueItems(accessToken, { status: "active" }).catch(() => ({
            catalogueItems: [] as CatalogueItem[]
          }))
        ]);

        let nextCustomers = customersResponse.customers;
        setCatalogue(catalogueResponse.catalogueItems);
        setCatalogueState("ready");

        if (mode === "edit" && invoiceId) {
          const invoiceResponse = await getInvoice(accessToken, invoiceId);
          setInvoiceStatus(invoiceResponse.invoice.status);

          if (
            invoiceResponse.invoice.customer.archivedAt &&
            !nextCustomers.some((item) => item.id === invoiceResponse.invoice.customer.id)
          ) {
            nextCustomers = [...nextCustomers, invoiceResponse.invoice.customer];
          }

          setCustomers(nextCustomers);
          setForm({
            customerId: invoiceResponse.invoice.customer.id,
            issueDate: invoiceResponse.invoice.issueDate,
            dueDate: invoiceResponse.invoice.dueDate,
            customerReference: invoiceResponse.invoice.customerReference ?? "",
            notes: invoiceResponse.invoice.notes ?? "",
            discountNaira: String(invoiceResponse.invoice.discountKobo / 100),
            taxNaira: String(invoiceResponse.invoice.taxKobo / 100),
            lineItems: invoiceResponse.lineItems.map((item) => ({
              description: item.description,
              quantity: String(item.quantity),
              unitPriceNaira: String(item.unitPriceKobo / 100)
            }))
          });
        } else {
          setCustomers(nextCustomers);
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

  useEffect(() => {
    if (showPreviewMobile) {
      mobilePreviewCloseRef.current?.focus();
    } else {
      mobilePreviewTriggerRef.current?.focus();
    }
  }, [showPreviewMobile]);

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
        lineTotalsKobo: [] as number[]
      };
    }
  }, [form]);

  const selectedCustomer = customers.find((item) => item.id === form.customerId) ?? null;

  const documentLineItems = form.lineItems
    .filter((item) => item.description.trim())
    .map((item, index) => {
      let unitPriceKobo = 0;
      let lineTotalKobo = 0;

      try {
        unitPriceKobo = convertNairaToKobo(item.unitPriceNaira || "0");
        lineTotalKobo = preview.lineTotalsKobo[index] ?? Math.round(Number(item.quantity || "0") * unitPriceKobo);
      } catch {
        unitPriceKobo = 0;
        lineTotalKobo = 0;
      }

      return {
        description: item.description.trim(),
        quantity: Number(item.quantity || "0"),
        unitPriceKobo,
        lineTotalKobo
      };
    });

  function updateField(field: keyof InvoiceFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setSendOutcome(null);
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
    setSendOutcome(null);
  }

  function addLineItem() {
    setForm((current) => ({ ...current, lineItems: [...current.lineItems, { ...blankLineItem }] }));
  }

  function addCatalogueLine(item: CatalogueItem) {
    setForm((current) => ({
      ...current,
      lineItems: [
        ...current.lineItems.filter((line) => line.description.trim()),
        {
          description: item.name,
          quantity: "1",
          unitPriceNaira: String(item.defaultUnitPriceKobo / 100)
        }
      ]
    }));
    setErrors((current) => ({ ...current, lineItems: "" }));
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

  async function handleQuickCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuickCreateError(null);

    const name = quickCreate.name.trim();

    if (!name) {
      setQuickCreateError("Name is required.");
      return;
    }

    if (name.length > 200) {
      setQuickCreateError("Name must be 200 characters or fewer.");
      return;
    }

    let unitPriceKobo = 0;

    try {
      unitPriceKobo = convertNairaToKobo(quickCreate.unitPriceNaira.trim() || "0");
    } catch {
      setQuickCreateError("Enter a valid NGN amount with at most 2 decimal places.");
      return;
    }

    setIsQuickCreating(true);

    try {
      const response = await createCatalogueItem(accessToken, {
        name,
        description: null,
        defaultUnitPriceKobo: unitPriceKobo
      });
      setCatalogue((current) => [...current, response.catalogueItem].sort((a, b) => a.name.localeCompare(b.name)));
      addCatalogueLine(response.catalogueItem);
      setQuickCreate({ name: "", unitPriceNaira: "" });
      setQuickCreateOpen(false);
    } catch (createError) {
      handleAuthError(createError);
      setQuickCreateError(
        createError instanceof Error ? createError.message : "Could not create catalogue item."
      );
    } finally {
      setIsQuickCreating(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSaveMode = pendingSaveModeRef.current;
    setPageError(null);
    setSuccess(null);
    setSendOutcome(null);

    const validationErrors = validateInvoiceForm(form);
    setErrors(validationErrors);

    if (Object.values(validationErrors).some(Boolean)) {
      return;
    }

    setIsSubmitting(true);
    setSaveMode(nextSaveMode);

    try {
      const payload = toInvoicePayload(form);
      const response =
        mode === "create"
          ? await createInvoice(accessToken, payload)
          : await updateInvoice(accessToken, invoiceId!, payload);

      if (nextSaveMode === "draft") {
        setSuccess(mode === "create" ? "Draft saved." : "Draft updated.");
        router.push(`/invoices/${response.invoice.id}`);
        return;
      }

      try {
        const sent = await sendInvoice(accessToken, response.invoice.id);
        setSuccess(`Invoice ${sent.invoice.invoiceNumber} sent.`);
        router.push(`/invoices/${sent.invoice.id}`);
      } catch (sendError) {
        handleAuthError(sendError);

        try {
          const refreshed = await getInvoice(accessToken, response.invoice.id);

          if (refreshed.invoice.status === "draft") {
            setSendOutcome({ kind: "confirmed-failure", invoiceId: refreshed.invoice.id });
            setPageError(
              sendError instanceof Error
                ? `Saved as draft, but sending failed: ${sendError.message}`
                : "Saved as draft, but sending failed."
            );
          } else {
            setSendOutcome({ kind: "committed", invoiceId: refreshed.invoice.id });
            setSuccess(
              `Invoice ${refreshed.invoice.invoiceNumber} was sent. The send response was not received, but the invoice status is ${refreshed.invoice.status}.`
            );
          }
        } catch {
          setSendOutcome({ kind: "ambiguous", invoiceId: response.invoice.id });
          setPageError(
            "Saved, but the send result is uncertain. Open the invoice to confirm its status before retrying. Do not retry blindly."
          );
        }
      }
    } catch (saveError) {
      handleAuthError(saveError);
      setPageError(saveError instanceof Error ? saveError.message : "Could not save invoice.");
    } finally {
      setIsSubmitting(false);
      setSaveMode(null);
    }
  }

  async function handleRetrySend() {
    if (!sendOutcome || sendOutcome.kind !== "confirmed-failure") {
      return;
    }

    setIsSubmitting(true);

    try {
      const retried = await sendInvoice(accessToken, sendOutcome.invoiceId);
      setSendOutcome(null);
      setPageError(null);
      setSuccess(`Invoice ${retried.invoice.invoiceNumber} sent.`);
      router.push(`/invoices/${retried.invoice.id}`);
    } catch (retryError) {
      handleAuthError(retryError);
      setPageError(
        retryError instanceof Error ? retryError.message : "Sending failed again. Try again later."
      );
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

  const previewDocument = (
    <InvoiceDocument
      balanceDueKobo={preview.balanceDueKobo}
      customer={{
        name: selectedCustomer?.name ?? "Select a customer",
        email: selectedCustomer?.email ?? null,
        phone: selectedCustomer?.phone ?? null,
        billingAddress: selectedCustomer?.billingAddress ?? null
      }}
      customerMemo={form.notes.trim() || null}
      customerReference={form.customerReference.trim() || null}
      discountKobo={preview.discountKobo}
      dueDate={form.dueDate || todayDate()}
      invoiceNumber={mode === "create" ? "Draft preview" : "Draft preview"}
      issueDate={form.issueDate || todayDate()}
      lineItems={documentLineItems}
      status="draft"
      subtotalKobo={preview.subtotalKobo}
      taxKobo={preview.taxKobo}
      totalKobo={preview.totalKobo}
    />
  );

  return (
    <section className="space-y-5">
      <PageHeader
        description={
          mode === "create"
            ? "Create a draft invoice with a live customer preview."
            : "Edit this draft invoice before sending."
        }
        title={mode === "create" ? "New invoice" : "Edit invoice"}
      />

      {pageError ? <StatusPanel message={pageError} tone="error" /> : null}
      {success ? <StatusPanel message={success} tone="success" /> : null}
      {sendOutcome?.kind === "confirmed-failure" ? (
        <StatusPanel
          action={
            <div className="flex flex-wrap gap-2">
              <Button disabled={isSubmitting} onClick={() => void handleRetrySend()} size="sm" type="button">
                Retry send
              </Button>
              <Link
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                href={`/invoices/${sendOutcome.invoiceId}`}
              >
                Open saved invoice
              </Link>
            </div>
          }
          message="The invoice was saved as a draft. Sending was confirmed to have failed, so retry is safe."
          tone="warning"
        />
      ) : null}
      {sendOutcome?.kind === "ambiguous" ? (
        <StatusPanel
          action={
            <Link
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              href={`/invoices/${sendOutcome.invoiceId}`}
            >
              Open saved invoice
            </Link>
          }
          message="Saved, but the send result could not be confirmed. Check the invoice status before retrying."
          tone="warning"
        />
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <form
          aria-label={mode === "create" ? "Create invoice" : "Edit invoice"}
          className="space-y-5 rounded-lg border border-slate-200 bg-white p-5"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField>
              <FieldLabel htmlFor="invoice-customer">Customer</FieldLabel>
              <Select
                disabled={isSubmitting}
                id="invoice-customer"
                onChange={(event) => updateField("customerId", event.target.value)}
                value={form.customerId}
                wrapperClassName="mt-1"
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.archivedAt ? " (archived)" : ""}
                  </option>
                ))}
              </Select>
              {errors.customerId ? <FieldError>{errors.customerId}</FieldError> : null}
            </FormField>
            <FormField>
              <FieldLabel htmlFor="invoice-reference">Customer reference / PO (optional)</FieldLabel>
              <Input
                className="mt-1"
                disabled={isSubmitting}
                id="invoice-reference"
                maxLength={120}
                onChange={(event) => updateField("customerReference", event.target.value)}
                placeholder="PO-2026-042"
                value={form.customerReference}
              />
              {errors.customerReference ? <FieldError>{errors.customerReference}</FieldError> : null}
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField>
              <FieldLabel htmlFor="invoice-issue-date">Issue date</FieldLabel>
              <Input
                className="mt-1"
                disabled={isSubmitting}
                id="invoice-issue-date"
                onChange={(event) => updateField("issueDate", event.target.value)}
                type="date"
                value={form.issueDate}
              />
              {errors.issueDate ? <FieldError>{errors.issueDate}</FieldError> : null}
            </FormField>
            <FormField>
              <FieldLabel htmlFor="invoice-due-date">Due date</FieldLabel>
              <Input
                className="mt-1"
                disabled={isSubmitting}
                id="invoice-due-date"
                onChange={(event) => updateField("dueDate", event.target.value)}
                type="date"
                value={form.dueDate}
              />
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Due date presets">
                {DUE_DATE_PRESETS.map((preset) => (
                  <Button
                    disabled={isSubmitting || !form.issueDate}
                    key={preset.label}
                    onClick={() => updateField("dueDate", applyDueDatePreset(form.issueDate, preset.days))}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              {errors.dueDate ? <FieldError>{errors.dueDate}</FieldError> : null}
            </FormField>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Line items</h2>
              <div className="flex flex-wrap gap-2">
                <Button disabled={isSubmitting} onClick={addLineItem} size="sm" type="button" variant="outline">
                  Add ad-hoc line
                </Button>
                <Button
                  disabled={isSubmitting}
                  onClick={() => setQuickCreateOpen((current) => !current)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {quickCreateOpen ? "Close quick create" : "Create catalogue item"}
                </Button>
              </div>
            </div>

            {catalogueState === "error" ? (
              <p className="text-sm text-slate-600">Catalogue could not be loaded. Ad-hoc lines still work.</p>
            ) : null}

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <FormField>
                <FieldLabel htmlFor="catalogue-picker">Add from catalogue</FieldLabel>
                <Select
                  disabled={isSubmitting || catalogue.length === 0}
                  id="catalogue-picker"
                  onChange={(event) => setCataloguePickerId(event.target.value)}
                  value={cataloguePickerId}
                  wrapperClassName="mt-1"
                >
                  <option value="">
                    {catalogue.length === 0 ? "No active catalogue items" : "Select an item"}
                  </option>
                  {catalogue.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {(item.defaultUnitPriceKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })} NGN
                    </option>
                  ))}
                </Select>
                {cataloguePickerId ? (
                  <FieldHint>
                    {catalogue.find((item) => item.id === cataloguePickerId)?.description?.trim() ||
                      "Values copy into an editable invoice line. The catalogue record is not changed."}
                  </FieldHint>
                ) : null}
              </FormField>
              <div className="flex items-end">
                <Button
                  disabled={isSubmitting || !cataloguePickerId}
                  onClick={() => {
                    const selected = catalogue.find((item) => item.id === cataloguePickerId);
                    if (selected) {
                      addCatalogueLine(selected);
                      setCataloguePickerId("");
                    }
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Add selected
                </Button>
              </div>
            </div>

            {quickCreateOpen ? (
              <form
                aria-label="Quick create catalogue item"
                className="grid gap-3 rounded-md border border-dashed border-slate-300 p-3 md:grid-cols-[1fr_160px_auto]"
                onSubmit={(event) => void handleQuickCreate(event)}
              >
                <FormField>
                  <FieldLabel htmlFor="quick-catalogue-name">New item name</FieldLabel>
                  <Input
                    className="mt-1"
                    disabled={isQuickCreating}
                    id="quick-catalogue-name"
                    maxLength={200}
                    onChange={(event) => setQuickCreate((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Monthly bookkeeping"
                    value={quickCreate.name}
                  />
                </FormField>
                <FormField>
                  <FieldLabel htmlFor="quick-catalogue-price">Price (NGN)</FieldLabel>
                  <Input
                    className="mt-1"
                    disabled={isQuickCreating}
                    id="quick-catalogue-price"
                    min="0"
                    onChange={(event) =>
                      setQuickCreate((current) => ({ ...current, unitPriceNaira: event.target.value }))
                    }
                    placeholder="1500.00"
                    step="0.01"
                    type="number"
                    value={quickCreate.unitPriceNaira}
                  />
                </FormField>
                <div className="flex items-end">
                  <Button disabled={isQuickCreating} size="sm" type="submit">
                    {isQuickCreating ? "Creating..." : "Create & add"}
                  </Button>
                </div>
                {quickCreateError ? (
                  <p className="text-sm text-red-700 md:col-span-3">{quickCreateError}</p>
                ) : null}
              </form>
            ) : null}

            {errors.lineItems ? (
              <p className="text-sm text-red-700" role="alert">
                {errors.lineItems}
              </p>
            ) : null}

            <div className="space-y-3">
              {form.lineItems.map((item, index) => (
                <div
                  className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[1fr_120px_160px_auto]"
                  key={index}
                >
                  <div>
                    <label className="text-xs font-medium text-slate-600" htmlFor={`line-item-${index}-description`}>
                      Line {index + 1} description
                    </label>
                    <Input
                      aria-label={`Line item ${index + 1} description`}
                      className="mt-1"
                      disabled={isSubmitting}
                      id={`line-item-${index}-description`}
                      maxLength={500}
                      onChange={(event) => updateLineItem(index, "description", event.target.value)}
                      placeholder="Description"
                      value={item.description}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600" htmlFor={`line-item-${index}-quantity`}>
                      Qty
                    </label>
                    <Input
                      aria-label={`Line item ${index + 1} quantity`}
                      className="mt-1"
                      disabled={isSubmitting}
                      id={`line-item-${index}-quantity`}
                      min="0.01"
                      onChange={(event) => updateLineItem(index, "quantity", event.target.value)}
                      step="0.01"
                      type="number"
                      value={item.quantity}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600" htmlFor={`line-item-${index}-unit-price`}>
                      Unit price (NGN)
                    </label>
                    <Input
                      aria-label={`Line item ${index + 1} unit price in NGN`}
                      className="mt-1"
                      disabled={isSubmitting}
                      id={`line-item-${index}-unit-price`}
                      min="0"
                      onChange={(event) => updateLineItem(index, "unitPriceNaira", event.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      value={item.unitPriceNaira}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      disabled={isSubmitting || form.lineItems.length === 1}
                      onClick={() => removeLineItem(index)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField>
              <FieldLabel htmlFor="invoice-discount">Discount (NGN)</FieldLabel>
              <Input
                className="mt-1"
                disabled={isSubmitting}
                id="invoice-discount"
                min="0"
                onChange={(event) => updateField("discountNaira", event.target.value)}
                step="0.01"
                type="number"
                value={form.discountNaira}
              />
              {errors.discountNaira ? <FieldError>{errors.discountNaira}</FieldError> : null}
            </FormField>
            <FormField>
              <FieldLabel htmlFor="invoice-tax">Tax (NGN)</FieldLabel>
              <Input
                className="mt-1"
                disabled={isSubmitting}
                id="invoice-tax"
                min="0"
                onChange={(event) => updateField("taxNaira", event.target.value)}
                step="0.01"
                type="number"
                value={form.taxNaira}
              />
              {errors.taxNaira ? <FieldError>{errors.taxNaira}</FieldError> : null}
            </FormField>
          </div>

          <FormField>
            <FieldLabel htmlFor="invoice-memo">Customer memo</FieldLabel>
            <Textarea
              disabled={isSubmitting}
              id="invoice-memo"
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Visible to the customer on the invoice."
              value={form.notes}
            />
            <FieldHint>This memo appears on the customer-facing invoice and public page.</FieldHint>
          </FormField>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Link
              className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700"
              href={mode === "edit" ? `/invoices/${invoiceId}` : "/invoices"}
            >
              Cancel
            </Link>
            <Button
              disabled={isSubmitting}
              isLoading={isSubmitting && saveMode === "draft"}
              loadingLabel="Saving..."
              onClick={() => {
                pendingSaveModeRef.current = "draft";
              }}
              type="submit"
              variant="outline"
            >
              Save draft
            </Button>
            <Button
              disabled={isSubmitting}
              isLoading={isSubmitting && saveMode === "send"}
              loadingLabel="Saving..."
              onClick={() => {
                pendingSaveModeRef.current = "send";
              }}
              type="submit"
            >
              Save and send
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Save and send first saves the invoice, then sends it. If sending fails after a successful
            save, the saved invoice link is kept and the authoritative status is checked before any
            retry is offered.
          </p>
        </form>

        <div className="space-y-3">
          <div className="hidden xl:block">
            <div className="sticky top-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-950">Live preview</h2>
                {invoiceStatus ? <InvoiceStatusBadge status={invoiceStatus} /> : null}
              </div>
              {previewDocument}
              <p className="text-xs text-slate-500">
                Preview is optimistic. Saved detail uses API-calculated totals. Total:{" "}
                {formatMoney(preview.totalKobo)}.
              </p>
            </div>
          </div>

          <div className="xl:hidden">
            <div className="flex flex-wrap gap-2">
              <Button
                className="lg:hidden"
                onClick={() => setShowPreviewTablet((current) => !current)}
                size="sm"
                type="button"
                variant="outline"
              >
                {showPreviewTablet ? "Hide preview" : "Toggle preview"}
              </Button>
              <Button
                className="sm:hidden"
                onClick={() => setShowPreviewMobile(true)}
                ref={mobilePreviewTriggerRef}
                size="sm"
                type="button"
                variant="outline"
              >
                Preview invoice
              </Button>
            </div>

            {showPreviewTablet ? (
              <div className="mt-3 hidden sm:block xl:hidden">{previewDocument}</div>
            ) : null}
          </div>
        </div>
      </div>

      {showPreviewMobile ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col bg-white sm:hidden"
          role="dialog"
          aria-label="Invoice preview"
        >
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <h2 className="text-lg font-semibold">Invoice preview</h2>
            <Button
              onClick={() => setShowPreviewMobile(false)}
              ref={mobilePreviewCloseRef}
              size="sm"
              type="button"
              variant="outline"
            >
              Close preview
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{previewDocument}</div>
        </div>
      ) : null}
    </section>
  );
}
