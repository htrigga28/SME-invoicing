"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { primaryActionClassName } from "@/components/ui/styles";

import { login } from "./auth-api";
import { setStoredSession } from "./session";
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
      setStoredSession({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      });
      router.push(response.onboardingRequired ? "/onboarding/business" : "/dashboard");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Email</span>
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
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          type="password"
          value={form.password}
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
        />
        {errors.password ? (
          <span className="mt-1 block text-sm text-red-600">{errors.password}</span>
        ) : null}
      </label>

      {submitError ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{submitError}</p>
      ) : null}

      <button
        className={`${primaryActionClassName} w-full`}
        disabled={isSubmitDisabled(isSubmitting)}
        type="submit"
      >
        {isSubmitting ? "Signing in..." : "Login"}
      </button>

      <p className="text-center text-sm text-slate-600">
        New here?{" "}
        <Link className="font-medium text-teal-700" href="/register">
          Create an account
        </Link>
      </p>
    </form>
  );
}
