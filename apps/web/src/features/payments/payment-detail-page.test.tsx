import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentDetailContent } from "./payment-detail-page";
import { getPayment } from "./payments-api";
import type { PaymentDetailResponse } from "./types";

vi.mock("./payments-api", () => ({
  getPayment: vi.fn()
}));

const paymentDetailResponse: PaymentDetailResponse = {
  payment: {
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
    channel: "card",
    gatewayResponse: "Successful",
    initializedAt: "2026-06-30T09:59:00.000Z",
    createdAt: "2026-06-30T09:59:00.000Z",
    updatedAt: "2026-06-30T10:00:00.000Z"
  },
  invoice: {
    id: "invoice-1",
    invoiceNumber: "INV-000011",
    status: "paid",
    issueDate: "2026-06-01",
    dueDate: "2026-06-15",
    totalKobo: 97500,
    amountPaidKobo: 97500,
    balanceDueKobo: 0
  },
  customer: {
    id: "customer-1",
    name: "Lagos Bright Prints",
    email: "accounts@lagosbrightprints.com",
    phone: "+2348010000001"
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
  events: [
    {
      id: "event-1",
      eventType: "charge.success",
      providerReference: "PAYSTACK_DEMO_INV000011_SUCCESSFUL",
      processed: true,
      processedAt: "2026-06-30T10:00:00.000Z",
      errorMessage: null,
      createdAt: "2026-06-30T10:00:00.000Z"
    }
  ],
  receiptPlaceholder: "Receipts will be available after T014."
};

beforeEach(() => {
  vi.mocked(getPayment).mockResolvedValue(paymentDetailResponse);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PaymentDetailContent", () => {
  it("renders linked invoice, customer, settlement account, event timeline, and receipt placeholder", async () => {
    render(<PaymentDetailContent accessToken="token" paymentId="payment-1" />);

    expect(await screen.findByText("PAYSTACK_DEMO_INV000011_SUCCESSFUL")).toBeInTheDocument();
    expect(screen.getByText("United Bank for Africa • ****9090")).toBeInTheDocument();
    expect(screen.getByText("INV-000011")).toBeInTheDocument();
    expect(screen.getByText("Lagos Bright Prints")).toBeInTheDocument();
    expect(screen.getByText("charge.success")).toBeInTheDocument();
    expect(
      screen.getByText("This payment has been matched to the linked invoice.")
    ).toBeInTheDocument();
    expect(screen.getByText("Historical account")).toBeInTheDocument();
    expect(screen.getByText("Paystack status")).toBeInTheDocument();
    expect(screen.getByText("Receipts will be available after T014.")).toBeInTheDocument();
    expect(screen.queryByText(/ACCT_/)).not.toBeInTheDocument();
  });

  it("explains superseded attempts", async () => {
    vi.mocked(getPayment).mockResolvedValueOnce({
      ...paymentDetailResponse,
      payment: {
        ...paymentDetailResponse.payment,
        status: "failed",
        attemptState: "superseded",
        reconciliationState: "superseded",
        isSuperseded: true,
        supersededReason: "Invoice already paid by another successful payment.",
        reviewReason: null,
        paidAt: null,
        failedAt: "2026-06-30T10:00:00.000Z"
      }
    });

    render(<PaymentDetailContent accessToken="token" paymentId="payment-1" />);

    expect((await screen.findAllByText("Superseded")).length).toBeGreaterThan(0);
    expect(
      screen.getByText("Invoice already paid by another successful payment.")
    ).toBeInTheDocument();
  });

  it("does not render duplicate pending/status/reconciliation badges", async () => {
    vi.mocked(getPayment).mockResolvedValueOnce({
      ...paymentDetailResponse,
      payment: {
        ...paymentDetailResponse.payment,
        status: "pending",
        attemptState: "stale_pending",
        reconciliationState: "stale_pending",
        paidAt: null
      }
    });

    render(<PaymentDetailContent accessToken="token" paymentId="payment-1" />);

    expect(await screen.findByText("Stale pending")).toBeInTheDocument();
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
    expect(screen.getAllByText("Stale pending")).toHaveLength(1);
  });
});
