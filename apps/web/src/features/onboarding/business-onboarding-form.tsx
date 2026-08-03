"use client";

import { useRouter } from "next/navigation";
import React, { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, ErrorState, LoadingSkeleton } from "@/components/ui/feedback";
import {
  FieldError,
  FieldHint,
  FieldLabel,
  FormField,
  Input,
  Textarea
} from "@/components/ui/form";
import { getMe, updateBusinessProfile } from "@/features/auth/auth-api";
import { getOnboardingPath } from "@/features/auth/onboarding";
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
  const [requiresManager, setRequiresManager] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const businessNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const session = getStoredSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    getMe(session.accessToken)
      .then((response) => {
        if (response.onboardingStep !== "business_profile") {
          router.replace(getOnboardingPath(response.onboardingStep));
          return;
        }

        if (response.membership.role !== "owner" && response.membership.role !== "admin") {
          setRequiresManager(true);
          return;
        }

        const { businessProfile } = response;
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
      const firstInvalidField = (["businessName", "email", "phone", "address"] as const).find(
        (field) => nextErrors[field]
      );
      const refs = {
        businessName: businessNameRef,
        email: emailRef,
        phone: phoneRef,
        address: addressRef
      };
      refs[firstInvalidField ?? "businessName"].current?.focus();
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
    return <LoadingSkeleton rows={4} />;
  }

  if (loadError) {
    return <ErrorState message={loadError} title="Could not load your business profile" />;
  }

  if (requiresManager) {
    return (
      <Alert tone="warning" title="An Owner or Admin must finish setup">
        Your workspace is still being configured. Ask an Owner or Admin to complete the business
        profile before you continue.
      </Alert>
    );
  }

  return (
    <Card className="p-6">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <FormField>
            <FieldLabel>Business name</FieldLabel>
            <Input
              aria-describedby={errors.businessName ? "business-name-error" : "business-name-hint"}
              aria-invalid={Boolean(errors.businessName)}
              autoComplete="organization"
              className="mt-1"
              id="business-name"
              ref={businessNameRef}
              value={form.businessName}
              onChange={(event) =>
                setForm((current) => ({ ...current, businessName: event.target.value }))
              }
            />
          </FormField>
          {!errors.businessName ? (
            <FieldHint id="business-name-hint">
              This name appears on invoices and receipts.
            </FieldHint>
          ) : null}
          {errors.businessName ? (
            <FieldError id="business-name-error">{errors.businessName}</FieldError>
          ) : null}
        </div>

        <div>
          <FormField>
            <FieldLabel>Business email</FieldLabel>
            <Input
              aria-describedby={errors.email ? "business-email-error" : undefined}
              aria-invalid={Boolean(errors.email)}
              autoComplete="email"
              className="mt-1"
              id="business-email"
              inputMode="email"
              ref={emailRef}
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
            />
          </FormField>
          {errors.email ? <FieldError id="business-email-error">{errors.email}</FieldError> : null}
        </div>

        <div>
          <FormField>
            <FieldLabel>Phone</FieldLabel>
            <Input
              aria-describedby={errors.phone ? "business-phone-error" : undefined}
              aria-invalid={Boolean(errors.phone)}
              autoComplete="tel"
              className="mt-1"
              id="business-phone"
              inputMode="tel"
              ref={phoneRef}
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </FormField>
          {errors.phone ? <FieldError id="business-phone-error">{errors.phone}</FieldError> : null}
        </div>

        <div>
          <FormField>
            <FieldLabel>Business address</FieldLabel>
            <Textarea
              aria-describedby={errors.address ? "business-address-error" : undefined}
              aria-invalid={Boolean(errors.address)}
              autoComplete="street-address"
              className="mt-1"
              id="business-address"
              ref={addressRef}
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: event.target.value }))
              }
            />
          </FormField>
          {errors.address ? (
            <FieldError id="business-address-error">{errors.address}</FieldError>
          ) : null}
        </div>

        {submitError ? (
          <Alert role="alert" tone="error">
            {submitError}
          </Alert>
        ) : null}

        <Button
          disabled={isSubmitDisabled(isSubmitting)}
          isLoading={isSubmitting}
          loadingLabel="Saving business profile..."
          size="lg"
          type="submit"
        >
          Continue to Payment Setup
        </Button>
      </form>
    </Card>
  );
}
