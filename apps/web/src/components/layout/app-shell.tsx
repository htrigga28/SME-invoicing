"use client";

import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { getMe, logout } from "@/features/auth/auth-api";
import { clearStoredSession, getStoredSession } from "@/features/auth/session";
import type { MeResponse, Membership } from "@/features/auth/types";
import { getApiErrorMessage, isApiRequestError } from "@/lib/api";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export type AppShellContext = {
  accessToken: string;
  me: MeResponse;
};

type AppShellProps = {
  children: (context: AppShellContext) => React.ReactNode;
  deniedMessage?: string;
  requiredRoles?: readonly Membership["role"][];
};

type ShellState = "loading" | "ready" | "denied" | "error";

export function AppShell({ children, deniedMessage, requiredRoles }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [context, setContext] = useState<AppShellContext | null>(null);
  const [state, setState] = useState<ShellState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getStoredSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const sessionContext = {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken
    };

    getMe(sessionContext.accessToken)
      .then((response) => {
        if (response.onboardingRequired) {
          router.replace("/onboarding/business");
          return;
        }

        setContext({ accessToken: sessionContext.accessToken, me: response });

        if (requiredRoles?.length && !requiredRoles.includes(response.membership.role)) {
          setState("denied");
          return;
        }

        setState("ready");
      })
      .catch((loadError) => {
        if (isApiRequestError(loadError) && loadError.status === 401) {
          clearStoredSession();
          router.replace("/login");
          return;
        }

        setError(getApiErrorMessage(loadError, "Could not load workspace."));
        setState("error");
      });
  }, [requiredRoles, router]);

  async function handleLogout() {
    const session = getStoredSession();

    if (session) {
      await logout(session.refreshToken).catch(() => undefined);
    }

    clearStoredSession();
    router.push("/login");
  }

  if (state === "loading") {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading workspace...
        </p>
      </main>
    );
  }

  if (!context) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <StatusPanel message={error ?? "Could not load workspace."} tone="error" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 md:flex">
      <Sidebar activePath={pathname} role={context.me.membership.role} />
      <div className="min-w-0 flex-1">
        <Topbar activePath={pathname} me={context.me} onLogout={handleLogout} />
        <div className="px-4 py-6 lg:px-6">
          {state === "denied" ? (
            <StatusPanel
              message={deniedMessage ?? "You do not have access to this page."}
              tone="warning"
            />
          ) : null}
          {state === "error" ? (
            <StatusPanel message={error ?? "Could not load workspace."} tone="error" />
          ) : null}
          {state === "ready" ? children(context) : null}
        </div>
      </div>
    </main>
  );
}

function StatusPanel({ message, tone }: { message: string; tone: "error" | "warning" }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800"
  };

  return <section className={`rounded-lg border p-6 text-sm ${styles[tone]}`}>{message}</section>;
}
