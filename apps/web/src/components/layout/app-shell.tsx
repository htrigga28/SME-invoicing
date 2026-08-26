"use client";

import { usePathname, useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import React, { useEffect, useState } from "react";

import { LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { getMe, logout } from "@/features/auth/auth-api";
import { getOnboardingPath } from "@/features/auth/onboarding";
import { clearStoredSession, getStoredSession } from "@/features/auth/session";
import type { MeResponse, Membership } from "@/features/auth/types";
import { OnboardingProgress } from "@/features/onboarding/onboarding-progress";
import { getApiErrorMessage, isApiRequestError } from "@/lib/api";
import { cn } from "@/lib/cn";

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
const SIDEBAR_STORAGE_KEY = "sme-invoicing.sidebar-expanded";

export function AppShell({ children, deniedMessage, requiredRoles }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [context, setContext] = useState<AppShellContext | null>(null);
  const [state, setState] = useState<ShellState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  useEffect(() => {
    setSidebarExpanded(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
  }, []);

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
        const isAllowedPaymentSetupRoute =
          response.onboardingStep === "payment_setup" && pathname === "/settings/payment-setup";

        if (response.onboardingStep && !isAllowedPaymentSetupRoute) {
          router.replace(getOnboardingPath(response.onboardingStep));
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
  }, [pathname, requiredRoles, router]);

  async function handleLogout() {
    const session = getStoredSession();

    if (session) {
      await logout(session.refreshToken).catch(() => undefined);
    }

    clearStoredSession();
    router.push("/login");
  }

  if (state === "loading") {
    return <WorkspaceLoadingState />;
  }

  if (!context) {
    return (
      <main className="min-h-screen bg-[var(--background)] p-6 text-[var(--text-primary)]">
        <StatusPanel message={error ?? "Could not load workspace."} tone="error" />
      </main>
    );
  }

  if (context.me.onboardingStep === "payment_setup") {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--text-primary)] sm:px-6">
        <section className="mx-auto w-full max-w-4xl">
          <OnboardingProgress currentStep={3} />
          <div className="mt-8">{children(context)}</div>
        </section>
      </main>
    );
  }

  return (
    <main
      className={cn(
        "min-h-screen bg-[var(--background)] text-[var(--text-primary)] transition-[padding] duration-200 ease-out",
        sidebarExpanded ? "md:pl-64" : "md:pl-20"
      )}
    >
      <Sidebar
        activePath={pathname}
        expanded={sidebarExpanded}
        onToggle={() => {
          setSidebarExpanded((current) => {
            const next = !current;
            window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
            return next;
          });
        }}
        role={context.me.membership.role}
      />
      <div className="min-w-0 flex-1">
        <Topbar activePath={pathname} me={context.me} onLogout={handleLogout} />
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 pb-24 lg:px-6">
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

function WorkspaceLoadingState() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <aside
        aria-hidden="true"
        className="fixed inset-y-0 left-0 z-40 hidden w-20 border-r border-[var(--border-subtle)] bg-[var(--background-deep)] md:block"
      >
        <div className="flex h-16 items-center justify-center border-b border-[var(--border-subtle)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--accent-border-subtle)] bg-[var(--accent-muted)] text-sm font-black text-[var(--accent)]">
            SI
          </div>
        </div>
        <div className="space-y-3 px-3 py-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              className="h-11 w-14 animate-pulse rounded-[var(--radius-control)] bg-[var(--surface-raised)]"
              key={index}
            />
          ))}
        </div>
      </aside>
      <div className="md:pl-20">
        <header className="border-b border-[var(--border-subtle)] bg-[var(--topbar-background)]">
          <div className="mx-auto flex min-h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-4 lg:px-6">
            <div className="space-y-2">
              <div className="h-3 w-44 animate-pulse rounded-full bg-[var(--surface-raised)]" />
              <div className="h-2.5 w-60 animate-pulse rounded-full bg-[var(--surface-raised)]" />
            </div>
            <div className="h-9 w-24 animate-pulse rounded-[var(--radius-control)] bg-[var(--surface-raised)]" />
          </div>
        </header>
        <div
          aria-busy="true"
          aria-label="Loading workspace"
          className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-8 pb-24 lg:px-6"
          role="status"
        >
          <div className="space-y-3">
            <div className="h-9 w-52 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
            <p className="text-sm text-[var(--text-muted)]">Preparing your workspace</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                className="h-32 animate-pulse rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)]"
                key={index}
              />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)]" />
        </div>
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
