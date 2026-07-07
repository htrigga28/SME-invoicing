import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PublicReceiptPage } from "./public-receipt-page";
import { getPublicReceipt } from "./receipts-api";

vi.mock("./receipts-api", () => ({
  getPublicReceipt: vi.fn()
}));

beforeEach(() => {
  vi.mocked(getPublicReceipt).mockResolvedValue({
    receipt: {
      receiptNumber: "RCT-000001",
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
        name: "Lagos Bright Prints",
        email: "accounts@lagosbrightprints.com",
        phone: "+2348010000001",
        billingAddress: "14 Allen Avenue"
      },
      invoice: {
        invoiceNumber: "INV-000001"
      },
      payment: {
        provider: "paystack",
        providerReference: "PAYSTACK_REF"
      },
      refundSummary: {
        originalAmountKobo: 100000,
        processedRefundedKobo: 0,
        netRetainedKobo: 100000,
        refundState: "none",
        hasRefundInProgress: false
      }
    }
  });
  window.print = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PublicReceiptPage", () => {
  it("renders a public receipt without app navigation and supports print", async () => {
    render(<PublicReceiptPage token="public-token" />);

    expect(await screen.findByText("RCT-000001")).toBeInTheDocument();
    expect(screen.getByText("Akin & Co Creative Services")).toBeInTheDocument();
    expect(screen.getByText("Lagos Bright Prints")).toBeInTheDocument();
    expect(screen.getByText("PAYSTACK_REF")).toBeInTheDocument();
    expect(screen.queryByText("Operations workspace")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Print receipt" }));

    expect(window.print).toHaveBeenCalled();
  });
});
