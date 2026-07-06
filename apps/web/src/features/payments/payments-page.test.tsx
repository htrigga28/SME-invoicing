import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentsContent } from "./payments-page";
import { getPaymentSummary, listPaymentReviewEvents, listPayments } from "./payments-api";

vi.mock("./payments-api", () => ({
  getPaymentSummary: vi.fn(),
  listPaymentReviewEvents: vi.fn(),
  listPayments: vi.fn()
}));

const payment = {
  id: "payment-1",
  provider: "paystack",
  providerReference: "PAYSTACK_DEMO_INV000011_SUCCESSFUL",
  status: "successful",
  attemptState: "successful",
  reconciliationState: "matched",
  isSuperseded: false,
  supersededReason: null,
  reviewDetails: null,
  reviewReason: null,
  currency: "NGN",
  amountKobo: 97500,
  paidAt: "2026-06-30T10:00:00.000Z",
  failedAt: null,
  abandonedAt: null,
  initializedAt: "2026-06-30T09:59:00.000Z",
  createdAt: "2026-06-30T09:59:00.000Z",
  invoice: {
    id: "invoice-1",
    invoiceNumber: "INV-000011",
    status: "paid",
    totalKobo: 97500,
    amountPaidKobo: 97500,
    balanceDueKobo: 0
  },
  customer: {
    id: "customer-1",
    name: "Lagos Bright Prints",
    email: "accounts@lagosbrightprints.com"
  },
  settlementAccount: {
    provider: "paystack",
    bankName: "United Bank for Africa",
    accountName: "Akin & Co Creative Services",
    accountNumberLast4: "9090"
  },
  settlementAccountContext: {
    currentStatus: "disabled",
    isCurrentActiveAccount: false,
    isHistorical: true
  },
  latestEventSummary: {
    eventType: "charge.success",
    processed: true,
    errorMessage: null,
    createdAt: "2026-06-30T10:00:00.000Z"
  }
} as const;

beforeEach(() => {
  vi.mocked(listPayments).mockResolvedValue({
    payments: [payment],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
  });
  vi.mocked(getPaymentSummary).mockResolvedValue({
    totals: {
      collectedKobo: 97500,
      pendingKobo: 25000,
      failedKobo: 10000,
      abandonedKobo: 5000,
      refundedKobo: 0,
      paymentCount: 4,
      successfulCount: 1,
      pendingCount: 1,
      stalePendingCount: 1,
      failedCount: 1,
      abandonedCount: 1,
      refundedCount: 0,
      reviewRequiredCount: 2,
      supersededCount: 3
    },
    statusBreakdown: [],
    recentPayments: [payment]
  });
  vi.mocked(listPaymentReviewEvents).mockResolvedValue({
    events: [
      {
        id: "event-1",
        provider: "paystack",
        providerReference: "PAYSTACK_REVIEW_UNKNOWN_REF",
        eventType: "charge.success",
        processed: true,
        processedAt: "2026-06-30T10:00:00.000Z",
        errorMessage: "Unknown payment reference.",
        createdAt: "2026-06-30T10:00:00.000Z",
        paymentId: null,
        invoiceNumber: null,
        customerName: null
      }
    ],
    pagination: { page: 1, limit: 5, total: 1, totalPages: 1 }
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PaymentsContent", () => {
  it("renders summary cards, payment rows, badges, and masked settlement account", async () => {
    render(<PaymentsContent accessToken="token" />);

    expect(await screen.findAllByText("PAYSTACK_DEMO_INV000011_SUCCESSFUL")).toHaveLength(2);
    expect(screen.getAllByText("NGN 975.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Matched").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Successful").length).toBeGreaterThan(0);
    expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument();
    expect(screen.getByText("Awaiting confirmation")).toBeInTheDocument();
    expect(screen.getByText(/superseded hidden/i)).toBeInTheDocument();
    expect(screen.getAllByText("United Bank for Africa • ****9090").length).toBeGreaterThan(0);
    expect(screen.queryByText(/ACCT_/)).not.toBeInTheDocument();
    expect(screen.getByText("Unknown payment reference.")).toBeInTheDocument();
  });

  it("applies filters through the payment API", async () => {
    render(<PaymentsContent accessToken="token" />);

    fireEvent.change(await screen.findByLabelText("Search"), {
      target: { value: "INV000011" }
    });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "successful" }
    });
    fireEvent.change(screen.getByLabelText("Reconciliation"), {
      target: { value: "matched" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(listPayments).toHaveBeenLastCalledWith(
        "token",
        expect.objectContaining({
          search: "INV000011",
          status: "successful",
          reconciliationState: "matched",
          view: "reconciliation"
        })
      )
    );
  });

  it("switches between reconciliation, all attempts, and needs review views", async () => {
    render(<PaymentsContent accessToken="token" />);

    expect(await screen.findByRole("button", { name: "Reconciliation" })).toBeInTheDocument();
    expect(listPayments).toHaveBeenLastCalledWith(
      "token",
      expect.objectContaining({ view: "reconciliation" })
    );

    fireEvent.click(screen.getByRole("button", { name: "All attempts" }));

    await waitFor(() =>
      expect(listPayments).toHaveBeenLastCalledWith(
        "token",
        expect.objectContaining({ view: "all_attempts" })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Needs review" }));

    await waitFor(() =>
      expect(listPayments).toHaveBeenLastCalledWith(
        "token",
        expect.objectContaining({ view: "review_required" })
      )
    );
  });

  it("renders the empty state", async () => {
    vi.mocked(listPayments).mockResolvedValueOnce({
      payments: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 }
    });

    render(<PaymentsContent accessToken="token" />);

    expect(await screen.findByText("No active reconciliation records.")).toBeInTheDocument();
  });

  it("keeps pagination visible when the current page has no rows but matching records exist", async () => {
    vi.mocked(listPayments)
      .mockResolvedValueOnce({
        payments: [payment],
        pagination: { page: 1, limit: 20, total: 21, totalPages: 2 }
      })
      .mockResolvedValueOnce({
        payments: [],
        pagination: { page: 2, limit: 20, total: 21, totalPages: 2 }
      });

    render(<PaymentsContent accessToken="token" />);

    expect(await screen.findAllByText("PAYSTACK_DEMO_INV000011_SUCCESSFUL")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      await screen.findByText(
        "No payments on this page. Use Previous to return to earlier results."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2 • 21 payments")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("renders a friendly error state", async () => {
    vi.mocked(listPayments).mockRejectedValueOnce(new Error("Could not load payments."));

    render(<PaymentsContent accessToken="token" />);

    expect(await screen.findByText("Payments could not be loaded.")).toBeInTheDocument();
    expect(screen.getByText("Could not load payments.")).toBeInTheDocument();
  });
});
