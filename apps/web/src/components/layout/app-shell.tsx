"use client";

import { usePathname, useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import React, { useEffect, useState } from "react";

import { LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
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
      <main className="min-h-screen bg-[var(--background)] p-6 text-[var(--text-primary)]">
        <Alert>Loading workspace...</Alert>
      </main>
    );
  }

  if (!context) {
    return (
      <main className="min-h-screen bg-[var(--background)] p-6 text-[var(--text-primary)]">
        <StatusPanel message={error ?? "Could not load workspace."} tone="error" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] md:pl-20">
      <Sidebar activePath={pathname} role={context.me.membership.role} />
      <div className="min-w-0 flex-1">
        <Topbar activePath={pathname} me={context.me} onLogout={handleLogout} />
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 pb-24 lg:px-6">
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
        <CreateInvoiceQuickAction pathname={pathname} role={context.me.membership.role} />
      </div>
    </main>
  );
}

function StatusPanel({ message, tone }: { message: string; tone: "error" | "warning" }) {
  return <Alert tone={tone}>{message}</Alert>;
}

function CreateInvoiceQuickAction({
  pathname,
  role
}: {
  pathname: string;
  role: Membership["role"];
}) {
  if (role === "viewer") {
    return null;
  }

  const shouldShow =
    pathname === "/dashboard" ||
    pathname === "/customers" ||
    pathname === "/invoices" ||
    pathname.startsWith("/customers?");

  if (!shouldShow) {
    return null;
  }

  return (
    <LinkButton
      className="fixed bottom-4 right-4 z-30 rounded-full px-4 shadow-none md:bottom-6 md:right-6"
      href="/invoices/new"
      size="lg"
    >
      <FilePlus2 aria-hidden="true" className="h-4 w-4" />
      Create Invoice
    </LinkButton>
  );
}
