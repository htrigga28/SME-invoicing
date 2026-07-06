import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReceiptsContent } from "./receipts-page";
import { listReceipts } from "./receipts-api";

vi.mock("./receipts-api", () => ({
  listReceipts: vi.fn()
}));

const receipt = {
  id: "receipt-1",
  receiptNumber: "RCT-000001",
  currency: "NGN",
  amountKobo: 100000,
  paymentReference: "PAYSTACK_REF",
  paymentProvider: "paystack",
  paidAt: "2026-06-30T10:00:00.000Z",
  issuedAt: "2026-06-30T10:01:00.000Z",
  invoice: {
    id: "invoice-1",
    invoiceNumber: "INV-000001",
    status: "paid",
    totalKobo: 100000,
    amountPaidKobo: 100000,
    balanceDueKobo: 0
  },
  customer: {
    id: "customer-1",
    name: "Lagos Bright Prints",
    email: "accounts@lagosbrightprints.com"
  },
  refundSummary: {
    originalAmountKobo: 100000,
    processedRefundedKobo: 0,
    netRetainedKobo: 100000,
    refundState: "none",
    hasRefundInProgress: false
  }
} as const;

beforeEach(() => {
  vi.mocked(listReceipts).mockResolvedValue({
    receipts: [receipt],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ReceiptsContent", () => {
  it("renders receipt rows and refund state without exposing provider subaccount codes", async () => {
    render(<ReceiptsContent accessToken="token" />);

    expect(await screen.findAllByText("RCT-000001")).toHaveLength(2);
    expect(screen.getAllByText("NGN 1,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lagos Bright Prints").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No refunds").length).toBeGreaterThan(0);
    expect(screen.queryByText(/ACCT_/)).not.toBeInTheDocument();
  });

  it("applies receipt filters through the API", async () => {
    render(<ReceiptsContent accessToken="token" />);

    fireEvent.change(await screen.findByLabelText("Search"), {
      target: { value: "RCT-000001" }
    });
    fireEvent.change(screen.getByLabelText("Refund state"), {
      target: { value: "none" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(listReceipts).toHaveBeenLastCalledWith(
        "token",
        expect.objectContaining({
          refundState: "none",
          search: "RCT-000001"
        })
      )
    );
  });
});
