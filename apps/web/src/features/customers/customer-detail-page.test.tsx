import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerDetailContent } from "./customer-detail-page";
import { getCustomer } from "./customers-api";
import type { CustomerDetailResponse } from "./types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

vi.mock("./customers-api", () => ({
  archiveCustomer: vi.fn(),
  getCustomer: vi.fn()
}));

const customerResponse = {
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
  invoiceSummary: {
    available: true,
    totalInvoices: 2,
    totalInvoicedKobo: 147500,
    totalPaidKobo: 75000,
    totalBalanceDueKobo: 72500,
    message: "2 invoices found for this customer."
  },
  invoices: [
    {
      id: "invoice-1",
      invoiceNumber: "INV-000007",
      status: "sent",
      currency: "NGN",
      issueDate: "2026-06-01",
      dueDate: "2026-06-15",
      totalKobo: 97500,
      amountPaidKobo: 25000,
      balanceDueKobo: 72500,
      publicAccessEnabled: true,
      sentAt: "2026-06-01T10:00:00.000Z",
      paidAt: null,
      createdAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:00:00.000Z"
    },
    {
      id: "invoice-2",
      invoiceNumber: "INV-000008",
      status: "paid",
      currency: "NGN",
      issueDate: "2026-06-02",
      dueDate: "2026-06-16",
      totalKobo: 50000,
      amountPaidKobo: 50000,
      balanceDueKobo: 0,
      publicAccessEnabled: true,
      sentAt: "2026-06-02T10:00:00.000Z",
      paidAt: "2026-06-05T10:00:00.000Z",
      createdAt: "2026-06-02T10:00:00.000Z",
      updatedAt: "2026-06-05T10:00:00.000Z"
    }
  ]
} satisfies CustomerDetailResponse;

beforeEach(() => {
  vi.mocked(getCustomer).mockResolvedValue(customerResponse);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CustomerDetailContent invoice history", () => {
  it("renders invoice history totals and invoice links", async () => {
    render(<CustomerDetailContent accessToken="token" customerId="customer-1" role="owner" />);

    expect(await screen.findByRole("heading", { name: "Invoice history" })).toBeInTheDocument();
    expect(screen.getByText("2 invoices found for this customer.")).toBeInTheDocument();
    expect(screen.getByText("NGN 1,475.00")).toBeInTheDocument();
    expect(screen.getByText("NGN 750.00")).toBeInTheDocument();
    expect(screen.getAllByText("NGN 725.00")).toHaveLength(2);

    const invoiceLink = screen.getByRole("link", { name: "INV-000007" });
    expect(invoiceLink).toHaveAttribute("href", "/invoices/invoice-1");
    expect(screen.getByText("Sent")).toBeInTheDocument();
    expect(screen.getAllByText("Paid")).toHaveLength(3);
  });

  it("renders an empty invoice history state", async () => {
    vi.mocked(getCustomer).mockResolvedValueOnce({
      ...customerResponse,
      invoiceSummary: {
        available: true,
        totalInvoices: 0,
        totalInvoicedKobo: 0,
        totalPaidKobo: 0,
        totalBalanceDueKobo: 0,
        message: "No invoices have been created for this customer yet."
      },
      invoices: []
    });

    render(<CustomerDetailContent accessToken="token" customerId="customer-1" role="viewer" />);

    expect(
      await screen.findByText("No invoices have been created for this customer yet.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create an invoice for this customer and it will appear here.")
    ).toBeInTheDocument();
  });
});
