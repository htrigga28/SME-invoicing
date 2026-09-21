"use client";

import { usePathname, useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import React, { createContext, useContext, useEffect, useState } from "react";

import { LinkButton } from "@/components/ui/button";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { getMe, getOrganisations, logout, refresh } from "@/features/auth/auth-api";
import { getOnboardingPath } from "@/features/auth/onboarding";
import {
  clearStoredSession,
  clearStoredOrganisationId,
  getLegacyStoredSession,
  getStoredOrganisationId,
  getStoredSession,
  scrubLegacyStoredSession,
  setStoredOrganisationId,
  setStoredSession,
  subscribeToStoredSession
} from "@/features/auth/session";
import type { MeResponse, Membership, OrganisationMembership } from "@/features/auth/types";
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
  children: ((context: AppShellContext) => React.ReactNode) | React.ReactNode;
  deniedMessage?: string;
  requiredRoles?: readonly Membership["role"][];
};

type ShellState = "loading" | "ready" | "denied" | "error" | "workspace_choice";
const SIDEBAR_STORAGE_KEY = "sme-invoicing.sidebar-expanded";
const ME_CACHE_TTL_MS = 30_000;

const meCache = new Map<string, { loadedAt: number; response: MeResponse }>();

export function __clearAppShellMeCacheForTests() {
  meCache.clear();
}

const AppShellContextProvider = createContext<AppShellContext | null>(null);

export function AppShell({ children, deniedMessage, requiredRoles }: AppShellProps) {
  const parentContext = useContext(AppShellContextProvider);

  if (parentContext) {
    const isDenied =
      requiredRoles?.length && !requiredRoles.includes(parentContext.me.membership.role);

    if (isDenied) {
      return (
        <StatusPanel
          message={deniedMessage ?? "You do not have access to this page."}
          tone="warning"
        />
      );
    }

    return <>{renderShellChildren(children, parentContext)}</>;
  }

  return (
    <WorkspaceShell
      deniedMessage={deniedMessage}
      requiredRoles={requiredRoles}
      renderChildren={(context) => renderShellChildren(children, context)}
    />
  );
}

