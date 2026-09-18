"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Eye, Plus, Trash2 } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { LoadingSkeleton } from "@/components/ui/feedback";
import { Button, LinkButton, IconButton } from "@/components/ui/button";
import {
  FieldError,
  FieldHint,
  FieldLabel,
  FormField,
  Input,
  Textarea
} from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { clearStoredSession } from "@/features/auth/session";
import { listCatalogueItems, createCatalogueItem } from "@/features/catalogue/catalogue-api";
import type { CatalogueItem } from "@/features/catalogue/types";
import { listCustomers } from "@/features/customers/customers-api";
import type { Customer } from "@/features/customers/types";
import { isApiRequestError } from "@/lib/api";
import type { InvoiceStatus } from "@sme-invoicing/shared";
import { convertNairaToKobo } from "@sme-invoicing/shared";

import { InvoiceDocument, type CustomerVisibleBusiness } from "./invoice-document";
import { createInvoice, getInvoice, sendInvoice, updateInvoice } from "./invoices-api";
import { formatMoney, PageHeader, StatusPanel } from "./invoice-ui";
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
      {({ accessToken, me }) => (
        <InvoiceFormContent
          accessToken={accessToken}
          business={{
            ...me.businessProfile,
            businessName: me.businessProfile.businessName ?? me.activeOrganisation.name
          }}
          {...props}
        />
      )}
    </AppShell>
  );
}

