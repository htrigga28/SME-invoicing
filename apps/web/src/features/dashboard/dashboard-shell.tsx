"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getMe, logout } from "@/features/auth/auth-api";
import { clearStoredSession, getStoredSession } from "@/features/auth/session";
import type { MeResponse } from "@/features/auth/types";

export function DashboardShell() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = getStoredSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    getMe(session.accessToken)
      .then((response) => {
        if (response.onboardingRequired) {
          router.replace("/onboarding/business");
          return;
        }

        setMe(response);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load dashboard.");
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  async function handleLogout() {
    const session = getStoredSession();

    if (session) {
      await logout(session.refreshToken).catch(() => undefined);
    }

    clearStoredSession();
    router.push("/login");
  }

  if (isLoading) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading dashboard...
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</p>
    );
  }

  if (!me) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
            Dashboard shell
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {me.businessProfile.businessName ?? me.activeOrganisation.name}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Auth, tenant context, RBAC foundation, and business onboarding are active. Dashboard
            metrics will be implemented in a later task.
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          onClick={handleLogout}
          type="button"
        >
          Logout
        </button>
      </div>
    </section>
  );
}
