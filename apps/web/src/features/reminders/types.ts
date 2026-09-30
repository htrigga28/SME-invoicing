export type ReminderStep = {
  id: string;
  relativeDays: number;
  subjectTemplate: string;
  bodyTemplate: string;
  enabled: boolean;
};

export function relativeDayLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} days before due`;
  if (days === 0) return "On due date";
  if (days === 1) return "1 day overdue";
  return `${days} days overdue`;
}

export function validateReminderStep(step: { relativeDays: number; subjectTemplate: string; bodyTemplate: string }): string | null {
  if (!Number.isInteger(step.relativeDays) || step.relativeDays < -30 || step.relativeDays > 60) {
    return "Timing must be between -30 and +60 days.";
  }
  if (!step.subjectTemplate.trim() || !step.bodyTemplate.trim()) {
    return "Subject and message are required.";
  }
  const allowed = ["businessName", "customerName", "invoiceNumber", "amountDue", "dueDate", "publicInvoiceUrl"];
  const found = [...step.subjectTemplate.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g), ...step.bodyTemplate.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]);
  const unknown = [...new Set(found)].filter((v) => !allowed.includes(v as string));
  if (unknown.length > 0) return `Unknown variable: ${unknown.map((v) => `{{${v}}}`).join(", ")}`;
  return null;
}

export function previewReminder(template: string, sample: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name: string) => sample[name] ?? "");
}

export const REMINDER_SAMPLE = {
  businessName: "Adebayo Studio",
  customerName: "Northstar Projects",
  invoiceNumber: "INV-000184",
  amountDue: "₦78,400.00",
  dueDate: "2026-09-30",
  publicInvoiceUrl: "https://app.lumina.akhigbe.xyz/invoice/demo-token"
};
