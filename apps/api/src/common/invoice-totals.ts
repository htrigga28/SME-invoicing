import { BadRequestException } from "@nestjs/common";

import { assertKoboAmount } from "./money-limits";

export function calculateInvoiceTotals(input: {
  discountKobo?: number;
  lineItems: { quantity: number; unitPriceKobo: number }[];
  taxKobo?: number;
}) {
  const lineTotalsKobo = input.lineItems.map((item) =>
    assertKoboAmount(Math.round(item.quantity * item.unitPriceKobo), "Line total")
  );
  const subtotalKobo = lineTotalsKobo.reduce(
    (sum, lineTotal) => assertKoboAmount(sum + lineTotal, "Invoice subtotal"),
    0
  );
  const discountKobo = assertKoboAmount(input.discountKobo ?? 0, "Discount");
  const taxKobo = assertKoboAmount(input.taxKobo ?? 0, "Tax");
  if (discountKobo > subtotalKobo)
    throw new BadRequestException("Discount cannot exceed subtotal.");
  const totalKobo = assertKoboAmount(subtotalKobo - discountKobo + taxKobo, "Invoice total");
  return {
    lineTotalsKobo,
    subtotalKobo,
    discountKobo,
    taxKobo,
    totalKobo,
    amountPaidKobo: 0,
    balanceDueKobo: totalKobo
  };
}
