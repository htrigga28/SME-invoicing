import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardShell } from "./dashboard-shell";

const appShellContext = {
  accessToken: "token",
  me: {
    user: {
      id: "user-1",
      email: "owner@demo.com",
      name: "Demo Owner"
    },
    activeOrganisation: {
      id: "org-1",
      name: "Demo Org",
      slug: "demo-org",
      onboardingCompletedAt: "2026-06-30T00:00:00.000Z"
    },
    membership: {
      id: "member-1",
      organisationId: "org-1",
      userId: "user-1",
      role: "owner" as const,
      status: "active" as const
    },
    businessProfile: {
      id: "profile-1",
      organisationId: "org-1",
      businessName: "Demo Business Ltd",
      email: "billing@demo.test",
      phone: "+2348012345678",
      address: "Lagos",
      logoFileId: null,
      setupCompletedAt: "2026-06-30T00:00:00.000Z"
    },
    onboardingRequired: false
  }
};

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: (context: typeof appShellContext) => React.ReactNode }) => (
    <div>{children(appShellContext)}</div>
  )
}));

const getPaymentSetupAccount = vi.fn();

vi.mock("@/features/payment-setup/payment-setup-api", () => ({
  getPaymentSetupAccount: (...args: unknown[]) => getPaymentSetupAccount(...args)
}));

beforeEach(() => {
  getPaymentSetupAccount.mockResolvedValue({
    status: "not_configured",
    paymentAccount: null
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DashboardShell", () => {
  it("shows a payment setup CTA for owners when online payments are not active", async () => {
    render(<DashboardShell />);

    expect(await screen.findByText("Online payments are not active yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up payments" })).toHaveAttribute(
      "href",
      "/settings/payment-setup"
    );
  });

  it("hides the payment setup CTA once an active account exists", async () => {
    getPaymentSetupAccount.mockResolvedValueOnce({
      status: "active",
      paymentAccount: {
        id: "payment-account-1",
        provider: "paystack",
        bankName: "Access Bank",
        accountName: "Demo Business Ltd",
        accountNumberLast4: "7890",
        status: "active",
        verifiedAt: "2026-06-30T10:00:00.000Z",
        disabledAt: null,
        createdAt: "2026-06-30T10:00:00.000Z",
        updatedAt: "2026-06-30T10:00:00.000Z"
      }
    });

    render(<DashboardShell />);

    await waitFor(() =>
      expect(screen.queryByText("Online payments are not active yet")).not.toBeInTheDocument()
    );
  });
});
