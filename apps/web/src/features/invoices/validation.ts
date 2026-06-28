import { calculateInvoiceTotals, convertNairaToKobo } from "@sme-invoicing/shared";

import type { InvoiceFormState, InvoiceMutationPayload } from "./types";

export type InvoiceFormErrors = Partial<
  Record<"customerId" | "dueDate" | "issueDate" | "lineItems" | "discountNaira", string>
>;

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

  const validLineItems = input.lineItems.filter((item) => item.description.trim());

  if (validLineItems.length === 0) {
    errors.lineItems = "At least one line item is required.";
  }

  for (const item of validLineItems) {
    const quantity = Number(item.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0 || !item.unitPriceNaira.trim()) {
      errors.lineItems = "Line items need a description, quantity, and unit price.";
      break;
    }
  }

  try {
    const preview = errors.lineItems ? null : getInvoicePreview(input);

    if (preview && preview.discountKobo > preview.subtotalKobo) {
      errors.discountNaira = "Discount cannot exceed subtotal.";
    }
  } catch {
    errors.lineItems = "Enter valid money amounts with at most 2 decimal places.";
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
