import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { demoMe as me } from "@/test/fixtures";

import { TeamManagementContent } from "./team-management-page";
import { listTeamInvitations, listTeamMembers } from "./team-api";

vi.mock("./team-api", () => ({
  createTeamInvitation: vi.fn(),
  listTeamInvitations: vi.fn(),
  listTeamMembers: vi.fn(),
  removeTeamMember: vi.fn(),
  revokeTeamInvitation: vi.fn(),
  updateTeamMember: vi.fn()
}));

beforeEach(() => {
  vi.mocked(listTeamMembers).mockResolvedValue({
    members: [
      {
        id: "member-admin",
        organisationId: "org-1",
        userId: "user-admin",
        role: "admin",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        user: {
          id: "user-admin",
          email: "admin@demo.com",
          name: "Demo Admin"
        }
      }
    ],
    pagination: {
      limit: 20,
      page: 1,
      total: 1,
      totalPages: 1
    }
  });
  vi.mocked(listTeamInvitations).mockResolvedValue({
    invitations: [],
    pagination: {
      limit: 20,
      page: 1,
      total: 0,
      totalPages: 1
    }
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TeamManagementContent selects", () => {
  it("renders invitation, role, and status selects with shared chevrons", async () => {
    render(<TeamManagementContent accessToken="token" me={me} />);

    expect(await screen.findByRole("combobox", { name: "Role" })).toHaveClass("pr-12");
    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    expect(screen.getAllByTestId("select-chevron")).toHaveLength(3);
  });
});
