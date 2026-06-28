import type { InvoiceStatus } from "./constants";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  void: "Void"
};

export type InvoiceCalculationLineItem = {
  quantity: number;
  unitPriceKobo: number;
};

export type InvoiceCalculationResult = {
  lineTotalsKobo: number[];
  subtotalKobo: number;
  discountKobo: number;
  taxKobo: number;
  totalKobo: number;
  amountPaidKobo: number;
  balanceDueKobo: number;
};

export function calculateInvoiceTotals(input: {
  discountKobo?: number;
  lineItems: InvoiceCalculationLineItem[];
  taxKobo?: number;
}): InvoiceCalculationResult {
  const lineTotalsKobo = input.lineItems.map((item) =>
    Math.round(item.quantity * item.unitPriceKobo)
  );
  const subtotalKobo = lineTotalsKobo.reduce((sum, lineTotal) => sum + lineTotal, 0);
  const discountKobo = input.discountKobo ?? 0;
  const taxKobo = input.taxKobo ?? 0;
  const totalKobo = subtotalKobo - discountKobo + taxKobo;

  return {
    lineTotalsKobo,
    subtotalKobo,
    discountKobo,
    taxKobo,
    totalKobo,
    amountPaidKobo: 0,
    balanceDueKobo: totalKobo
  };
}

export function formatInvoiceNumber(sequenceNumber: number): string {
  return `INV-${sequenceNumber.toString().padStart(6, "0")}`;
}

export function shouldDisplayAsOverdue(input: {
  balanceDueKobo: number;
  dueDate: string;
  status: InvoiceStatus;
  today?: Date;
}): boolean {
  if (["draft", "paid", "cancelled", "void"].includes(input.status)) {
    return false;
  }

  if (input.balanceDueKobo <= 0) {
    return false;
  }

  const today = input.today ?? new Date();
  const dueDate = new Date(`${input.dueDate}T00:00:00.000Z`);
  const todayStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  return dueDate < todayStart;
}
