import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvoiceDetailContent } from "./invoice-detail-page";
import { getInvoice } from "./invoices-api";
import type { InvoiceDetailResponse } from "./types";

vi.mock("./invoices-api", () => ({
  cancelInvoice: vi.fn(),
  getInvoice: vi.fn(),
  sendInvoice: vi.fn(),
  voidInvoice: vi.fn()
}));

const invoiceResponse = {
  invoice: {
    id: "invoice-1",
    invoiceNumber: "INV-000007",
    customer: {
      id: "customer-1",
      name: "Lagos Bright Prints",
      email: "accounts@lagosbrightprints.test",
      phone: "+2348010000001",
      billingAddress: "14 Allen Avenue, Ikeja, Lagos",
      status: "active",
      archivedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    status: "sent",
    currency: "NGN",
    issueDate: "2026-06-01",
    dueDate: "2026-06-15",
    notes: "Payment due in 14 days.",
    publicToken: "public-token",
    subtotalKobo: 100000,
    discountKobo: 10000,
    taxKobo: 7500,
    totalKobo: 97500,
    amountPaidKobo: 0,
    balanceDueKobo: 97500,
    publicAccessEnabled: true,
    sentAt: "2026-06-01T10:00:00.000Z",
    viewedAt: null,
    paidAt: null,
    cancelledAt: null,
    voidedAt: null,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z"
  },
  lineItems: [
    {
      id: "line-1",
      description: "Design retainer",
      quantity: 1,
      unitPriceKobo: 100000,
      lineTotalKobo: 100000,
      sortOrder: 0,
      createdAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:00:00.000Z"
    }
  ],
  statusEvents: [
    {
      id: "event-1",
      fromStatus: "draft",
      toStatus: "sent",
      reason: "invoice_sent",
      metadataRedacted: null,
      createdAt: "2026-06-01T10:00:00.000Z"
    }
  ],
  publicUrl: "http://localhost:3000/invoice/public-token",
  paymentSummary: {
    available: true,
    provider: "paystack",
    amountKobo: 97500,
    currency: "NGN",
    message: "Paystack checkout is enabled on the public invoice page."
  }
} satisfies InvoiceDetailResponse;

beforeEach(() => {
  vi.mocked(getInvoice).mockResolvedValue(invoiceResponse);
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined)
    }
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InvoiceDetailContent public URL", () => {
  it("copies the public URL with inline feedback", async () => {
    render(<InvoiceDetailContent accessToken="token" invoiceId="invoice-1" role="owner" />);

    fireEvent.click(await screen.findByRole("button", { name: "Copy public URL" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "http://localhost:3000/invoice/public-token"
    );
    await waitFor(() => expect(screen.getByText("Public URL copied.")).toBeInTheDocument());
    expect(screen.getByText(/Payment enabled/)).toBeInTheDocument();
    expect(screen.getByText("Not paid yet")).toBeInTheDocument();
  });

  it("shows webhook-confirmed paid amount, balance, and paid date", async () => {
    vi.mocked(getInvoice).mockResolvedValueOnce({
      ...invoiceResponse,
      invoice: {
        ...invoiceResponse.invoice,
        status: "paid",
        amountPaidKobo: 97500,
        balanceDueKobo: 0,
        paidAt: "2026-06-30T10:00:00.000Z"
      },
      paymentSummary: {
        available: false,
        reason: "no_outstanding_balance",
        message: "Online payment is unavailable for this invoice."
      }
    });

    render(<InvoiceDetailContent accessToken="token" invoiceId="invoice-1" role="owner" />);

    expect(await screen.findByText("Paid")).toBeInTheDocument();
    expect(screen.getAllByText("NGN 975.00").length).toBeGreaterThan(0);
    expect(screen.getByText("NGN 0.00")).toBeInTheDocument();
    expect(screen.getByText("30 Jun 2026")).toBeInTheDocument();
  });

  it("shows a Payment Setup CTA to owners when online payments are not active", async () => {
    vi.mocked(getInvoice).mockResolvedValueOnce({
      ...invoiceResponse,
      paymentSummary: {
        available: false,
        reason: "payment_setup_incomplete",
        message:
          "Online payments are not active. Complete Payment Setup to allow customers to pay this invoice online."
      }
    });

    render(<InvoiceDetailContent accessToken="token" invoiceId="invoice-1" role="owner" />);

    expect(await screen.findByText(/Online payments are not active/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Payment Setup" })).toHaveAttribute(
      "href",
      "/settings/payment-setup"
    );
  });
});
