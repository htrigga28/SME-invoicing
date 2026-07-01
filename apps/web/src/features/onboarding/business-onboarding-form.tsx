"use client";

import { useRouter } from "next/navigation";
import React, { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { primaryActionClassName } from "@/components/ui/styles";
import { getBusinessProfile, updateBusinessProfile } from "@/features/auth/auth-api";
import { getStoredSession } from "@/features/auth/session";
import { isSubmitDisabled, validateBusinessProfileForm } from "@/features/auth/validation";
import { getApiErrorMessage } from "@/lib/api";

type FormState = {
  businessName: string;
  email: string;
  phone: string;
  address: string;
};

export function BusinessOnboardingForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    businessName: "",
    email: "",
    phone: "",
    address: ""
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const session = getStoredSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    getBusinessProfile(session.accessToken)
      .then(({ businessProfile }) => {
        setForm({
          businessName: businessProfile.businessName ?? "",
          email: businessProfile.email ?? "",
          phone: businessProfile.phone ?? "",
          address: businessProfile.address ?? ""
        });
      })
      .catch((error) => {
        setLoadError(getApiErrorMessage(error, "Could not load business profile."));
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateBusinessProfileForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const session = getStoredSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await updateBusinessProfile(session.accessToken, form);
      toast.success("Business profile completed. Next, activate online payments.");
      router.push("/settings/payment-setup?source=onboarding");
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, "Could not update business profile."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading profile...
      </p>
    );
  }

  if (loadError) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {loadError}
      </p>
    );
  }

  return (
    <form
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      onSubmit={handleSubmit}
    >
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Business name</span>
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={form.businessName}
          onChange={(event) =>
            setForm((current) => ({ ...current, businessName: event.target.value }))
          }
        />
        {errors.businessName ? (
          <span className="mt-1 block text-sm text-red-600">{errors.businessName}</span>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Business email</span>
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          type="email"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
        />
        {errors.email ? (
          <span className="mt-1 block text-sm text-red-600">{errors.email}</span>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Phone</span>
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={form.phone}
          onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
        />
        {errors.phone ? (
          <span className="mt-1 block text-sm text-red-600">{errors.phone}</span>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Address</span>
        <textarea
          className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={form.address}
          onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
        />
        {errors.address ? (
          <span className="mt-1 block text-sm text-red-600">{errors.address}</span>
        ) : null}
      </label>

      {submitError ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{submitError}</p>
      ) : null}

      <button
        className={primaryActionClassName}
        disabled={isSubmitDisabled(isSubmitting)}
        type="submit"
      >
        {isSubmitting ? "Saving..." : "Complete business profile"}
      </button>
    </form>
  );
}
