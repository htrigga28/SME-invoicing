import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MeResponse } from "@/features/auth/types";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

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

afterEach(() => {
  cleanup();
});

describe("app shell navigation components", () => {
  it("renders workspace context and exposes role/logout inside the account menu", () => {
    render(<Topbar activePath="/dashboard" me={me} onLogout={vi.fn()} />);

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
    render(<Topbar activePath="/dashboard" me={me} onLogout={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Jump to a page" })).toHaveTextContent(
      "Jump to a page…"
    );
    fireEvent.keyDown(document, { ctrlKey: true, key: "k" });
    expect(screen.getByRole("link", { name: "Invoices" })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("link", { name: "Invoices" })).not.toBeInTheDocument();
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
});
