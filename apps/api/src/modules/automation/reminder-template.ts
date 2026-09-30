import { escapeHtml } from "../communications/email-provider";

export const REMINDER_TEMPLATE_VARIABLES = [
  "businessName",
  "customerName",
  "invoiceNumber",
  "amountDue",
  "dueDate",
  "publicInvoiceUrl"
] as const;

export type ReminderTemplateVariable = (typeof REMINDER_TEMPLATE_VARIABLES)[number];

export type ReminderTemplateContext = Record<ReminderTemplateVariable, string>;

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function extractTemplateVariables(template: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  VARIABLE_PATTERN.lastIndex = 0;
  while ((match = VARIABLE_PATTERN.exec(template)) !== null) {
    found.add(match[1]!);
  }
  return [...found];
}

export function assertValidReminderTemplate(template: string, field: string): void {
  const vars = extractTemplateVariables(template);
  const allowed = new Set<string>(REMINDER_TEMPLATE_VARIABLES);
  const unknown = vars.filter((v) => !allowed.has(v));
  if (unknown.length > 0) {
    throw new Error(
      `${field} uses unknown variable${unknown.length > 1 ? "s" : ""}: ${unknown.map((v) => `{{${v}}}`).join(", ")}. Allowed: ${REMINDER_TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(", ")}.`
    );
  }
}

export function renderReminderTemplate(template: string, context: ReminderTemplateContext): string {
  assertValidReminderTemplate(template, "Template");
  return template.replace(VARIABLE_PATTERN, (_, name: string) => context[name as ReminderTemplateVariable] ?? "");
}

export function renderReminderHtml(bodyText: string, context: ReminderTemplateContext): string {
  const rendered = renderReminderTemplate(bodyText, context);
  const escaped = escapeHtml(rendered);
  const withLinks = escaped.replace(
    escapeHtml(context.publicInvoiceUrl),
    `<a href="${escapeHtml(context.publicInvoiceUrl)}">${escapeHtml(context.publicInvoiceUrl)}</a>`
  );
  return [
    "<!doctype html>",
    '<html><body style="font-family:Arial,sans-serif;color:#17211c;line-height:1.6;">',
    `<p>${withLinks.replace(/\n/g, "<br>")}</p>`,
    "</body></html>"
  ].join("");
}

export function formatKoboToNairaText(amountKobo: number): string {
  return `₦${(amountKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}



