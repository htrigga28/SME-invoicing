"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { FormEvent, useRef, useState } from "react";

import { Alert } from "@/components/ui/feedback";
import { FieldError, FieldHint, FieldLabel, FormField, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import { register } from "./auth-api";
import { setStoredSession } from "./session";
import { isSubmitDisabled, validateRegisterForm } from "./validation";

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateRegisterForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const firstInvalidField = (["name", "email", "password"] as const).find(
        (field) => nextErrors[field]
      );
      const refs = { name: nameRef, email: emailRef, password: passwordRef };
      refs[firstInvalidField ?? "name"].current?.focus();
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await register(form);
      setStoredSession({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      });
      router.push("/onboarding/business");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <FormField>
          <FieldLabel>Name</FieldLabel>
          <Input
            aria-describedby={errors.name ? "register-name-error" : undefined}
            aria-invalid={Boolean(errors.name)}
            autoComplete="name"
            className="mt-1"
            id="register-name"
            ref={nameRef}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </FormField>
        {errors.name ? <FieldError id="register-name-error">{errors.name}</FieldError> : null}
      </div>

      <div>
        <FormField>
          <FieldLabel>Email</FieldLabel>
          <Input
            aria-describedby={errors.email ? "register-email-error" : "register-email-hint"}
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            className="mt-1"
            id="register-email"
            inputMode="email"
            ref={emailRef}
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
        </FormField>
        {!errors.email ? (
          <FieldHint id="register-email-hint">
            Use the email you want tied to this workspace.
          </FieldHint>
        ) : null}
        {errors.email ? <FieldError id="register-email-error">{errors.email}</FieldError> : null}
      </div>

      <div>
        <FormField>
          <FieldLabel>Password</FieldLabel>
          <Input
            aria-describedby={
              errors.password ? "register-password-error" : "register-password-hint"
            }
            aria-invalid={Boolean(errors.password)}
            autoComplete="new-password"
            className="mt-1"
            id="register-password"
            ref={passwordRef}
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({ ...current, password: event.target.value }))
            }
          />
        </FormField>
        {!errors.password ? (
          <FieldHint id="register-password-hint">Use at least 8 characters.</FieldHint>
        ) : null}
        {errors.password ? (
          <FieldError id="register-password-error">{errors.password}</FieldError>
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
        loadingLabel="Creating account..."
        size="lg"
        type="submit"
      >
        Create account
      </Button>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link className="font-medium text-teal-700" href="/login">
          Login
        </Link>
      </p>
    </form>
  );
}
