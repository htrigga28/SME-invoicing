export function formatKoboDecimal(kobo: number | null | undefined) {
  const value = kobo ?? 0;

  if (!Number.isInteger(value)) {
    throw new RangeError("Kobo amount must be an integer.");
  }

  const sign = value < 0 ? "-" : "";
  const absoluteKobo = Math.abs(value);
  const naira = Math.floor(absoluteKobo / 100);
  const remainder = absoluteKobo % 100;

  return `${sign}${naira}.${remainder.toString().padStart(2, "0")}`;
}

export function formatTimestamp(value: Date | null | string | undefined) {
  if (!value) {
    return "";
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function formatDateOnly(value: Date | null | string | undefined) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}
