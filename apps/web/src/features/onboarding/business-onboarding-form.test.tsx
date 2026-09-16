import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { BusinessOnboardingForm } from "./business-onboarding-form";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace
  })
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn()
  }
}));

vi.mock("@/features/auth/session", () => ({
  getStoredSession: () => ({
    accessToken: "token",
    refreshToken: "refresh-token"
  })
}));

const getMe = vi.fn();
const updateBusinessProfile = vi.fn();

vi.mock("@/features/auth/auth-api", () => ({
  getMe: (...args: unknown[]) => getMe(...args),
  updateBusinessProfile: (...args: unknown[]) => updateBusinessProfile(...args)
}));

beforeEach(() => {
  getMe.mockResolvedValue({
    onboardingStep: "business_profile",
    membership: { role: "owner" },
    businessProfile: {
      businessName: "Demo Business Ltd",
      email: "billing@demo.test",
      phone: "+2348012345678",
      address: "Lagos"
    }
  });
  updateBusinessProfile.mockResolvedValue({
    onboardingCompleted: true,
    businessProfile: {}
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BusinessOnboardingForm", () => {
  it("redirects into Payment Setup after completing the business profile", async () => {
    render(<BusinessOnboardingForm />);

    await screen.findByDisplayValue("Demo Business Ltd");

    fireEvent.click(screen.getByRole("button", { name: "Continue to Payment Setup" }));

    await waitFor(() =>
      expect(updateBusinessProfile).toHaveBeenCalledWith("token", {
        businessName: "Demo Business Ltd",
        email: "billing@demo.test",
        phone: "+2348012345678",
        address: "Lagos"
      })
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Business profile completed. Next, activate online payments."
    );
    expect(push).toHaveBeenCalledWith("/settings/payment-setup?source=onboarding");
  });

  it("shows a focused permission state for non-managing members", async () => {
    getMe.mockResolvedValueOnce({
      onboardingStep: "business_profile",
      membership: { role: "viewer" },
      businessProfile: {
        businessName: null,
        email: null,
        phone: null,
        address: null
      }
    });

    render(<BusinessOnboardingForm />);

    expect(
      await screen.findByRole("heading", { name: "An Owner or Admin must finish setup" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your workspace is still being configured. Ask an Owner or Admin to complete the business profile before you continue."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue to Payment Setup" })
    ).not.toBeInTheDocument();
    expect(updateBusinessProfile).not.toHaveBeenCalled();
  });
});
