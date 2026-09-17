import { calculateInvoiceTotals, convertNairaToKobo } from "@sme-invoicing/shared";

import type { InvoiceFormState, InvoiceMutationPayload } from "./types";

export type InvoiceFormErrors = Partial<
  Record<
    | "customerId"
    | "customerReference"
    | "dueDate"
    | "issueDate"
    | "lineItems"
    | "discountNaira"
    | "taxNaira"
    | "notes",
    string
  >
>;

export const MAX_KOBO = 2_147_483_647;
export const MAX_QUANTITY = 99_999_999.99;

export const DUE_DATE_PRESETS = [
  { label: "Net 7", days: 7 },
  { label: "Net 14", days: 14 },
  { label: "Net 30", days: 30 }
] as const;

export function applyDueDatePreset(issueDate: string, days: number) {
  const base = new Date(`${issueDate}T00:00:00.000Z`);

  if (Number.isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setUTCDate(fallback.getUTCDate() + days);
    return fallback.toISOString().slice(0, 10);
  }

  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function validateInvoiceForm(input: InvoiceFormState): InvoiceFormErrors {
  const errors: InvoiceFormErrors = {};

  if (!input.customerId) {
    errors.customerId = "Customer is required.";
  }

  if (!input.issueDate) {
    errors.issueDate = "Issue date is required.";
  }

  if (!input.dueDate) {
    errors.dueDate = "Due date is required.";
  }

  if (input.issueDate && input.dueDate && input.dueDate < input.issueDate) {
    errors.dueDate = "Due date must be on or after issue date.";
  }

  if (input.customerReference.trim().length > 120) {
    errors.customerReference = "Customer reference must be 120 characters or fewer.";
  }

  const validLineItems = input.lineItems.filter((item) => item.description.trim());

  if (validLineItems.length === 0) {
    errors.lineItems = "At least one line item is required.";
  }

  for (const item of validLineItems) {
    const quantity = Number(item.quantity);

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > MAX_QUANTITY ||
      Math.abs(quantity * 100 - Math.round(quantity * 100)) > 0.00000001
    ) {
      errors.lineItems = "Quantities must be greater than 0, at most 99,999,999.99, with 2 decimals.";
      break;
    }

    if (!item.unitPriceNaira.trim()) {
      errors.lineItems = "Line items need a description, quantity, and unit price.";
      break;
    }

    if (item.description.trim().length > 500) {
      errors.lineItems = "Line descriptions must be 500 characters or fewer.";
      break;
    }

    try {
      const unitKobo = convertNairaToKobo(item.unitPriceNaira.trim());

      if (!Number.isSafeInteger(unitKobo) || unitKobo < 0 || unitKobo > MAX_KOBO) {
        errors.lineItems = "Unit prices must be from NGN 0.00 through NGN 21,474,836.47.";
        break;
      }

      const lineTotal = Math.round(quantity * unitKobo);

      if (!Number.isSafeInteger(lineTotal) || lineTotal < 0 || lineTotal > MAX_KOBO) {
        errors.lineItems = "A line total exceeds NGN 21,474,836.47. Split the line or lower the amount.";
        break;
      }
    } catch {
      errors.lineItems = "Enter valid money amounts with at most 2 decimal places.";
      break;
    }
  }

  for (const [field, label] of [
    ["discountNaira", "Discount"],
    ["taxNaira", "Tax"]
  ] as const) {
    try {
      const kobo = convertNairaToKobo(input[field] || "0");

      if (!Number.isSafeInteger(kobo) || kobo < 0 || kobo > MAX_KOBO) {
        errors[field] = `${label} must be from NGN 0.00 through NGN 21,474,836.47.`;
      }
    } catch {
      errors[field] = "Enter a valid NGN amount with at most 2 decimal places.";
    }
  }

  try {
    const preview = errors.lineItems || errors.discountNaira || errors.taxNaira ? null : getInvoicePreview(input);

    if (preview) {
      if (preview.discountKobo > preview.subtotalKobo) {
        errors.discountNaira = "Discount cannot exceed subtotal.";
      }

      for (const [value, label] of [
        [preview.subtotalKobo, "Subtotal"],
        [preview.totalKobo, "Total"]
      ] as const) {
        if (!Number.isSafeInteger(value) || value < 0 || value > MAX_KOBO) {
          errors.lineItems =
            `${label} exceeds NGN 21,474,836.47. Reduce line amounts, quantities, or tax.`;
          break;
        }
      }
    }
  } catch {
    if (!errors.lineItems) {
      errors.lineItems = "Enter valid money amounts with at most 2 decimal places.";
    }
  }

  return errors;
}

export function getInvoicePreview(input: InvoiceFormState) {
  return calculateInvoiceTotals({
    discountKobo: convertNairaToKobo(input.discountNaira || "0"),
    taxKobo: convertNairaToKobo(input.taxNaira || "0"),
    lineItems: input.lineItems
      .filter((item) => item.description.trim())
      .map((item) => ({
        quantity: Number(item.quantity || "0"),
        unitPriceKobo: convertNairaToKobo(item.unitPriceNaira || "0")
      }))
  });
}

export function toInvoicePayload(input: InvoiceFormState): InvoiceMutationPayload {
  return {
    customerId: input.customerId,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    customerReference: input.customerReference.trim() || null,
    notes: input.notes.trim() || null,
    discountKobo: convertNairaToKobo(input.discountNaira || "0"),
    taxKobo: convertNairaToKobo(input.taxNaira || "0"),
    lineItems: input.lineItems
      .filter((item) => item.description.trim())
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unitPriceKobo: convertNairaToKobo(item.unitPriceNaira || "0")
      }))
  };
}
