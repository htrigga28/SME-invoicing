import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api";

import { PublicInvoicePage } from "./public-invoice-page";
import { getPublicInvoice, markPublicInvoiceViewed } from "./public-invoices-api";
import type { PublicInvoiceResponse } from "./types";

vi.mock("./public-invoices-api", () => ({
  getPublicInvoice: vi.fn(),
  markPublicInvoiceViewed: vi.fn()
}));

const publicInvoice = {
  invoice: {
    invoiceNumber: "INV-000007",
    status: "sent",
    currency: "NGN",
    issueDate: "2026-06-01",
    dueDate: "2026-06-15",
    notes: "Payment due in 14 days.",
    subtotalKobo: 100000,
    discountKobo: 10000,
    taxKobo: 7500,
    totalKobo: 97500,
    amountPaidKobo: 0,
    balanceDueKobo: 97500,
    sentAt: "2026-06-01T10:00:00.000Z",
    viewedAt: null,
    paidAt: null
  },
  business: {
    businessName: "Akin & Co Creative Services",
    email: "billing@akinco.test",
    phone: "+2348012345678",
    address: "12 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
    logoUrl: null
  },
  customer: {
    name: "Lagos Bright Prints",
    email: "accounts@lagosbrightprints.test",
    phone: "+2348010000001",
    billingAddress: "14 Allen Avenue, Ikeja, Lagos"
  },
  lineItems: [
    {
      description: "Design retainer",
      quantity: 1,
      unitPriceKobo: 100000,
      lineTotalKobo: 100000,
      sortOrder: 0
    }
  ],
  paymentSummary: {
    available: false,
    message: "Online payment will be available in the next milestone."
  }
} satisfies PublicInvoiceResponse;

beforeEach(() => {
  vi.mocked(getPublicInvoice).mockResolvedValue(publicInvoice);
  vi.mocked(markPublicInvoiceViewed).mockResolvedValue({ success: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PublicInvoicePage", () => {
  it("renders public invoice content without authenticated navigation", async () => {
    render(<PublicInvoicePage token="public-token" />);

    expect(await screen.findByText("Akin & Co Creative Services")).toBeInTheDocument();
    expect(screen.getByText("INV-000007")).toBeInTheDocument();
    expect(screen.getByText("Lagos Bright Prints")).toBeInTheDocument();
    expect(screen.getByText("Design retainer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay online coming soon" })).toBeDisabled();
    expect(screen.getByText("Powered by SME Invoicing")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dashboard/ })).not.toBeInTheDocument();
  });

  it("marks the invoice viewed once after successful load", async () => {
    render(<PublicInvoicePage token="public-token" />);

    await waitFor(() => expect(markPublicInvoiceViewed).toHaveBeenCalledWith("public-token"));
    expect(markPublicInvoiceViewed).toHaveBeenCalledTimes(1);
  });

  it("renders a safe unavailable state for invalid tokens", async () => {
    vi.mocked(getPublicInvoice).mockRejectedValueOnce(new ApiRequestError("Not found", 404));

    render(<PublicInvoicePage token="bad-token" />);

    expect(await screen.findByText("Invoice unavailable")).toBeInTheDocument();
    expect(screen.getByText(/This invoice link is unavailable/)).toBeInTheDocument();
    expect(markPublicInvoiceViewed).not.toHaveBeenCalled();
  });
});
