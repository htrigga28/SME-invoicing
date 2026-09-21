"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FieldError, FormField, FieldLabel, Input } from "@/components/ui/form";

import { login, selectOrganisation } from "./auth-api";
import { getOnboardingPath } from "./onboarding";
import {
  getStoredSession,
  scrubLegacyStoredSession,
  setStoredOrganisationId,
  setStoredSession
} from "./session";
import type { OrganisationMembership } from "./types";
import { isSubmitDisabled, validateLoginForm } from "./validation";

export function LoginForm() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workspaceChoices, setWorkspaceChoices] = useState<OrganisationMembership[] | null>(null);

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
      scrubLegacyStoredSession();

      // Multi-workspace users choose explicitly; the API never selects a
      // workspace silently on login.
      if (response.selectionRequired) {
        setWorkspaceChoices(response.organisations);
        return;
      }

      setStoredOrganisationId(response.activeOrganisation.id);
      router.push(getOnboardingPath(response.onboardingStep));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleWorkspaceChoice(organisationId: string) {
    setSubmitError(null);

    try {
      const session = getStoredSession();

      if (!session) {
        setSubmitError("Your session expired. Please log in again.");
        setWorkspaceChoices(null);
        return;
      }

      const response = await selectOrganisation(session.accessToken, organisationId);
      setStoredOrganisationId(organisationId);
      router.push(getOnboardingPath(response.onboardingStep));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Workspace selection failed.");
    }
  }

  if (workspaceChoices) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Choose a workspace</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Your account belongs to more than one workspace. Select one to continue.
        </p>
        <div className="space-y-2">
          {workspaceChoices.map(({ organisation, membership }) => (
            <Button
              key={organisation.id}
              className="w-full justify-start"
              onClick={() => handleWorkspaceChoice(organisation.id)}
              type="button"
              variant="outline"
            >
              {organisation.name} · {membership.role}
            </Button>
          ))}
        </div>
        {submitError ? (
          <Alert role="alert" tone="error">
            {submitError}
          </Alert>
        ) : null}
      </div>
    );
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
