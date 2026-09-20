"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FieldError, FormField, FieldLabel, Input } from "@/components/ui/form";

import { login } from "./auth-api";
import { getOnboardingPath } from "./onboarding";
import { scrubLegacyStoredSession, setStoredOrganisationId, setStoredSession } from "./session";
import { isSubmitDisabled, validateLoginForm } from "./validation";

export function LoginForm() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateLoginForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await login(form);
      // The API also sets the HttpOnly refresh cookie; only the
      // short-lived access token is kept here, in memory.
      setStoredSession({ accessToken: response.accessToken });
      setStoredOrganisationId(response.activeOrganisation.id);
      scrubLegacyStoredSession();
      router.push(getOnboardingPath(response.onboardingStep));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <FormField>
          <FieldLabel>Email</FieldLabel>
          <Input
            aria-describedby={errors.email ? "login-email-error" : undefined}
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            className="mt-1"
            id="login-email"
            inputMode="email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
        </FormField>
        {errors.email ? <FieldError id="login-email-error">{errors.email}</FieldError> : null}
      </div>

      <div>
        <FormField>
          <FieldLabel>Password</FieldLabel>
          <Input
            aria-describedby={errors.password ? "login-password-error" : undefined}
            aria-invalid={Boolean(errors.password)}
            autoComplete="current-password"
            className="mt-1"
            id="login-password"
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({ ...current, password: event.target.value }))
            }
          />
        </FormField>
        {errors.password ? (
          <FieldError id="login-password-error">{errors.password}</FieldError>
        ) : null}
      </div>

      {submitError ? (
        <Alert role="alert" tone="error">
          {submitError}
        </Alert>
      ) : null}

      <Button
        className="w-full"
        disabled={isSubmitDisabled(isSubmitting)}
        isLoading={isSubmitting}
        loadingLabel="Signing in..."
        size="lg"
        type="submit"
      >
        Login
      </Button>

      <p className="text-center text-sm text-[var(--text-secondary)]">
        New here?{" "}
        <Link
          className="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] hover:underline"
          href="/register"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
