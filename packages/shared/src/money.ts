const KOBO_PER_NAIRA = 100;

export function convertNairaToKobo(amount: number | string): number {
  if (typeof amount === "number") {
    if (!Number.isFinite(amount)) {
      throw new RangeError("Amount must be a finite number.");
    }

    return Math.round(amount * KOBO_PER_NAIRA);
  }

  const normalizedAmount = amount.trim().replaceAll(",", "");

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
    throw new RangeError("Amount must be a valid NGN value with at most 2 decimal places.");
  }

  const isNegative = normalizedAmount.startsWith("-");
  const unsignedAmount = isNegative ? normalizedAmount.slice(1) : normalizedAmount;
  const [nairaPart = "0", koboPart = ""] = unsignedAmount.split(".");
  const paddedKobo = koboPart.padEnd(2, "0");
  const kobo = Number.parseInt(nairaPart, 10) * KOBO_PER_NAIRA + Number.parseInt(paddedKobo, 10);

  return isNegative ? -kobo : kobo;
}

export function formatKoboToNaira(kobo: number): string {
  if (!Number.isInteger(kobo)) {
    throw new RangeError("Kobo amount must be an integer.");
  }

  const sign = kobo < 0 ? "-" : "";
  const absoluteKobo = Math.abs(kobo);
  const naira = Math.floor(absoluteKobo / KOBO_PER_NAIRA);
  const remainder = absoluteKobo % KOBO_PER_NAIRA;

  return `NGN ${sign}${naira.toLocaleString("en-NG")}.${remainder.toString().padStart(2, "0")}`;
}
