import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

const push = vi.fn();
const login = vi.fn();
const selectOrganisation = vi.fn();
const setStoredSession = vi.fn();
const setStoredOrganisationId = vi.fn();
const scrubLegacyStoredSession = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

vi.mock("./auth-api", () => ({
  login: (...args: unknown[]) => login(...args),
  selectOrganisation: (...args: unknown[]) => selectOrganisation(...args)
}));

vi.mock("./session", () => ({
  getStoredSession: () => ({ accessToken: "access-token" }),
  setStoredSession: (...args: unknown[]) => setStoredSession(...args),
  setStoredOrganisationId: (...args: unknown[]) => setStoredOrganisationId(...args),
  scrubLegacyStoredSession: () => scrubLegacyStoredSession()
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function submitCredentials() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "owner@example.com" }
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password123" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Login" }));
}

describe("LoginForm", () => {
  it("stores the session and advances for a single-workspace login", async () => {
    login.mockResolvedValue({
      accessToken: "access-token",
      selectionRequired: false,
      activeOrganisation: { id: "org-1" },
      onboardingStep: "business_profile"
    });
    render(<LoginForm />);
    submitCredentials();

    await waitFor(() => expect(setStoredOrganisationId).toHaveBeenCalledWith("org-1"));
    expect(push).toHaveBeenCalledWith("/onboarding/business");
  });

  it("shows a workspace chooser instead of silently selecting on multi-workspace login", async () => {
    login.mockResolvedValue({
      accessToken: "access-token",
      selectionRequired: true,
      organisations: [
        {
          organisation: { id: "org-1", name: "First Workspace" },
          membership: { id: "member-1", organisationId: "org-1", role: "owner" }
        },
        {
          organisation: { id: "org-2", name: "Second Workspace" },
          membership: { id: "member-2", organisationId: "org-2", role: "admin" }
        }
      ]
    });
    selectOrganisation.mockResolvedValue({
      activeOrganisation: { id: "org-2" },
      onboardingStep: null
    });
    render(<LoginForm />);
    submitCredentials();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Choose a workspace" })).toBeInTheDocument()
    );
    expect(setStoredOrganisationId).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Second Workspace/ }));

    await waitFor(() =>
      expect(selectOrganisation).toHaveBeenCalledWith("access-token", "org-2")
    );
    expect(setStoredOrganisationId).toHaveBeenCalledWith("org-2");
    expect(push).toHaveBeenCalledWith("/dashboard");
  });
});
