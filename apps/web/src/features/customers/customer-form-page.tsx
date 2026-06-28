"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { primaryActionClassName } from "@/components/ui/styles";
import { clearStoredSession } from "@/features/auth/session";
import { isApiRequestError } from "@/lib/api";

import { createCustomer, getCustomer, updateCustomer } from "./customers-api";
import { CustomerStatusBadge, PageHeader, StatusPanel } from "./customer-ui";
import type { Customer, CustomerFormInput } from "./types";
import { customerManagerRoles } from "./types";
import { normalizeCustomerForm, validateCustomerForm, type CustomerFormErrors } from "./validation";

type CustomerFormPageProps =
  | {
      mode: "create";
    }
  | {
      customerId: string;
      mode: "edit";
    };

type LoadState = "loading" | "ready" | "error";

const initialForm: CustomerFormInput = {
  name: "",
  email: "",
  phone: "",
  billingAddress: ""
};

export function CustomerFormPage(props: CustomerFormPageProps) {
  return (
    <AppShell
      deniedMessage="Owner, Admin, or Accountant access is required to manage customers."
      requiredRoles={customerManagerRoles}
    >
      {({ accessToken }) => <CustomerFormContent accessToken={accessToken} {...props} />}
    </AppShell>
  );
}

function CustomerFormContent({
  accessToken,
  customerId,
  mode
}: {
  accessToken: string;
  customerId?: string;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [form, setForm] = useState<CustomerFormInput>(initialForm);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [state, setState] = useState<LoadState>(mode === "edit" ? "loading" : "ready");
  const [errors, setErrors] = useState<CustomerFormErrors>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (mode !== "edit" || !customerId) {
      return;
    }

    async function loadCustomer() {
      setState("loading");
      setPageError(null);

      try {
        const response = await getCustomer(accessToken, customerId!);
        setCustomer(response.customer);
        setForm({
          name: response.customer.name,
          email: response.customer.email,
          phone: response.customer.phone ?? "",
          billingAddress: response.customer.billingAddress ?? ""
        });
        setState("ready");
      } catch (loadError) {
        handleAuthError(loadError);
        setPageError(loadError instanceof Error ? loadError.message : "Could not load customer.");
        setState("error");
      }
    }

    void loadCustomer();
  }, [accessToken, customerId, mode]);

  function updateField(field: keyof CustomerFormInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPageError(null);
    setSuccess(null);

    const validationErrors = validateCustomerForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const normalized = normalizeCustomerForm(form);
      const response =
        mode === "create"
          ? await createCustomer(accessToken, normalized)
          : await updateCustomer(accessToken, customerId!, normalized);

      setSuccess(mode === "create" ? "Customer created." : "Customer updated.");
      router.push(`/customers/${response.customer.id}`);
    } catch (saveError) {
      handleAuthError(saveError);
      setPageError(saveError instanceof Error ? saveError.message : "Could not save customer.");
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
    return <StatusPanel message="Loading customer..." />;
  }

  if (state === "error") {
    return <StatusPanel message={pageError ?? "Could not load customer."} tone="error" />;
  }

  const isArchived = customer?.status === "archived";

  return (
    <section className="space-y-5">
      <PageHeader
        description={
          mode === "create"
            ? "Add a billing contact for future invoices."
            : "Update customer contact and billing details."
        }
        title={mode === "create" ? "New customer" : "Edit customer"}
      />

      {pageError ? <StatusPanel message={pageError} tone="error" /> : null}
      {success ? <StatusPanel message={success} tone="success" /> : null}
      {isArchived ? (
        <StatusPanel message="Archived customers are read-only in this MVP." tone="warning" />
      ) : null}

      <form
        className="max-w-3xl rounded-lg border border-slate-200 bg-white p-5"
        onSubmit={handleSubmit}
      >
        {customer ? (
          <div className="mb-5 flex items-center justify-between rounded-md bg-slate-50 p-3">
            <div>
              <p className="text-sm font-medium text-slate-950">{customer.name}</p>
              <p className="text-sm text-slate-600">{customer.email}</p>
            </div>
            <CustomerStatusBadge status={customer.status} />
          </div>
        ) : null}

        <div className="grid gap-4">
          <FieldError label="Name" error={errors.name}>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={isArchived || isSubmitting}
              onChange={(event) => updateField("name", event.target.value)}
              value={form.name}
            />
          </FieldError>

          <FieldError label="Email" error={errors.email}>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={isArchived || isSubmitting}
              onChange={(event) => updateField("email", event.target.value)}
              type="email"
              value={form.email}
            />
          </FieldError>

          <FieldError label="Phone" error={errors.phone}>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={isArchived || isSubmitting}
              onChange={(event) => updateField("phone", event.target.value)}
              placeholder="+2348010000001"
              value={form.phone ?? ""}
            />
          </FieldError>

          <FieldError label="Billing address" error={errors.billingAddress}>
            <textarea
              className="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={isArchived || isSubmitting}
              onChange={(event) => updateField("billingAddress", event.target.value)}
              value={form.billingAddress ?? ""}
            />
          </FieldError>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          <Link
            className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700"
            href={customer ? `/customers/${customer.id}` : "/customers"}
          >
            Cancel
          </Link>
          <button
            className={primaryActionClassName}
            disabled={isArchived || isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Saving..." : mode === "create" ? "Create customer" : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}

function FieldError({
  children,
  error,
  label
}: {
  children: ReactNode;
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
