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

const getBusinessProfile = vi.fn();
const updateBusinessProfile = vi.fn();

vi.mock("@/features/auth/auth-api", () => ({
  getBusinessProfile: (...args: unknown[]) => getBusinessProfile(...args),
  updateBusinessProfile: (...args: unknown[]) => updateBusinessProfile(...args)
}));

beforeEach(() => {
  getBusinessProfile.mockResolvedValue({
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

    fireEvent.click(screen.getByRole("button", { name: "Complete business profile" }));

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
});
