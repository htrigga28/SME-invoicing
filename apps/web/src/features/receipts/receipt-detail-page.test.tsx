import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReceiptDetailContent } from "./receipt-detail-page";
import { getReceipt } from "./receipts-api";
import { formatDateTime } from "./receipt-ui";
import type { ReceiptDetailResponse } from "./types";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn()
  }
}));

vi.mock("./receipts-api", () => ({
  getReceipt: vi.fn()
}));

const receiptResponse: ReceiptDetailResponse = {
  receipt: {
    id: "receipt-1",
    receiptNumber: "RCT-000001",
    publicUrl: "http://localhost:3000/receipt/public-token",
    currency: "NGN",
    amountKobo: 100000,
    paymentProvider: "paystack",
    paymentReference: "PAYSTACK_REF",
    paymentChannel: "card",
    paidAt: "2026-06-30T10:00:00.000Z",
    issuedAt: "2026-06-30T10:01:00.000Z",
    business: {
      name: "Akin & Co Creative Services",
      email: "billing@akinco.com",
      phone: "+2348012345678",
      address: "12 Admiralty Way"
    },
    customer: {
      id: "customer-1",
      name: "Lagos Bright Prints",
      email: "accounts@lagosbrightprints.com",
      phone: "+2348010000001",
      billingAddress: "14 Allen Avenue"
    },
    invoice: {
      id: "invoice-1",
      invoiceNumber: "INV-000001",
      status: "paid",
      totalKobo: 100000,
      amountPaidKobo: 100000,
      balanceDueKobo: 0
    },
    payment: {
      id: "payment-1",
      status: "successful",
      provider: "paystack",
      providerReference: "PAYSTACK_REF"
    },
    refundSummary: {
      originalAmountKobo: 100000,
      processedRefundedKobo: 30000,
      netRetainedKobo: 70000,
      refundState: "partially_refunded",
      hasRefundInProgress: true
    },
    refunds: [
      {
        id: "refund-1",
        amountKobo: 30000,
        currency: "NGN",
        status: "processed",
        reason: "Partial refund",
        createdAt: "2026-06-30T10:02:00.000Z",
        processedAt: "2026-06-30T10:03:00.000Z"
      }
    ]
  }
};

beforeEach(() => {
  vi.mocked(getReceipt).mockResolvedValue(receiptResponse);
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined)
    }
  });
  window.print = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ReceiptDetailContent", () => {
  it("renders receipt details, refund history, and copies the public link", async () => {
    render(<ReceiptDetailContent accessToken="token" receiptId="receipt-1" />);

    expect(await screen.findByText("RCT-000001")).toBeInTheDocument();
    expect(screen.getAllByText("NGN 1,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("NGN 300.00").length).toBeGreaterThan(0);
    expect(screen.getByText("NGN 700.00")).toBeInTheDocument();
    expect(screen.getByText(/Partial refund/)).toBeInTheDocument();
    expect(screen.getAllByText("PAYSTACK_REF").length).toBeGreaterThan(0);
    expect(screen.queryByText(/ACCT_/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy public link" }));

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "http://localhost:3000/receipt/public-token"
      )
    );
  });

  it("shows a fallback when a receipt date is invalid", async () => {
    vi.mocked(getReceipt).mockResolvedValue({
      ...receiptResponse,
      receipt: {
        ...receiptResponse.receipt,
        issuedAt: "not-a-date"
      }
    });

    render(<ReceiptDetailContent accessToken="token" receiptId="receipt-1" />);

    expect(await screen.findByText("RCT-000001")).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
  });

  it("accepts non-string date inputs without throwing", () => {
    expect(() => formatDateTime(new Date("2026-06-30T10:01:00.000Z"))).not.toThrow();
    expect(formatDateTime({})).toBe("Not recorded");
  });
});
