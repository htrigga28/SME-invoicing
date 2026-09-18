export type EmailRecipient = {
  email: string;
  name?: string | null | undefined;
};

export type InvoiceEmailContent = {
  businessName: string;
  customerName: string;
  invoiceNumber: string;
  amountDueKobo: number;
  currency: string;
  dueDate: string;
  publicUrl: string;
};

export type SendEmailInput = {
  fromEmail: string;
  fromName: string;
  replyToEmail?: string | null | undefined;
  to: EmailRecipient[];
  cc: EmailRecipient[];
  subject: string;
  htmlContent: string;
  textContent: string;
  tags: string[];
};

export type SendEmailResult = {
  providerMessageId: string;
};

export interface EmailProvider {
  readonly name: "brevo";
  isConfigured(): boolean;
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_EMAIL_RECIPIENTS = 10;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function assertValidEmail(value: string, field: string): string {
  const normalized = normalizeEmail(value);

  if (!normalized || normalized.length > 320 || !EMAIL_PATTERN.test(normalized)) {
    throw new Error(`${field} must be a valid email address.`);
  }

  return normalized;
}

export function normalizeRecipients(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const email = normalizeEmail(value);

    if (!email || seen.has(email)) {
      continue;
    }

    seen.add(email);
    normalized.push(email);
  }

  return normalized;
}

export function validateSendRecipients(to: string[], cc: string[]): { to: string[]; cc: string[] } {
  const normalizedTo = normalizeRecipients(to);
  const normalizedCc = normalizeRecipients(cc).filter((email) => !normalizedTo.includes(email));

  if (normalizedTo.length === 0) {
    throw new Error("At least one To recipient is required.");
  }

  for (const email of [...normalizedTo, ...normalizedCc]) {
    assertValidEmail(email, "Recipient");
  }

  if (normalizedTo.length + normalizedCc.length > MAX_EMAIL_RECIPIENTS) {
    throw new Error(`No more than ${MAX_EMAIL_RECIPIENTS} recipients are allowed.`);
  }

  return { to: normalizedTo, cc: normalizedCc };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatKoboToNaira(amountKobo: number): string {
  return `₦${(amountKobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function defaultInvoiceEmailSubject(invoiceNumber: string, businessName: string): string {
  return `Invoice ${invoiceNumber} from ${businessName}`;
}

export function buildInvoiceEmailText(content: InvoiceEmailContent): string {
  return [
    `Hello ${content.customerName},`,
    "",
    `${content.businessName} sent you invoice ${content.invoiceNumber} for ${formatKoboToNaira(content.amountDueKobo)} (${content.currency}).`,
    `Payment is due on ${content.dueDate}.`,
    "",
    "View and pay your invoice online:",
    content.publicUrl,
    "",
    "Thank you for your business."
  ].join("\n");
}

export function buildInvoiceEmailHtml(content: InvoiceEmailContent): string {
  const businessName = escapeHtml(content.businessName);
  const customerName = escapeHtml(content.customerName);
  const invoiceNumber = escapeHtml(content.invoiceNumber);
  const dueDate = escapeHtml(content.dueDate);
  const amount = escapeHtml(formatKoboToNaira(content.amountDueKobo));
  const url = escapeHtml(content.publicUrl);

  return [
    "<!doctype html>",
    '<html><body style="font-family:Arial,sans-serif;color:#17211c;line-height:1.6;">',
    `<p>Hello ${customerName},</p>`,
    `<p>${businessName} sent you invoice <strong>${invoiceNumber}</strong> for <strong>${amount}</strong>. Payment is due on ${dueDate}.</p>`,
    `<p><a href="${url}" style="display:inline-block;background:#245c46;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">View invoice</a></p>`,
    `<p style="color:#4f5f56;font-size:13px;">If the button does not work, open this link:<br><a href="${url}">${url}</a></p>`,
    "<p>Thank you for your business.</p>",
    "</body></html>"
  ].join("");
}