function WorkspaceShell({
  deniedMessage,
  requiredRoles,
  renderChildren
}: {
  deniedMessage?: string | undefined;
  requiredRoles?: readonly Membership["role"][] | undefined;
  renderChildren: (context: AppShellContext) => React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [context, setContext] = useState<AppShellContext | null>(null);
  const [state, setState] = useState<ShellState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [workspaceChoices, setWorkspaceChoices] = useState<OrganisationMembership[]>([]);

  useEffect(() => {
    setSidebarExpanded(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
  }, []);

  useEffect(
    () =>
      subscribeToStoredSession((session) => {
        if (session) {
          setContext((current) =>
            current ? { ...current, accessToken: session.accessToken } : current
          );
        }
      }),
    []
  );

  useEffect(() => {
    async function boot() {
      let session = getStoredSession();
      const legacySession = getLegacyStoredSession();

      if (!session) {
        try {
          // The API gives a valid refresh cookie priority over the legacy body
          // token. This first boot can therefore migrate an old browser or use
          // a cookie set by an earlier, interrupted migration.
          const refreshed = await refresh(legacySession?.refreshToken);
          setStoredSession({ accessToken: refreshed.accessToken });
          session = getStoredSession();
        } catch (refreshError) {
          if (legacySession) {
            setError(
              getApiErrorMessage(
                refreshError,
                "Your previous session could not be upgraded. Please try again or log in."
              )
            );
            setState("error");
            return;
          }
          router.replace("/login");
          return;
        }
      }

      if (!session) {
        router.replace("/login");
        return;
      }

      const accessToken = session.accessToken;
      const storedOrganisationId = getStoredOrganisationId() ?? undefined;

      // No silent workspace default: without a stored selection the shell
      // resolves memberships explicitly (single auto-select, otherwise an
      // explicit chooser) instead of rendering the oldest workspace.
      if (!storedOrganisationId) {
        await recoverStaleWorkspace(accessToken, Boolean(legacySession));
        return;
      }

      const cacheKey = `${accessToken}:${storedOrganisationId ?? ""}`;
      const cached = meCache.get(cacheKey);
      if (cached && Date.now() - cached.loadedAt < ME_CACHE_TTL_MS) {
        applyWorkspaceResponse(accessToken, cached.response, Boolean(legacySession));
        return;
      }

      try {
        const response = await getMe(accessToken, storedOrganisationId);
        meCache.set(cacheKey, { loadedAt: Date.now(), response });
        applyWorkspaceResponse(accessToken, response, Boolean(legacySession));
      } catch (loadError) {
        if (
          isApiRequestError(loadError) &&
          loadError.status === 403 &&
          storedOrganisationId
        ) {
          await recoverStaleWorkspace(accessToken, Boolean(legacySession));
          return;
        }

        if (isApiRequestError(loadError) && loadError.status === 401) {
          meCache.delete(cacheKey);
          clearStoredSession();
          router.replace("/login");
          return;
        }

        setError(getApiErrorMessage(loadError, "Could not load workspace."));
        setState("error");
      }
    }

    void boot();

    function applyWorkspaceResponse(
      accessToken: string,
      response: MeResponse,
      migratedLegacySession = false
    ) {
      setContext({ accessToken, me: response });
      if (migratedLegacySession) {
        // Keep the old storage until the cookie exchange and this active
        // application context both exist.
        scrubLegacyStoredSession();
      }

      const isAllowedPaymentSetupRoute =
        response.onboardingStep === "payment_setup" && pathname === "/settings/payment-setup";

      if (response.onboardingStep && !isAllowedPaymentSetupRoute) {
        router.replace(getOnboardingPath(response.onboardingStep));
        return;
      }

      if (requiredRoles?.length && !requiredRoles.includes(response.membership.role)) {
        setState("denied");
        return;
      }

      setState("ready");
    }

    async function recoverStaleWorkspace(accessToken: string, migratedLegacySession = false) {
      meCache.clear();

      try {
        // This request deliberately omits x-organisation-id. The stale value
        // must not participate in membership recovery.
        const { organisations } = await getOrganisations(accessToken, null);

        if (organisations.length === 0) {
          clearStoredOrganisationId();
          clearStoredSession();
          router.replace("/login");
          return;
        }

        if (organisations.length === 1) {
          const first = organisations[0];
          if (!first) {
            clearStoredOrganisationId();
            clearStoredSession();
            router.replace("/login");
            return;
          }
          const organisationId = first.organisation.id;
          setStoredOrganisationId(organisationId);
          const response = await getMe(accessToken, organisationId);
          meCache.set(`${accessToken}:${organisationId}`, { loadedAt: Date.now(), response });
          applyWorkspaceResponse(accessToken, response, migratedLegacySession);
          return;
        }

        clearStoredOrganisationId();
        setWorkspaceChoices(organisations);
        setState("workspace_choice");
      } catch (recoveryError) {
        setError(getApiErrorMessage(recoveryError, "Could not recover your workspace selection."));
        setState("error");
      }
    }
  }, [pathname, requiredRoles, retryCount, router]);

  async function handleLogout() {
    // Cookie-authenticated: the server clears the refresh cookie and revokes
    // the session. Local state is cleared regardless for consistent UX.
    await logout().catch(() => undefined);

    clearStoredSession();
    meCache.clear();
    router.push("/login");
  }

  function handleWorkspaceChoice(organisationId: string) {
    setStoredOrganisationId(organisationId);
    setWorkspaceChoices([]);
    setError(null);
    setState("loading");
    setRetryCount((current) => current + 1);
  }

  if (state === "loading") {
    return <WorkspaceLoadingState />;
  }

  if (!context) {
    if (state === "workspace_choice") {
      return (
        <WorkspaceChooser
          onSelect={handleWorkspaceChoice}
          organisations={workspaceChoices}
        />
      );
    }

    return (
      <main className="min-h-screen bg-[var(--background)] p-6 text-[var(--text-primary)]">
        <ErrorState
          className="mx-auto mt-16 max-w-2xl"
          detail="Your workspace data can’t be displayed until the connection returns. Try again now, or wait a moment before retrying."
          message={error ?? "Lumina could not reach the service that loads your business data."}
          onRetry={() => {
            setError(null);
            setState("loading");
            setRetryCount((current) => current + 1);
          }}
          title="We can’t load your workspace right now"
        />
      </main>
    );
  }

  if (context.me.onboardingStep === "payment_setup") {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--text-primary)] sm:px-6">
        <section className="mx-auto w-full max-w-4xl">
          <OnboardingProgress currentStep={3} />
          <AppShellContextProvider.Provider value={context}>
            <div className="mt-8">{renderChildren(context)}</div>
          </AppShellContextProvider.Provider>
        </section>
      </main>
    );
  }

  return (
    <main
      className={cn(
        "min-h-screen bg-[var(--background)] text-[var(--text-primary)] transition-[padding] duration-150 ease-out",
        sidebarExpanded ? "md:pl-60" : "md:pl-20"
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
      <AppShellContextProvider.Provider value={context}>
        <div className="min-w-0 flex-1">
          <Topbar
            accessToken={context.accessToken}
            activePath={pathname}
            me={context.me}
            onLogout={handleLogout}
          />
          <div className="mx-auto w-full max-w-[1280px] px-4 py-6 pb-24 md:px-6 lg:px-8">
            {state === "denied" ? (
              <StatusPanel
                message={deniedMessage ?? "You do not have access to this page."}
                tone="warning"
              />
            ) : null}
            {state === "error" ? (
              <StatusPanel message={error ?? "Could not load workspace."} tone="error" />
            ) : null}
            {state === "ready" ? renderChildren(context) : null}
          </div>
          <CreateInvoiceQuickAction pathname={pathname} role={context.me.membership.role} />
        </div>
      </AppShellContextProvider.Provider>
    </main>
  );
}

function WorkspaceChooser({
  onSelect,
  organisations
}: {
  onSelect: (organisationId: string) => void;
  organisations: OrganisationMembership[];
}) {
  return (
    <main className="min-h-screen bg-[var(--background)] p-6 text-[var(--text-primary)]">
      <section className="mx-auto mt-16 w-full max-w-lg rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-document)]">
        <h1 className="text-xl font-semibold">Choose a workspace</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Your previous workspace is no longer available. Choose an active workspace to continue.
        </p>
        <div className="mt-5 space-y-2">
          {organisations.map(({ membership, organisation }) => (
            <button
              className="w-full rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 py-3 text-left hover:bg-[var(--surface-raised)]"
              key={organisation.id}
              onClick={() => onSelect(organisation.id)}
              type="button"
            >
              <span className="block font-medium">{organisation.name}</span>
              <span className="block text-sm capitalize text-[var(--text-muted)]">
                {membership.role}
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function renderShellChildren(
  children: AppShellProps["children"],
  context: AppShellContext
): React.ReactNode {
  return typeof children === "function" ? children(context) : children;
}

function WorkspaceLoadingState() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-[var(--accent-muted)]"
      >
        <div className="h-full w-2/5 animate-pulse bg-[var(--accent)]" />
      </div>
      <div
        aria-busy="true"
        aria-label="Loading page"
        className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-8 pb-24 lg:px-6"
        role="status"
      >
        <div className="space-y-3">
          <div className="h-9 w-52 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
          <p className="text-sm text-[var(--text-muted)]">Preparing this page</p>
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

  // Contextual primary actions live in page headers on desktop;
  // keep a mobile-only CTA so it never fights the new hierarchy.
  return (
    <LinkButton
      className="fixed bottom-4 right-4 z-30 rounded-full px-4 shadow-[var(--shadow-menu)] md:hidden"
      href="/invoices/new"
      size="lg"
    >
      <FilePlus2 aria-hidden="true" className="h-4 w-4" />
      New invoice
    </LinkButton>
  );
}
