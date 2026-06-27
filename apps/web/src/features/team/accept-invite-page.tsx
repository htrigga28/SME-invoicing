"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
    <section className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium uppercase tracking-wide text-teal-700">Team invitation</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-950">
        Join {preview.invitation.organisationName}
      </h1>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p>
          <strong>Email:</strong> {invitedEmail}
        </p>
        <p>
          <strong>Role:</strong> {preview.invitation.role}
        </p>
        <p>
          <strong>Expires:</strong> {new Date(preview.invitation.expiresAt).toLocaleDateString()}
        </p>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {me ? (
        <div className="mt-6 space-y-3">
          {emailMatches ? (
            <>
              <p className="text-sm text-slate-600">
                You are logged in as {me.user.email}. Accept this invitation to join the existing
                organisation.
              </p>
              <button
                className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                disabled={isSubmitting}
                onClick={() => void handleAcceptExisting()}
                type="button"
              >
                {isSubmitting ? "Accepting..." : "Accept invitation"}
              </button>
            </>
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              You are logged in as {me.user.email}. Logout and login as {invitedEmail} to accept
              this invitation.
            </p>
          )}
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleCreateAccount}>
          <p className="text-sm text-slate-600">
            Create an account for the invited email, or login first if you already have an account.
          </p>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Invited email</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600"
              disabled
              value={invitedEmail}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <button
            className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Creating account..." : "Create account and accept"}
          </button>
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
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    info: "border-slate-200 bg-white text-slate-700"
  };

  return (
    <section className={`mx-auto max-w-xl rounded-lg border p-6 ${styles[tone]}`}>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm">{message}</p>
    </section>
  );
}
