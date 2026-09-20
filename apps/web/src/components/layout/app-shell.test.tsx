import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMe,
  getOrganisations,
  logout,
  refresh,
  selectOrganisation
} from "@/features/auth/auth-api";
import { ApiRequestError } from "@/lib/api";
import type { MeResponse } from "@/features/auth/types";
import {
  clearStoredOrganisationId,
  clearStoredSession,
  setStoredOrganisationId,
  setStoredSession
} from "@/features/auth/session";

import { __clearAppShellMeCacheForTests, AppShell } from "./app-shell";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => navigation
}));

vi.mock("@/features/auth/auth-api", () => ({
  getMe: vi.fn(),
  getOrganisations: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  selectOrganisation: vi.fn()
}));

const me = {
  user: {
    id: "user-1",
    email: "owner@demo.com",
    name: "Demo Owner"
  },
  activeOrganisation: {
    id: "org-1",
    name: "Akin & Co Creative Services",
    slug: "akin-co-demo",
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z"
  },
  membership: {
    id: "member-1",
    organisationId: "org-1",
    userId: "user-1",
    role: "owner",
    status: "active"
  },
  businessProfile: {
    id: "profile-1",
    organisationId: "org-1",
    businessName: "Akin & Co Creative Services",
    email: "billing@akinco.test",
    phone: "+2348012345678",
    address: "12 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
    logoFileId: null,
    setupCompletedAt: "2026-01-01T00:00:00.000Z"
  },
  onboardingRequired: false,
  onboardingStep: null
} satisfies MeResponse;

beforeEach(() => {
  __clearAppShellMeCacheForTests();
  vi.mocked(getMe).mockReset();
  vi.mocked(getOrganisations).mockReset();
  vi.mocked(logout).mockReset();
  vi.mocked(refresh).mockReset();
  vi.mocked(selectOrganisation).mockReset();
  vi.mocked(getMe).mockResolvedValue(me);
  vi.mocked(getOrganisations).mockResolvedValue({
    organisations: [{ organisation: me.activeOrganisation, membership: me.membership }],
    activeOrganisationId: "org-1"
  });
  vi.mocked(logout).mockResolvedValue({ success: true });
  vi.mocked(refresh).mockResolvedValue({ accessToken: "renewed" });
  navigation.replace.mockReset();
  navigation.push.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearStoredOrganisationId();
  clearStoredSession();
  window.localStorage.removeItem("sme-invoicing-session");
});

