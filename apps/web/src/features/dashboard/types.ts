import type {
  AttemptState,
  InvoiceStatus,
  PaymentStatus,
  ReconciliationState
} from "@sme-invoicing/shared";

export type DashboardGranularity = "day" | "month" | "week";

export type DashboardOverviewResponse = {
  period: {
    dateFrom: string;
    dateTo: string;
    granularity: DashboardGranularity;
    timezone: "Africa/Lagos";
  };
  financialActivity: {
    grossCollectedKobo: number;
    processedRefundsKobo: number;
    netCollectedKobo: number;
    successfulPaymentCount: number;
    processedRefundCount: number;
    receiptsIssuedCount: number;
  };
  currentPosition: {
    outstandingKobo: number;
    overdueKobo: number;
    outstandingInvoiceCount: number;
    overdueInvoiceCount: number;
    activePendingPaymentCount: number;
    unresolvedReviewCount: number;
  };
  invoiceStatusBreakdown: {
    status: InvoiceStatus;
    count: number;
    balanceKobo: number;
  }[];
  outstandingAging: {
    notDueKobo: number;
    overdue1To7DaysKobo: number;
    overdue8To30DaysKobo: number;
    overdue31PlusDaysKobo: number;
  };
  cashflowTrend: {
    period: string;
    grossCollectedKobo: number;
    processedRefundsKobo: number;
    netCollectedKobo: number;
  }[];
  recentInvoices: {
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    currency: string;
    totalKobo: number;
    balanceDueKobo: number;
    dueDate: string;
    createdAt: string;
    customer: {
      id: string;
      name: string;
    };
  }[];
  recentPayments: {
    id: string;
    providerReference: string;
    amountKobo: number;
    currency: string;
    state: AttemptState;
    status: PaymentStatus;
    paidAt: string | null;
    createdAt: string;
    invoice: {
      id: string;
      invoiceNumber: string;
    } | null;
    customer: {
      id: string;
      name: string;
    } | null;
  }[];
  recentReceipts: {
    id: string;
    receiptNumber: string;
    amountKobo: number;
    currency: string;
    issuedAt: string;
    invoice: {
      id: string;
      invoiceNumber: string;
    };
    customer: {
      id: string;
      name: string;
    };
    refundSummary: {
      processedRefundedKobo: number;
      hasRefundInProgress: boolean;
      refundState: "in_progress" | "none" | "partially_refunded" | "refunded";
    };
  }[];
  reviewIssues: {
    id: string;
    type: "payment";
    summary: string;
    state: ReconciliationState;
    reviewState: "none" | "open" | "resolution_in_progress" | "resolved";
    amountKobo: number;
    createdAt: string;
    paymentId: string;
    invoice: {
      id: string;
      invoiceNumber: string;
    } | null;
    customer: {
      id: string;
      name: string;
    } | null;
  }[];
  paymentSetup:
    | {
        status: "not_configured";
        canAcceptOnlinePayments: false;
      }
    | {
        status: "active" | "disabled" | "verification_delayed";
        canAcceptOnlinePayments: boolean;
        bankName: string;
        accountNumberLast4: string;
      };
};
