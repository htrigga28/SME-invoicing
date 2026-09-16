import { BadRequestException } from "@nestjs/common";

export const MAX_KOBO = 2_147_483_647;
export const MAX_INVOICE_QUANTITY = 99_999_999.99;

export function assertKoboAmount(value: number, label: string, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum || value > MAX_KOBO) {
    throw new BadRequestException(
      `${label} must be a whole kobo amount from ${minimum} through ${MAX_KOBO}.`
    );
  }

  return value;
}

export function assertInvoiceQuantity(value: number) {
  const scaled = value * 100;

  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value > MAX_INVOICE_QUANTITY ||
    Math.abs(scaled - Math.round(scaled)) > 0.00000001
  ) {
    throw new BadRequestException(
      `Invoice quantity must be greater than 0, at most ${MAX_INVOICE_QUANTITY}, and use no more than two decimal places.`
    );
  }

  return value;
}

export function isKoboAmount(value: number, minimum = 0) {
  return Number.isSafeInteger(value) && value >= minimum && value <= MAX_KOBO;
}
