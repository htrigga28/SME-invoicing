import type { InvoiceStatus } from "@sme-invoicing/shared";

export type PublicInvoiceResponse = {
  invoice: {
    invoiceNumber: string;
    status: InvoiceStatus;
    currency: string;
    issueDate: string;
    dueDate: string;
    notes: string | null;
    subtotalKobo: number;
    discountKobo: number;
    taxKobo: number;
    totalKobo: number;
    amountPaidKobo: number;
    balanceDueKobo: number;
    sentAt: string | null;
    viewedAt: string | null;
    paidAt: string | null;
  };
  business: {
    businessName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    logoUrl: string | null;
  };
  customer: {
    name: string;
    email: string;
    phone: string | null;
    billingAddress: string | null;
  };
  lineItems: {
    description: string;
    quantity: number;
    unitPriceKobo: number;
    lineTotalKobo: number;
    sortOrder: number;
  }[];
  paymentSummary:
    | {
        available: true;
        provider: "paystack";
        amountKobo: number;
        currency: "NGN";
        message: string;
      }
    | {
        available: false;
        message: string;
        reason:
          | "invoice_unavailable"
          | "no_outstanding_balance"
          | "payment_setup_disabled"
          | "payment_setup_incomplete"
          | "payment_setup_pending"
          | "payment_unavailable";
      };
};

export type PublicInvoicePaymentInitialization = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};
