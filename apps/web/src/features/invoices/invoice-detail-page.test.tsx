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
    available: false,
    message: "Payments will be available after payment processing is implemented."
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
  });
});
