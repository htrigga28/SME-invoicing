import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
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
  onboardingRequired: false
} satisfies MeResponse;

afterEach(() => {
  cleanup();
});

describe("app shell navigation components", () => {
  it("renders owner workspace details and logout in the topbar", () => {
    render(<Topbar activePath="/dashboard" me={me} onLogout={vi.fn()} />);

    expect(screen.getByText("Akin & Co Creative Services")).toBeInTheDocument();
    expect(screen.getByText(/Demo Owner/)).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("shows Settings / Team to owners with an active sidebar state", () => {
    render(<Sidebar activePath="/settings/team" role="owner" />);

    expect(screen.getByRole("link", { name: /Settings \/ Team/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("hides Settings / Team from viewers", () => {
    render(<Sidebar activePath="/dashboard" role="viewer" />);

    expect(screen.queryByRole("link", { name: /Settings \/ Team/ })).not.toBeInTheDocument();
  });
});
