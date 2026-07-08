import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardShell } from "./dashboard-shell";
import type { DashboardOverviewResponse } from "./types";

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

const getDashboardOverview = vi.fn();

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: (context: typeof appShellContext) => React.ReactNode }) => (
    <div>{children(appShellContext)}</div>
  )
}));

vi.mock("./dashboard-api", () => ({
  getDashboardOverview: (...args: unknown[]) => getDashboardOverview(...args)
}));

vi.mock("./components/cashflow-chart", () => ({
  CashflowChart: () => <div data-testid="cashflow-chart" />
}));

vi.mock("./components/invoice-status-chart", () => ({
  InvoiceStatusChart: () => <div data-testid="invoice-status-chart" />
}));

vi.mock("./components/outstanding-aging-chart", () => ({
  OutstandingAgingChart: () => <div data-testid="outstanding-aging-chart" />
}));

beforeEach(() => {
  getDashboardOverview.mockResolvedValue(createDashboardOverview());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DashboardShell", () => {
  it("shows a payment setup CTA for owners when online payments are not configured", async () => {
    render(<DashboardShell />);

    expect(await screen.findByText("Online payments are not configured")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up online payments" })).toHaveAttribute(
      "href",
      "/settings/payment-setup"
    );
  });

  it("shows the active Payment Setup state once online payments are active", async () => {
    getDashboardOverview.mockResolvedValueOnce(
      createDashboardOverview({
        paymentSetup: {
          status: "active",
          canAcceptOnlinePayments: true,
          bankName: "Access Bank",
          accountNumberLast4: "7890"
        }
      })
    );

    render(<DashboardShell />);

    expect(await screen.findByText("Online payments active")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Online payments are not configured")).not.toBeInTheDocument()
    );
  });

  it("renders period and current dashboard metrics from the overview response", async () => {
    render(<DashboardShell />);

    expect(await screen.findByText("Net collected")).toBeInTheDocument();
    expect(screen.getByText("NGN 100,000.00")).toBeInTheDocument();
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
    expect(screen.getByText("NGN 45,000.00")).toBeInTheDocument();
    expect(screen.getByTestId("cashflow-chart")).toBeInTheDocument();
  });
});

function createDashboardOverview(
  overrides: Partial<DashboardOverviewResponse> = {}
): DashboardOverviewResponse {
  return {
    period: {
      dateFrom: "2026-06-08",
      dateTo: "2026-07-07",
      granularity: "day",
      timezone: "Africa/Lagos"
    },
    financialActivity: {
      grossCollectedKobo: 12000000,
      processedRefundsKobo: 2000000,
      netCollectedKobo: 10000000,
      successfulPaymentCount: 4,
      processedRefundCount: 1,
      receiptsIssuedCount: 4
    },
    currentPosition: {
      outstandingKobo: 4500000,
      overdueKobo: 1500000,
      outstandingInvoiceCount: 3,
      overdueInvoiceCount: 1,
      activePendingPaymentCount: 2,
      unresolvedReviewCount: 1
    },
    invoiceStatusBreakdown: [
      { status: "draft", count: 1, balanceKobo: 0 },
      { status: "sent", count: 2, balanceKobo: 3000000 },
      { status: "viewed", count: 0, balanceKobo: 0 },
      { status: "partially_paid", count: 1, balanceKobo: 1500000 },
      { status: "paid", count: 4, balanceKobo: 0 },
      { status: "overdue", count: 1, balanceKobo: 1500000 },
      { status: "cancelled", count: 0, balanceKobo: 0 },
      { status: "void", count: 0, balanceKobo: 0 }
    ],
    outstandingAging: {
      notDueKobo: 3000000,
      overdue1To7DaysKobo: 1500000,
      overdue8To30DaysKobo: 0,
      overdue31PlusDaysKobo: 0
    },
    cashflowTrend: [
      {
        period: "2026-07-07",
        grossCollectedKobo: 12000000,
        processedRefundsKobo: 2000000,
        netCollectedKobo: 10000000
      }
    ],
    recentInvoices: [
      {
        id: "invoice-1",
        invoiceNumber: "INV-000001",
        status: "sent",
        currency: "NGN",
        totalKobo: 3000000,
        balanceDueKobo: 3000000,
        dueDate: "2026-07-20",
        createdAt: "2026-07-07T10:00:00.000Z",
        customer: {
          id: "customer-1",
          name: "Lagos Bright Prints"
        }
      }
    ],
    recentPayments: [
      {
        id: "payment-1",
        providerReference: "SME-INV-000001-ABC",
        amountKobo: 12000000,
        currency: "NGN",
        state: "successful",
        status: "successful",
        paidAt: "2026-07-07T10:00:00.000Z",
        createdAt: "2026-07-07T09:58:00.000Z",
        invoice: {
          id: "invoice-1",
          invoiceNumber: "INV-000001"
        },
        customer: {
          id: "customer-1",
          name: "Lagos Bright Prints"
        }
      }
    ],
    recentReceipts: [
      {
        id: "receipt-1",
        receiptNumber: "RCT-000001",
        amountKobo: 12000000,
        currency: "NGN",
        issuedAt: "2026-07-07T10:01:00.000Z",
        invoice: {
          id: "invoice-1",
          invoiceNumber: "INV-000001"
        },
        customer: {
          id: "customer-1",
          name: "Lagos Bright Prints"
        },
        refundSummary: {
          processedRefundedKobo: 0,
          hasRefundInProgress: false,
          refundState: "none"
        }
      }
    ],
    reviewIssues: [
      {
        id: "payment-review-1",
        type: "payment",
        summary: "Successful payments exceed the invoice total.",
        state: "overpaid",
        reviewState: "open",
        amountKobo: 12000000,
        createdAt: "2026-07-07T10:00:00.000Z",
        paymentId: "payment-1",
        invoice: {
          id: "invoice-1",
          invoiceNumber: "INV-000001"
        },
        customer: {
          id: "customer-1",
          name: "Lagos Bright Prints"
        }
      }
    ],
    paymentSetup: {
      status: "not_configured",
      canAcceptOnlinePayments: false
    },
    ...overrides
  };
}
