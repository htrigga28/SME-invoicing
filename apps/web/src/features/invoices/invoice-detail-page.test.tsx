import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvoiceDetailContent } from "./invoice-detail-page";
import { getInvoice, getInvoiceActivity, resendInvoiceEmail, sendInvoice } from "./invoices-api";
import type { InvoiceActivityItem, InvoiceDetailResponse } from "./types";

vi.mock("./invoices-api", () => ({
  cancelInvoice: vi.fn(),
  duplicateInvoice: vi.fn(),
  getInvoice: vi.fn(),
  getInvoiceActivity: vi.fn(),
  resendInvoiceEmail: vi.fn(),
  sendInvoice: vi.fn(),
  voidInvoice: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
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
    customerReference: "PO-2026-042",
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
    lastViewedAt: null,
    viewCount: 0,
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
  financialSummary: {
    grossSuccessfulKobo: 0,
    processedRefundsKobo: 0,
    netReceivedKobo: 0,
    appliedToInvoiceKobo: 0,
    overpaymentKobo: 0,
    balanceDueKobo: 97500,
    paymentCount: 0,
    successfulPaymentCount: 0,
    hasOverpayment: false
  },
  delivery: {
    state: "delivered",
    message: "Email delivered.",
    attempts: 1,
    lastCommunication: {
      id: "comm-1",
      subject: "Invoice INV-000007",
      toRecipients: ["accounts@lagosbrightprints.test"],
      ccRecipients: [],
      status: "delivered",
      acceptedAt: "2026-06-01T10:01:00.000Z",
      deliveredAt: "2026-06-01T10:02:00.000Z",
      deferredAt: null,
      failedAt: null,
      failureReason: null,
      recipients: [],
      createdAt: "2026-06-01T10:01:00.000Z",
      updatedAt: "2026-06-01T10:02:00.000Z"
    }
  },
  viewSummary: null,
  payments: [],
  publicUrl: "http://localhost:3000/invoice/public-token",
  paymentSummary: {
    available: true,
    provider: "paystack",
    amountKobo: 97500,
    currency: "NGN",
    message: "Paystack checkout is enabled on the public invoice page."
  }
} satisfies InvoiceDetailResponse;

const sentActivity: InvoiceActivityItem[] = [
  {
    id: "status-event-1",
    type: "invoice_sent",
    occurredAt: "2026-06-01T10:00:00.000Z",
    title: "Invoice sent",
    detail: "Invoice issued and public access enabled.",
    tone: "success"
  },
  {
    id: "status-event-0",
    type: "invoice_created",
    occurredAt: "2026-06-01T09:00:00.000Z",
    title: "Invoice created",
    tone: "info"
  }
];

beforeEach(() => {
  vi.mocked(getInvoice).mockResolvedValue(invoiceResponse);
  vi.mocked(getInvoiceActivity).mockResolvedValue({ activity: sentActivity, viewSummary: null });
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined)
    }
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
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
    expect(screen.getByText("Invoice sent")).toBeInTheDocument();
    expect(screen.queryByText(/invoice_sent/)).not.toBeInTheDocument();
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

    expect(await screen.findAllByText("Paid")).not.toHaveLength(0);
    expect(screen.getAllByText("NGN 975.00").length).toBeGreaterThan(0);
    expect(screen.getByText("NGN 0.00")).toBeInTheDocument();
    expect(screen.getByText("30 Jun 2026")).toBeInTheDocument();
  });

  it("renders linked payment history with receipt links when available", async () => {
    vi.mocked(getInvoice).mockResolvedValueOnce({
      ...invoiceResponse,
      payments: [
        {
          id: "payment-1",
          provider: "paystack",
          providerReference: "PAYSTACK_DEMO_INV000007_SUCCESSFUL",
          status: "successful",
          reconciliationState: "matched",
          currency: "NGN",
          amountKobo: 97500,
          paidAt: "2026-06-30T10:00:00.000Z",
          failedAt: null,
          abandonedAt: null,
          initializedAt: "2026-06-30T09:59:00.000Z",
          createdAt: "2026-06-30T09:59:00.000Z",
          settlementAccount: {
            provider: "paystack",
            bankName: "United Bank for Africa",
            accountName: "Akin & Co Creative Services",
            accountNumberLast4: "9090",
            status: "disabled"
          },
          receipt: {
            id: "receipt-1",
            receiptNumber: "RCT-000001",
            issuedAt: "2026-06-30T10:01:00.000Z"
          }
        }
      ]
    });

    render(<InvoiceDetailContent accessToken="token" invoiceId="invoice-1" role="viewer" />);

    expect(await screen.findByText("PAYSTACK_DEMO_INV000007_SUCCESSFUL")).toBeInTheDocument();
    expect(screen.getByText("NGN 975.00 • United Bank for Africa • ****9090")).toBeInTheDocument();
    expect(screen.getByText("RCT-000001")).toBeInTheDocument();
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

describe("InvoiceDetailContent delivery", () => {
  it("shows the delivery badge separately from the invoice status", async () => {
    render(<InvoiceDetailContent accessToken="token" invoiceId="invoice-1" role="owner" />);

    expect(await screen.findByText("Delivered")).toBeInTheDocument();
    expect(screen.getAllByText("Sent").length).toBeGreaterThan(0);
  });

  it("renders the unified activity timeline with a collapsed view summary", async () => {
    vi.mocked(getInvoiceActivity).mockResolvedValueOnce({
      activity: [
        {
          id: "view-summary",
          type: "invoice_viewed",
          occurredAt: "2026-09-19T08:44:00.000Z",
          title: "Invoice viewed",
          detail: "Viewed 4 times · first 18 Sept, 10:12 · last 19 Sept, 08:44",
          tone: "info"
        },
        {
          id: "email-comm-1-delivered",
          type: "email_delivered",
          occurredAt: "2026-09-18T09:19:00.000Z",
          title: "Email delivered",
          detail: "Delivered to accounts@lagosbrightprints.test.",
          tone: "success"
        }
      ],
      viewSummary: { viewCount: 4, firstViewedAt: "2026-09-18T10:12:00.000Z", lastViewedAt: "2026-09-19T08:44:00.000Z" }
    });

    render(<InvoiceDetailContent accessToken="token" invoiceId="invoice-1" role="owner" />);

    expect(await screen.findByText("Invoice viewed")).toBeInTheDocument();
    expect(screen.getByText(/Viewed 4 times/)).toBeInTheDocument();
    expect(screen.getByText("Email delivered")).toBeInTheDocument();
    expect(screen.queryByText(/sent → viewed/)).not.toBeInTheDocument();
  });

  it("opens the send dialog prefilled and submits recipients", async () => {
    const draftResponse = {
      ...invoiceResponse,
      invoice: { ...invoiceResponse.invoice, status: "draft" as const, publicAccessEnabled: false },
      delivery: { ...invoiceResponse.delivery, state: "not_emailed" as const },
      publicUrl: null
    };
    vi.mocked(getInvoice).mockResolvedValueOnce(draftResponse);
    vi.mocked(sendInvoice).mockResolvedValue({
      ...draftResponse,
      invoice: { ...draftResponse.invoice, status: "sent" as const, publicAccessEnabled: true },
      publicUrl: "http://localhost:3000/invoice/public-token",
      delivery: { ...draftResponse.delivery, state: "accepted" as const }
    });

    render(<InvoiceDetailContent accessToken="token" invoiceId="invoice-1" role="owner" />);

    fireEvent.click(await screen.findByRole("button", { name: "Send invoice" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Recipient email addresses")).toHaveValue(
      "accounts@lagosbrightprints.test"
    );

    fireEvent.change(within(dialog).getByLabelText(/CC email/), {
      target: { value: "finance@example.com, bad-email" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send invoice" }));
    expect(await within(dialog).findByText(/not a valid email/)).toBeInTheDocument();
    expect(sendInvoice).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/CC email/), {
      target: { value: "finance@example.com" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send invoice" }));

    await waitFor(() =>
      expect(sendInvoice).toHaveBeenCalledWith("token", "invoice-1", {
        to: ["accounts@lagosbrightprints.test"],
        cc: ["finance@example.com"],
        subject: "Invoice INV-000007"
      })
    );
    expect(await screen.findByText(/Invoice emailed/)).toBeInTheDocument();
  });

  it("shows partial success with copy and resend actions when email fails", async () => {
    const draftResponse = {
      ...invoiceResponse,
      invoice: { ...invoiceResponse.invoice, status: "draft" as const, publicAccessEnabled: false },
      delivery: { ...invoiceResponse.delivery, state: "not_emailed" as const },
      publicUrl: null
    };
    vi.mocked(getInvoice).mockResolvedValueOnce(draftResponse);
    vi.mocked(sendInvoice).mockResolvedValue({
      ...draftResponse,
      invoice: { ...draftResponse.invoice, status: "sent" as const, publicAccessEnabled: true },
      publicUrl: "http://localhost:3000/invoice/public-token",
      delivery: {
        ...draftResponse.delivery,
        state: "failed" as const,
        message: "Invoice issued, but the email could not be sent. Copy the public link or try again."
      }
    });
    vi.mocked(resendInvoiceEmail).mockResolvedValue({
      delivery: { ...draftResponse.delivery, state: "accepted" as const }
    });

    render(<InvoiceDetailContent accessToken="token" invoiceId="invoice-1" role="owner" />);

    fireEvent.click(await screen.findByRole("button", { name: "Send invoice" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Send invoice" }));

    expect(await screen.findByText(/Invoice issued, but the email could not be sent/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy public link" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "http://localhost:3000/invoice/public-token"
    );

    fireEvent.click(screen.getByRole("button", { name: "Resend email" }));
    const resendDialog = await screen.findByRole("dialog");
    fireEvent.click(within(resendDialog).getByRole("button", { name: "Resend email" }));

    await waitFor(() =>
      expect(resendInvoiceEmail).toHaveBeenCalledWith("token", "invoice-1", {
        to: ["accounts@lagosbrightprints.test"],
        cc: [],
        subject: "Invoice INV-000007"
      })
    );
  });

  it("auto-opens the send dialog from the save-and-send flow", async () => {
    window.history.replaceState({}, "", "/invoices/invoice-1?send=1");
    vi.mocked(getInvoice).mockResolvedValueOnce({
      ...invoiceResponse,
      invoice: { ...invoiceResponse.invoice, status: "draft" as const, publicAccessEnabled: false },
      delivery: { ...invoiceResponse.delivery, state: "not_emailed" as const },
      publicUrl: null
    });

    render(<InvoiceDetailContent accessToken="token" invoiceId="invoice-1" role="owner" />);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Send INV-000007?")).toBeInTheDocument();
  });

  it("hides send actions from viewers", async () => {
    render(<InvoiceDetailContent accessToken="token" invoiceId="invoice-1" role="viewer" />);

    await screen.findByText("Delivered");
    expect(screen.queryByRole("button", { name: "Send invoice" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("More invoice actions")).not.toBeInTheDocument();
  });

  it("shows partial failure and recipient-specific activity without hiding the delivery", async () => {
    vi.mocked(getInvoice).mockResolvedValueOnce({
      ...invoiceResponse,
      delivery: {
        ...invoiceResponse.delivery,
        state: "partially_failed",
        message: "Email delivery partially failed. See the activity timeline for the affected addresses."
      }
    });
    vi.mocked(getInvoiceActivity).mockResolvedValueOnce({
      activity: [
        {
          id: "email-comm-1-recipient-bounce-failed",
          type: "email_failed",
          occurredAt: "2026-09-18T09:19:00.000Z",
          title: "Email to bounce@example.com failed",
          detail: "The email address bounced. Check the recipient and try again.",
          tone: "danger"
        },
        {
          id: "email-comm-1-accepted",
          type: "email_accepted",
          occurredAt: "2026-09-18T09:18:00.000Z",
          title: "Invoice emailed to accounts@example.com +1 more",
          detail: "Accepted by the email provider.",
          tone: "info"
        }
      ],
      viewSummary: null
    });

    render(<InvoiceDetailContent accessToken="token" invoiceId="invoice-1" role="owner" />);

    expect(await screen.findByText("Partially failed")).toBeInTheDocument();
    expect(screen.getByText("Email to bounce@example.com failed")).toBeInTheDocument();
    expect(screen.getByText("Invoice emailed to accounts@example.com +1 more")).toBeInTheDocument();
  });
});