describe("app shell navigation components", () => {
  it("renders workspace context and exposes role/logout inside the account menu", () => {
    render(<Topbar accessToken="access-1" activePath="/dashboard" me={me} onLogout={vi.fn()} />);

    expect(screen.getAllByText("Akin & Co Creative Services").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
    // Role and logout live inside the account menu, not permanently in the bar.
    expect(screen.queryByText("Owner")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByText("Demo Owner")).toBeInTheDocument();
    expect(screen.getByText("owner@demo.com")).toBeInTheDocument();
    expect(screen.getByText(/Owner ·/)).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Logout" })).toBeInTheDocument();
  });

  it("opens the page launcher from the keyboard and closes it on outside click", () => {
    render(<Topbar accessToken="access-1" activePath="/dashboard" me={me} onLogout={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Jump to a page" })).toHaveTextContent(
      "Jump to a page…"
    );
    fireEvent.keyDown(document, { ctrlKey: true, key: "k" });
    expect(screen.getByRole("link", { name: "Invoices" })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("link", { name: "Invoices" })).not.toBeInTheDocument();
  });

  it("switches to a joined workspace from the account menu", async () => {
    vi.mocked(getOrganisations).mockResolvedValue({
      organisations: [
        {
          organisation: me.activeOrganisation,
          membership: me.membership
        },
        {
          organisation: { ...me.activeOrganisation, id: "org-2", name: "Second Workspace" },
          membership: { ...me.membership, id: "member-2", organisationId: "org-2" }
        }
      ],
      activeOrganisationId: "org-1"
    });
    vi.mocked(selectOrganisation).mockResolvedValue(me);
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });

    render(<Topbar accessToken="access-1" activePath="/dashboard" me={me} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));

    await waitFor(() => {
      expect(screen.getByText("Switch workspace")).toBeInTheDocument();
    });
    expect(screen.getByText("Current")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemradio", { name: /Second Workspace/ }));

    await waitFor(() => {
      expect(selectOrganisation).toHaveBeenCalledWith("access-1", "org-2");
    });
    expect(window.localStorage.getItem("sme-invoicing-organisation")).toBe("org-2");
    expect(reload).toHaveBeenCalledOnce();
  });

  it("hides the switcher for single-workspace users", async () => {
    vi.mocked(getOrganisations).mockResolvedValue({
      organisations: [{ organisation: me.activeOrganisation, membership: me.membership }],
      activeOrganisationId: "org-1"
    });

    render(<Topbar accessToken="access-1" activePath="/dashboard" me={me} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));

    await waitFor(() => {
      expect(getOrganisations).toHaveBeenCalledWith("access-1");
    });
    expect(screen.queryByText("Switch workspace")).not.toBeInTheDocument();
  });

  it("shows Settings / Team to owners with an active sidebar state", () => {
    render(<Sidebar activePath="/settings/team" role="owner" />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute("aria-current", "page");
  });

  it("shows Payment setup to viewers with an active sidebar state", () => {
    render(<Sidebar activePath="/settings/payment-setup" role="viewer" />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Payment setup" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("hides Settings / Team from viewers", () => {
    render(<Sidebar activePath="/dashboard" role="viewer" />);

    expect(screen.queryByRole("link", { name: "Team" })).not.toBeInTheDocument();
  });

  it("groups receivables separately from settings navigation", () => {
    render(<Sidebar activePath="/dashboard" role="owner" />);

    expect(screen.getByText("Receivables")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
    const receivables = screen.getByText("Receivables").closest("div");
    expect(receivables).toHaveTextContent("Invoices");
    expect(screen.getByText("Settings").closest("div")).toHaveTextContent("Payment setup");
  });

  it("supports an expanded sidebar with an accessible toggle", () => {
    const onToggle = vi.fn();

    render(<Sidebar activePath="/dashboard" expanded onToggle={onToggle} role="owner" />);

    expect(screen.getByText("Lumina")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Invoices" })).toHaveTextContent("Invoices");

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows a chooser after a stale workspace has multiple active replacements", async () => {
    setStoredSession({ accessToken: "access-1" });
    setStoredOrganisationId("org-stale");
    vi.mocked(getMe)
      .mockRejectedValueOnce(new ApiRequestError("No access", 403))
      .mockResolvedValueOnce({
        ...me,
        activeOrganisation: { ...me.activeOrganisation, id: "org-2", name: "Second Workspace" },
        membership: { ...me.membership, organisationId: "org-2" }
      });
    vi.mocked(getOrganisations).mockResolvedValue({
      organisations: [
        { organisation: me.activeOrganisation, membership: me.membership },
        {
          organisation: { ...me.activeOrganisation, id: "org-2", name: "Second Workspace" },
          membership: { ...me.membership, organisationId: "org-2" }
        }
      ],
      activeOrganisationId: "org-1"
    });

    render(<AppShell>{({ me: context }) => <p>{context.activeOrganisation.name}</p>}</AppShell>);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Choose a workspace" })).toBeInTheDocument();
    });
    expect(getOrganisations).toHaveBeenCalledWith("access-1", null);
    expect(window.localStorage.getItem("sme-invoicing-organisation")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Second Workspace/ }));

    await waitFor(() => {
      expect(getMe).toHaveBeenLastCalledWith("access-1", "org-2");
      expect(screen.getByText("Second Workspace")).toBeInTheDocument();
    });
  });

  it("automatically recovers a sole active workspace without retrying the stale one", async () => {
    setStoredSession({ accessToken: "access-1" });
    setStoredOrganisationId("org-stale");
    vi.mocked(getMe)
      .mockRejectedValueOnce(new ApiRequestError("No access", 403))
      .mockResolvedValueOnce(me);
    vi.mocked(getOrganisations).mockResolvedValue({
      organisations: [{ organisation: me.activeOrganisation, membership: me.membership }],
      activeOrganisationId: "org-1"
    });

    render(<AppShell>{({ me: context }) => <p>{context.activeOrganisation.name}</p>}</AppShell>);

    await waitFor(() => {
      expect(getMe).toHaveBeenLastCalledWith("access-1", "org-1");
    });
    expect(window.localStorage.getItem("sme-invoicing-organisation")).toBe("org-1");
    expect(getMe).toHaveBeenCalledTimes(2);
  });

  it("clears access state when no active workspace remains", async () => {
    setStoredSession({ accessToken: "access-1" });
    setStoredOrganisationId("org-stale");
    vi.mocked(getMe).mockRejectedValueOnce(new ApiRequestError("No access", 403));
    vi.mocked(getOrganisations).mockResolvedValue({ organisations: [], activeOrganisationId: null });

    render(<AppShell>{() => <p>Workspace</p>}</AppShell>);

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/login"));
    expect(window.localStorage.getItem("sme-invoicing-organisation")).toBeNull();
  });

  it("migrates a legacy refresh token only after the active workspace loads", async () => {
    window.localStorage.setItem(
      "sme-invoicing-session",
      JSON.stringify({ accessToken: "old-access", refreshToken: "legacy-refresh" })
    );
    vi.mocked(refresh).mockResolvedValueOnce({ accessToken: "renewed" });

    render(<AppShell>{({ accessToken }) => <p>{accessToken}</p>}</AppShell>);

    await waitFor(() => expect(screen.getByText("renewed")).toBeInTheDocument());
    expect(refresh).toHaveBeenCalledWith("legacy-refresh");
    expect(window.localStorage.getItem("sme-invoicing-session")).toBeNull();
  });

  it("retains a legacy session when its exchange fails", async () => {
    window.localStorage.setItem(
      "sme-invoicing-session",
      JSON.stringify({ accessToken: "old-access", refreshToken: "legacy-refresh" })
    );
    vi.mocked(refresh).mockRejectedValueOnce(new ApiRequestError("Exchange failed", 401));

    render(<AppShell>{() => <p>Workspace</p>}</AppShell>);

    await waitFor(() => expect(screen.getByText("Exchange failed")).toBeInTheDocument());
    expect(window.localStorage.getItem("sme-invoicing-session")).toContain("legacy-refresh");
  });

  it("publishes a renewed access token to active shell children", async () => {
    setStoredSession({ accessToken: "old-access" });

    render(<AppShell>{({ accessToken }) => <p>{accessToken}</p>}</AppShell>);
    await waitFor(() => expect(screen.getByText("old-access")).toBeInTheDocument());

    setStoredSession({ accessToken: "renewed-access" });

    await waitFor(() => expect(screen.getByText("renewed-access")).toBeInTheDocument());
  });
});
