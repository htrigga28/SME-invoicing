export type RecurringFrequency = "weekly" | "monthly" | "quarterly" | "yearly";
export type RecurringStatus = "active" | "paused" | "completed" | "cancelled";

export type RecurringSchedule = {
  id: string;
  organisationId: string;
  customerId: string;
  customerName?: string;
  name: string;
  status: RecurringStatus;
  frequency: RecurringFrequency;
  startDate: string;
  nextIssueDate: string;
  endDate: string | null;
  dueTermsDays: number;
  autoSend: boolean;
  toRecipients: string[];
  ccRecipients: string[];
  amountKobo: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecurringLineItem = {
  description: string;
  quantity: number;
  unitPriceKobo: number;
  catalogueItemId?: string | null;
};

export function nextIssuePreview(startDate: string, frequency: RecurringFrequency, dueTermsDays: number): string {
  const due = new Date(startDate);
  due.setDate(due.getDate() + dueTermsDays);
  return `Next invoice: ${startDate} · Due ${due.toISOString().slice(0, 10)}`;
}

export function canManageRecurring(role: string): boolean {
  return ["owner", "admin", "accountant"].includes(role);
}
