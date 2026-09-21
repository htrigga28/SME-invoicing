import type { Invoice } from "../../database/schema";
import { businessDate } from "../../common/business-date";

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

  return input.dueDate < businessDate(input.today);
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
