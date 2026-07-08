import type { Invoice } from "../../database/schema";

type InvoiceStatusValue = Invoice["status"];

export function shouldDisplayAsOverdue(input: {
  balanceDueKobo: number;
  dueDate: string;
  status: InvoiceStatusValue;
  today?: Date;
}) {
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

export function displayInvoiceStatus(
  invoice: Pick<Invoice, "balanceDueKobo" | "dueDate" | "status">,
  today?: Date
): InvoiceStatusValue {
  const overdueInput = {
    balanceDueKobo: invoice.balanceDueKobo,
    dueDate: invoice.dueDate,
    status: invoice.status
  };

  return shouldDisplayAsOverdue(today ? { ...overdueInput, today } : overdueInput)
    ? "overdue"
    : invoice.status;
}
