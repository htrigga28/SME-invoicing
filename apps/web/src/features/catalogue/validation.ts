import { convertNairaToKobo } from "@sme-invoicing/shared";

export type CatalogueFormInput = {
  name: string;
  description: string;
  unitPriceNaira: string;
};

export type CatalogueFormErrors = Partial<Record<"name" | "description" | "unitPriceNaira", string>>;

const MAX_KOBO = 2_147_483_647;

export function validateCatalogueForm(input: CatalogueFormInput): CatalogueFormErrors {
  const errors: CatalogueFormErrors = {};
  const name = input.name.trim();

  if (!name) {
    errors.name = "Name is required.";
  } else if (name.length > 200) {
    errors.name = "Name must be 200 characters or fewer.";
  }

  if (input.description.trim().length > 2000) {
    errors.description = "Description must be 2,000 characters or fewer.";
  }

  if (!input.unitPriceNaira.trim()) {
    errors.unitPriceNaira = "Default price is required.";
  } else {
    try {
      const kobo = convertNairaToKobo(input.unitPriceNaira.trim());

      if (!Number.isSafeInteger(kobo) || kobo < 0 || kobo > MAX_KOBO) {
        errors.unitPriceNaira = "Enter an amount from NGN 0.00 through NGN 21,474,836.47.";
      }
    } catch {
      errors.unitPriceNaira = "Enter a valid NGN amount with at most 2 decimal places.";
    }
  }

  return errors;
}

export function toCataloguePayload(input: CatalogueFormInput) {
  return {
    name: input.name.trim(),
    description: input.description.trim() || null,
    defaultUnitPriceKobo: convertNairaToKobo(input.unitPriceNaira.trim() || "0")
  };
}
