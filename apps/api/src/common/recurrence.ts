export type RecurrenceFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

function toDateOnly(value: string): { year: number; month: number; day: number } {
  const parts = value.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return { year: y, month: m, day: d };
}

function toISO(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addDaysISO(value: string, days: number): string {
  const { year, month, day } = toDateOnly(value);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Deterministic recurrence with original-anchor semantics (no drift).
 * anchorDay/anchorMonth come from the schedule start date.
 * Monthly/quarterly clamp to month length then return to anchor when possible.
 * Feb 29 becomes Feb 28 in non-leap years, back to Feb 29 in leap years.
 */
export function nextRecurrenceDate(input: {
  frequency: RecurrenceFrequency;
  previousScheduledFor: string;
  anchorDay: number;
  anchorMonth: number;
}): string {
  const prev = toDateOnly(input.previousScheduledFor);

  if (input.frequency === "weekly") {
    return addDaysISO(input.previousScheduledFor, 7);
  }

  if (input.frequency === "monthly") {
    let year = prev.year;
    let month = prev.month + 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    const day = Math.min(input.anchorDay, daysInMonth(year, month));
    return toISO(year, month, day);
  }

  if (input.frequency === "quarterly") {
    let year = prev.year;
    let month = prev.month + 3;
    while (month > 12) {
      month -= 12;
      year += 1;
    }
    const day = Math.min(input.anchorDay, daysInMonth(year, month));
    return toISO(year, month, day);
  }

  // yearly: preserve original month/day
  const year = prev.year + 1;
  const day = Math.min(input.anchorDay, daysInMonth(year, input.anchorMonth));
  return toISO(year, input.anchorMonth, day);
}

export function firstIssueAfterOrOn(input: {
  frequency: RecurrenceFrequency;
  anchorDay: number;
  anchorMonth: number;
  startDate: string;
  fromDate: string;
}): string {
  let candidate = input.startDate;
  let guard = 0;
  while (candidate < input.fromDate && guard < 1200) {
    candidate = nextRecurrenceDate({
      frequency: input.frequency,
      previousScheduledFor: candidate,
      anchorDay: input.anchorDay,
      anchorMonth: input.anchorMonth
    });
    guard += 1;
  }
  return candidate;
}

export function anchorFromStartDate(startDate: string): { anchorDay: number; anchorMonth: number } {
  const { month, day } = toDateOnly(startDate);
  return { anchorDay: day, anchorMonth: month };
}

// ponytail: O(n) monthly walk capped at 1200 cycles, per-schedule cadence if throughput matters