export function InvoiceFormContent({
  accessToken,
  business,
  invoiceId,
  mode
}: {
  accessToken: string;
  business?: CustomerVisibleBusiness;
  invoiceId?: string;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [catalogueState, setCatalogueState] = useState<"loading" | "ready" | "error">("loading");
  const [form, setForm] = useState<InvoiceFormState>(initialForm);
  const [invoiceNumber, setInvoiceNumber] = useState("Draft");
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sendOutcome, setSendOutcome] = useState<SendOutcome | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode | null>(null);
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);
  const [cataloguePickerId, setCataloguePickerId] = useState("");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreate, setQuickCreate] = useState({ name: "", unitPriceNaira: "" });
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null);
  const [isQuickCreating, setIsQuickCreating] = useState(false);
  const pendingSaveModeRef = useRef<SaveMode>("draft");

  useEffect(() => {
    async function load() {
      setState("loading");
      setPageError(null);

      try {
        const [customersResponse, catalogueResponse] = await Promise.all([
          listCustomers(accessToken, { status: "active", limit: 100 }),
          listCatalogueItems(accessToken, { status: "active" }).catch(() => null)
        ]);

        let nextCustomers = customersResponse.customers;
        setCatalogue(catalogueResponse?.catalogueItems ?? []);
        setCatalogueState(catalogueResponse ? "ready" : "error");

        if (mode === "edit" && invoiceId) {
          const invoiceResponse = await getInvoice(accessToken, invoiceId);
          setInvoiceStatus(invoiceResponse.invoice.status);
          setInvoiceNumber(invoiceResponse.invoice.invoiceNumber);

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
    .map((item, index) => {
      let unitPriceKobo = 0;
      let lineTotalKobo = 0;

      try {
        unitPriceKobo = convertNairaToKobo(item.unitPriceNaira || "0");
        lineTotalKobo =
          preview.lineTotalsKobo[index] ?? Math.round(Number(item.quantity || "0") * unitPriceKobo);
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
    })
    .filter((item) => item.description);

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
      setCatalogue((current) =>
        [...current, response.catalogueItem].sort((a, b) => a.name.localeCompare(b.name))
      );
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
    return <LoadingSkeleton rows={6} />;
  }

  if (state === "error") {
    return <StatusPanel message={pageError ?? "Could not load invoice form."} tone="error" />;
  }

  if (mode === "edit" && invoiceStatus !== "draft") {
    return (
      <StatusPanel
        action={
          <Link
            className="font-semibold text-[var(--accent)] hover:underline"
            href={`/invoices/${invoiceId}`}
          >
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
      business={business ?? null}
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
      invoiceNumber={invoiceNumber}
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
        actions={
          <Button
            className="xl:hidden"
            variant="outline"
            type="button"
            onClick={() => setShowPreviewMobile(true)}
          >
            <Eye aria-hidden="true" className="h-4 w-4" />
            Preview invoice
          </Button>
        }
      />

      {pageError ? <StatusPanel message={pageError} tone="error" /> : null}
      {success ? <StatusPanel message={success} tone="success" /> : null}
      {sendOutcome?.kind === "confirmed-failure" ? (
        <StatusPanel
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={isSubmitting}
                onClick={() => void handleRetrySend()}
                size="sm"
                type="button"
              >
                Retry send
              </Button>
              <Link
                className="rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
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
              className="rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
              href={`/invoices/${sendOutcome.invoiceId}`}
            >
              Open saved invoice
            </Link>
          }
          message="Saved, but the send result could not be confirmed. Check the invoice status before retrying."
          tone="warning"
        />
      ) : null}

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        <form
          aria-label={mode === "create" ? "Create invoice" : "Edit invoice"}
          className="min-w-0 space-y-6 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <section className="space-y-4" aria-label="Customer and dates">
            <h2 className="text-base font-semibold">Bill to</h2>
            <FormField>
              <FieldLabel>Customer</FieldLabel>
              <Select
                aria-label="Customer"
                disabled={isSubmitting}
                id="invoice-customer"
                aria-invalid={Boolean(errors.customerId)}
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
            {selectedCustomer ? (
              <p className="break-words text-sm text-[var(--text-secondary)]">
                {selectedCustomer.email}
                {selectedCustomer.billingAddress ? ` · ${selectedCustomer.billingAddress}` : ""}
              </p>
            ) : customers.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Add a customer before creating an invoice.{" "}
                <Link
                  className="font-semibold text-[var(--accent)] underline"
                  href="/customers/new"
                >
                  Create customer
                </Link>
              </p>
            ) : null}
          </section>
          <section
            className="space-y-4 border-t border-[var(--border-subtle)] pt-5"
            aria-label="Invoice details"
          >
            <h2 className="text-base font-semibold">Invoice details</h2>
            <div className="grid min-w-0 grid-cols-2 gap-3">
              <FormField className="min-w-0">
                <FieldLabel>Issue date</FieldLabel>
                <Input
                  className="mt-1 min-w-0"
                  disabled={isSubmitting}
                  type="date"
                  value={form.issueDate}
                  onChange={(event) => updateField("issueDate", event.target.value)}
                />
                {errors.issueDate ? <FieldError>{errors.issueDate}</FieldError> : null}
              </FormField>
              <FormField className="min-w-0">
                <FieldLabel>Due date</FieldLabel>
                <Input
                  className="mt-1 min-w-0"
                  disabled={isSubmitting}
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => updateField("dueDate", event.target.value)}
                />
                {errors.dueDate ? <FieldError>{errors.dueDate}</FieldError> : null}
              </FormField>
            </div>
            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label="Due date presets"
            >
              <span className="mr-2 text-xs text-[var(--text-secondary)]">Payment terms</span>
              {DUE_DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  disabled={isSubmitting || !form.issueDate}
                  onClick={() =>
                    updateField("dueDate", applyDueDatePreset(form.issueDate, preset.days))
                  }
                  size="sm"
                  type="button"
                  variant={
                    form.dueDate === applyDueDatePreset(form.issueDate, preset.days)
                      ? "secondary"
                      : "ghost"
                  }
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <FormField>
              <FieldLabel>Customer reference / PO (optional)</FieldLabel>
              <Input
                className="mt-1"
                disabled={isSubmitting}
                maxLength={120}
                onChange={(event) => updateField("customerReference", event.target.value)}
                placeholder="PO-2026-042"
                value={form.customerReference}
              />
              {errors.customerReference ? (
                <FieldError>{errors.customerReference}</FieldError>
              ) : null}
            </FormField>
          </section>

          <section
            className="min-w-0 space-y-3 border-t border-[var(--border-subtle)] pt-5"
            aria-label="Line items"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Items</h2>
              <span className="text-xs text-[var(--text-secondary)]">Prices in NGN</span>
            </div>
            <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
              {form.lineItems.map((item, index) => (
                <div className="space-y-2 py-3" key={index}>
                  <div className="flex items-start gap-2">
                    <Textarea
                      className="min-h-11 flex-1 resize-y"
                      aria-label={`Line item ${index + 1} description`}
                      disabled={isSubmitting}
                      maxLength={500}
                      rows={2}
                      onChange={(event) => updateLineItem(index, "description", event.target.value)}
                      placeholder="Describe the product or service"
                      value={item.description}
                    />
                    <IconButton
                      aria-label={`Remove line ${index + 1}`}
                      disabled={isSubmitting || form.lineItems.length === 1}
                      onClick={() => removeLineItem(index)}
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </IconButton>
                  </div>
                  <div className="grid grid-cols-[minmax(0,.7fr)_minmax(0,1fr)_minmax(0,1.2fr)] items-end gap-2">
                    <FormField className="min-w-0">
                      <FieldLabel>Qty</FieldLabel>
                      <Input
                        className="mt-1 px-2 tabular-nums"
                        aria-label={`Line item ${index + 1} quantity`}
                        disabled={isSubmitting}
                        min="0.01"
                        step="0.01"
                        type="number"
                        onChange={(event) => updateLineItem(index, "quantity", event.target.value)}
                        value={item.quantity}
                      />
                    </FormField>
                    <FormField className="min-w-0">
                      <FieldLabel>Rate (NGN)</FieldLabel>
                      <Input
                        className="mt-1 px-2 tabular-nums"
                        aria-label={`Line item ${index + 1} unit price in NGN`}
                        disabled={isSubmitting}
                        min="0"
                        step="0.01"
                        type="number"
                        onChange={(event) =>
                          updateLineItem(index, "unitPriceNaira", event.target.value)
                        }
                        placeholder="0.00"
                        value={item.unitPriceNaira}
                      />
                    </FormField>
                    <div className="min-w-0 text-right">
                      <p className="text-xs text-[var(--text-secondary)]">Amount</p>
                      <p
                        className="flex min-h-11 items-center justify-end whitespace-nowrap text-sm font-semibold tabular-nums"
                        aria-label={`Line item ${index + 1} amount`}
                      >
                        {formatMoney(preview.lineTotalsKobo[index] ?? 0)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {errors.lineItems ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {errors.lineItems}
              </p>
            ) : null}
            <Button
              disabled={isSubmitting}
              onClick={addLineItem}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add ad-hoc line
            </Button>
            <div className="flex flex-col gap-2">
              <FormField>
                <FieldLabel>Add from catalogue</FieldLabel>
                <div className="mt-1 flex gap-2">
                  <Select
                    aria-label="Add from catalogue"
                    disabled={isSubmitting || catalogue.length === 0}
                    onChange={(event) => setCataloguePickerId(event.target.value)}
                    value={cataloguePickerId}
                    wrapperClassName="min-w-0 flex-1"
                  >
                    <option value="">
                      {catalogue.length === 0
                        ? "No active catalogue items"
                        : "Select a product or service"}
                    </option>
                    {catalogue.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {formatMoney(item.defaultUnitPriceKobo)}
                      </option>
                    ))}
                  </Select>
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
              </FormField>
              {catalogueState === "error" ? (
                <p role="status" className="text-sm text-[var(--danger)]">
                  Catalogue could not be loaded. Ad-hoc lines still work.
                </p>
              ) : null}
              {cataloguePickerId ? (
                <FieldHint>
                  {catalogue.find((item) => item.id === cataloguePickerId)?.description ||
                    "You can edit the copied description, quantity and price on this invoice."}
                </FieldHint>
              ) : null}
              <Button
                className="self-start"
                disabled={isSubmitting}
                onClick={() => setQuickCreateOpen(true)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Create catalogue item
              </Button>
            </div>
          </section>

          <section
            className="space-y-4 border-t border-[var(--border-subtle)] pt-5"
            aria-label="Totals and memo"
          >
            <details
              open={
                Boolean(errors.discountNaira || errors.taxNaira) ||
                Number(form.discountNaira) !== 0 ||
                Number(form.taxNaira) !== 0
              }
            >
              <summary className="cursor-pointer py-2 text-sm font-semibold">
                Discount & tax
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <FormField>
                  <FieldLabel>Discount (NGN)</FieldLabel>
                  <Input
                    className="mt-1"
                    disabled={isSubmitting}
                    min="0"
                    step="0.01"
                    type="number"
                    onChange={(event) => updateField("discountNaira", event.target.value)}
                    value={form.discountNaira}
                  />
                  {errors.discountNaira ? <FieldError>{errors.discountNaira}</FieldError> : null}
                </FormField>
                <FormField>
                  <FieldLabel>Tax (NGN)</FieldLabel>
                  <Input
                    className="mt-1"
                    disabled={isSubmitting}
                    min="0"
                    step="0.01"
                    type="number"
                    onChange={(event) => updateField("taxNaira", event.target.value)}
                    value={form.taxNaira}
                  />
                  {errors.taxNaira ? <FieldError>{errors.taxNaira}</FieldError> : null}
                </FormField>
              </div>
            </details>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--border-subtle)] pt-4">
              <span className="text-sm font-semibold">Invoice total</span>
              <strong className="text-xl tabular-nums">{formatMoney(preview.totalKobo)}</strong>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Estimated as you edit. Final totals are confirmed when you save.
            </p>
            <FormField>
              <FieldLabel>Customer memo</FieldLabel>
              <Textarea
                className="mt-1"
                disabled={isSubmitting}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Payment terms or a note for your customer (optional)"
                value={form.notes}
              />
              <FieldHint>Appears on the invoice your customer receives.</FieldHint>
            </FormField>
            <div className="border-t border-[var(--border-subtle)] pt-4">
              <h2 className="text-sm font-semibold">Collection & sharing</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                Send to enable the customer invoice link. Online payment follows your business
                payment setup.
              </p>
            </div>
          </section>
          <div className="sticky bottom-0 z-10 -mx-4 -mb-4 space-y-2 border-t border-[var(--border-subtle)] bg-[var(--surface)] p-3 sm:-mx-5 sm:-mb-5">
            <div className="flex flex-wrap justify-end gap-2">
              <LinkButton
                className="mr-auto"
                href={mode === "edit" ? `/invoices/${invoiceId}` : "/invoices"}
                variant="ghost"
                size="sm"
              >
                Cancel
              </LinkButton>
              <Button
                disabled={isSubmitting}
                isLoading={isSubmitting && saveMode === "draft"}
                loadingLabel="Saving..."
                onClick={() => {
                  pendingSaveModeRef.current = "draft";
                }}
                type="submit"
                variant="outline"
                size="sm"
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
                size="sm"
              >
                Save and send
              </Button>
            </div>
          </div>
        </form>
        <aside
          className="sticky top-20 hidden min-w-0 space-y-3 xl:block"
          aria-label="Customer-facing preview"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Customer preview</h2>
            <span className="text-xs text-[var(--text-secondary)]">Updates as you edit</span>
          </div>
          {previewDocument}
        </aside>
      </div>
      <Drawer
        open={showPreviewMobile}
        onClose={() => setShowPreviewMobile(false)}
        title="Invoice preview"
        description="Estimated totals. Final totals are confirmed when you save."
        wide
      >
        {previewDocument}
      </Drawer>
      <Drawer
        open={quickCreateOpen}
        onClose={() => {
          if (!isQuickCreating) setQuickCreateOpen(false);
        }}
        title="Create catalogue item"
        description="Save a reusable item and add it to this invoice."
      >
        <form
          aria-label="Quick create catalogue item"
          className="space-y-4"
          onSubmit={(event) => void handleQuickCreate(event)}
        >
          <FormField>
            <FieldLabel>New item name</FieldLabel>
            <Input
              className="mt-1"
              disabled={isQuickCreating}
              maxLength={200}
              onChange={(event) =>
                setQuickCreate((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Monthly bookkeeping"
              value={quickCreate.name}
            />
          </FormField>
          <FormField>
            <FieldLabel>Price (NGN)</FieldLabel>
            <Input
              className="mt-1"
              disabled={isQuickCreating}
              min="0"
              step="0.01"
              type="number"
              onChange={(event) =>
                setQuickCreate((current) => ({ ...current, unitPriceNaira: event.target.value }))
              }
              value={quickCreate.unitPriceNaira}
            />
          </FormField>
          {quickCreateError ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {quickCreateError}
            </p>
          ) : null}
          <Button
            disabled={isQuickCreating}
            isLoading={isQuickCreating}
            loadingLabel="Creating..."
            type="submit"
          >
            Create & add
          </Button>
        </form>
      </Drawer>
    </section>
  );
}
