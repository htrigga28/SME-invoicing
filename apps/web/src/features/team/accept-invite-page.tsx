"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FieldLabel, FormField, Input } from "@/components/ui/form";
import { getMe } from "@/features/auth/auth-api";
import { clearStoredSession, getStoredSession, setStoredSession } from "@/features/auth/session";
import type { MeResponse } from "@/features/auth/types";

import { acceptInvitation, previewInvitation } from "./team-api";
import type { InvitationPreview } from "./types";
import { validateAcceptInviteForm } from "./validation";

type PageState = "loading" | "ready" | "invalid" | "success";

export function AcceptInvitePage({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const invitationPreview = await previewInvitation(token);
        setPreview(invitationPreview);

        const session = getStoredSession();

        if (session) {
          try {
            const currentUser = await getMe(session.accessToken);
            setMe(currentUser);
          } catch {
            clearStoredSession();
          }
        }

        setState("ready");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Invitation is not valid.");
        setState("invalid");
      }
    }

    void load();
  }, [token]);

  async function handleAcceptExisting() {
    const session = getStoredSession();

    if (!session) {
      setError("Login with the invited email before accepting as an existing user.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await acceptInvitation(token, { mode: "existing" }, session.accessToken);
      setStoredSession({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      });
      setState("success");
      router.replace(response.onboardingRequired ? "/onboarding/business" : "/dashboard");
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Could not accept invitation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const errors = validateAcceptInviteForm({ name, password });

    if (Object.keys(errors).length > 0) {
      setError(Object.values(errors)[0] ?? "Check the account form.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await acceptInvitation(token, { mode: "new", name, password });
      setStoredSession({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      });
      setState("success");
      router.replace(response.onboardingRequired ? "/onboarding/business" : "/dashboard");
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Could not accept invitation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (state === "loading") {
    return <InvitePanel title="Loading invitation" message="Checking invitation details..." />;
  }

  if (state === "invalid" || !preview) {
    return (
      <InvitePanel
        title="Invitation unavailable"
        message={error ?? "This invitation is invalid, expired, revoked, or already accepted."}
        tone="error"
      />
    );
  }

  const invitedEmail = preview.invitation.email;
  const emailMatches = me?.user.email.toLowerCase() === invitedEmail.toLowerCase();

  return (
    <section className="mx-auto w-full max-w-xl rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-document)] sm:p-8">
      <BrandLogo className="mb-5" />
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
        Team invitation
      </p>
      <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
        Join {preview.invitation.organisationName}
      </h1>
      <dl className="mt-4 space-y-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-secondary)]">Email</dt>
          <dd className="break-words text-right font-medium text-[var(--text-primary)] [overflow-wrap:anywhere]">
            {invitedEmail}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-secondary)]">Role</dt>
          <dd className="font-medium capitalize text-[var(--text-primary)]">
            {preview.invitation.role}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-secondary)]">Expires</dt>
          <dd className="tabular-nums text-[var(--text-primary)]">
            {new Date(preview.invitation.expiresAt).toLocaleDateString()}
          </dd>
        </div>
      </dl>

      {error ? (
        <Alert className="mt-4" role="alert" tone="error">
          {error}
        </Alert>
      ) : null}

      {me ? (
        <div className="mt-6 space-y-3">
          {emailMatches ? (
            <>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                You are logged in as {me.user.email}. Accept this invitation to join the existing
                organisation.
              </p>
              <Button
                className="w-full"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                loadingLabel="Accepting..."
                onClick={() => void handleAcceptExisting()}
                size="lg"
                type="button"
              >
                Accept invitation
              </Button>
            </>
          ) : (
            <Alert tone="warning">
              You are logged in as {me.user.email}. Logout and login as {invitedEmail} to accept
              this invitation.
            </Alert>
          )}
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleCreateAccount}>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Create an account for the invited email, or login first if you already have an account.
          </p>
          <div>
            <FormField>
              <FieldLabel>Invited email</FieldLabel>
              <Input className="mt-1" disabled value={invitedEmail} />
            </FormField>
          </div>
          <div>
            <FormField>
              <FieldLabel>Name</FieldLabel>
              <Input
                autoComplete="name"
                className="mt-1"
                id="accept-invite-name"
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </FormField>
          </div>
          <div>
            <FormField>
              <FieldLabel>Password</FieldLabel>
              <Input
                autoComplete="new-password"
                className="mt-1"
                id="accept-invite-password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </FormField>
          </div>
          <Button
            className="w-full"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            loadingLabel="Creating account..."
            size="lg"
            type="submit"
          >
            Create account and accept
          </Button>
        </form>
      )}
    </section>
  );
}

function InvitePanel({
  message,
  title,
  tone = "info"
}: {
  message: string;
  title: string;
  tone?: "error" | "info";
}) {
  return (
    <section className="mx-auto w-full max-w-xl rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-document)] sm:p-8">
      <BrandLogo className="mb-5" />
      <h1
        className={`text-2xl font-semibold tracking-tight ${
          tone === "error" ? "text-[var(--danger)]" : "text-[var(--text-primary)]"
        }`}
      >
        {title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{message}</p>
    </section>
  );
}
