import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api";

import { PublicInvoicePage } from "./public-invoice-page";
import {
  getPublicInvoice,
  initializePublicInvoicePayment,
  markPublicInvoiceViewed
} from "./public-invoices-api";
import type { PublicInvoiceResponse } from "./types";

vi.mock("./public-invoices-api", () => ({
  getPublicInvoice: vi.fn(),
  initializePublicInvoicePayment: vi.fn(),
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
    available: true,
    provider: "paystack",
    amountKobo: 97500,
    currency: "NGN",
    message: "Pay securely online."
  }
} satisfies PublicInvoiceResponse;

const locationAssign = vi.fn();

beforeEach(() => {
  vi.mocked(getPublicInvoice).mockResolvedValue(publicInvoice);
  vi.mocked(initializePublicInvoicePayment).mockResolvedValue({
    authorizationUrl: "https://checkout.paystack.test/pay/reference",
    accessCode: "access-code",
    reference: "SME-INV000007-ABC123"
  });
  vi.mocked(markPublicInvoiceViewed).mockResolvedValue({ success: true });
  vi.stubGlobal("location", { assign: locationAssign });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("PublicInvoicePage", () => {
  it("renders public invoice content without authenticated navigation", async () => {
    render(<PublicInvoicePage token="public-token" />);

    expect(await screen.findByText("Akin & Co Creative Services")).toBeInTheDocument();
    expect(screen.getByText("INV-000007")).toBeInTheDocument();
    expect(screen.getByText("Lagos Bright Prints")).toBeInTheDocument();
    expect(screen.getByText("Design retainer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pay .* online/ })).toBeEnabled();
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

  it("starts a Paystack payment and redirects to the authorization URL", async () => {
    render(<PublicInvoicePage token="public-token" />);

    fireEvent.click(await screen.findByRole("button", { name: /Pay .* online/ }));

    expect(await screen.findByRole("button", { name: "Redirecting..." })).toBeDisabled();
    await waitFor(() =>
      expect(initializePublicInvoicePayment).toHaveBeenCalledWith("public-token")
    );
    expect(locationAssign).toHaveBeenCalledWith("https://checkout.paystack.test/pay/reference");
  });

  it("shows a safe inline error when payment initialization fails", async () => {
    vi.mocked(initializePublicInvoicePayment).mockRejectedValueOnce(
      new ApiRequestError("This business has not activated online payments yet.", 409)
    );

    render(<PublicInvoicePage token="public-token" />);

    fireEvent.click(await screen.findByRole("button", { name: /Pay .* online/ }));

    expect(
      await screen.findByText("This business has not activated online payments yet.")
    ).toBeInTheDocument();
    expect(locationAssign).not.toHaveBeenCalled();
  });

  it("renders a callback notice without confirming payment client-side", async () => {
    render(<PublicInvoicePage paymentCallback token="public-token" />);

    expect(await screen.findByText("Payment confirmation pending")).toBeInTheDocument();
    expect(screen.getByText(/after Paystack confirms the transaction/)).toBeInTheDocument();
  });

  it("polls for webhook-confirmed payment updates after returning from the callback", async () => {
    const realSetInterval = window.setInterval;
    const setIntervalSpy = vi.spyOn(window, "setInterval").mockImplementation(((
      handler: TimerHandler
    ) => {
      if (typeof handler === "function") {
        handler();
      }

      const intervalId = realSetInterval(() => undefined, 0);
      window.clearInterval(intervalId);
      return intervalId;
    }) as typeof window.setInterval);
    vi.mocked(getPublicInvoice)
      .mockResolvedValueOnce(publicInvoice)
      .mockResolvedValueOnce({
        ...publicInvoice,
        invoice: {
          ...publicInvoice.invoice,
          status: "paid",
          amountPaidKobo: 97500,
          balanceDueKobo: 0,
          paidAt: "2026-06-30T10:00:00.000Z"
        },
        paymentSummary: {
          available: false,
          reason: "no_outstanding_balance",
          message: "This invoice has no outstanding balance."
        }
      });

    render(<PublicInvoicePage paymentCallback token="public-token" />);

    await screen.findByText("This invoice has no outstanding balance.");
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
    expect(screen.queryByText("Payment confirmation pending")).not.toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pay online unavailable" })
    ).not.toBeInTheDocument();
  });

  it("keeps the pay button disabled when payment is unavailable", async () => {
    vi.mocked(getPublicInvoice).mockResolvedValueOnce({
      ...publicInvoice,
      paymentSummary: {
        available: false,
        reason: "payment_unavailable",
        message: "Online payment is unavailable for this invoice."
      }
    });

    render(<PublicInvoicePage token="public-token" />);

    expect(await screen.findByRole("button", { name: "Pay online unavailable" })).toBeDisabled();
    expect(initializePublicInvoicePayment).not.toHaveBeenCalled();
  });

  it.each([
    {
      reason: "payment_setup_incomplete" as const,
      message: "This business has not activated online payments yet."
    },
    {
      reason: "payment_setup_pending" as const,
      message: "Online payments are not active for this business yet."
    },
    {
      reason: "payment_setup_disabled" as const,
      message: "Online payments are currently disabled for this business."
    }
  ])("disables Pay Online when setup state is $reason", async ({ message, reason }) => {
    vi.mocked(getPublicInvoice).mockResolvedValueOnce({
      ...publicInvoice,
      paymentSummary: {
        available: false,
        reason,
        message
      }
    });

    render(<PublicInvoicePage token="public-token" />);

    expect(await screen.findByRole("button", { name: "Pay online unavailable" })).toBeDisabled();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(initializePublicInvoicePayment).not.toHaveBeenCalled();
    expect(screen.queryByText(/ACCT_/)).not.toBeInTheDocument();
  });

  it("hides the callback notice after webhook-confirmed payment makes the invoice non-payable", async () => {
    vi.mocked(getPublicInvoice).mockResolvedValueOnce({
      ...publicInvoice,
      invoice: {
        ...publicInvoice.invoice,
        status: "paid",
        amountPaidKobo: 97500,
        balanceDueKobo: 0,
        paidAt: "2026-06-30T10:00:00.000Z"
      },
      paymentSummary: {
        available: false,
        reason: "no_outstanding_balance",
        message: "This invoice has no outstanding balance."
      }
    });

    render(<PublicInvoicePage paymentCallback token="public-token" />);

    expect(await screen.findByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("This invoice has no outstanding balance.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pay online unavailable" })
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("NGN 0.00").length).toBeGreaterThan(0);
    expect(screen.queryByText("Payment confirmation pending")).not.toBeInTheDocument();
  });
});
