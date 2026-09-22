import { firstIssueAfterOrOn, nextRecurrenceDate } from "./recurrence";

describe("recurrence", () => {
  it("advances weekly by 7 days", () => {
    expect(
      nextRecurrenceDate({ frequency: "weekly", previousScheduledFor: "2026-09-30", anchorDay: 30, anchorMonth: 9 })
    ).toBe("2026-10-07");
  });

  it("anchors monthly without drift (Jan 31 -> Feb 28 -> Mar 31)", () => {
    const feb = nextRecurrenceDate({ frequency: "monthly", previousScheduledFor: "2026-01-31", anchorDay: 31, anchorMonth: 1 });
    expect(feb).toBe("2026-02-28");
    const mar = nextRecurrenceDate({ frequency: "monthly", previousScheduledFor: feb, anchorDay: 31, anchorMonth: 1 });
    expect(mar).toBe("2026-03-31");
    const apr = nextRecurrenceDate({ frequency: "monthly", previousScheduledFor: mar, anchorDay: 31, anchorMonth: 1 });
    expect(apr).toBe("2026-04-30");
    const may = nextRecurrenceDate({ frequency: "monthly", previousScheduledFor: apr, anchorDay: 31, anchorMonth: 1 });
    expect(may).toBe("2026-05-31");
  });

  it("handles leap-year February anchoring", () => {
    // 2024 is a leap year
    const feb24 = nextRecurrenceDate({ frequency: "monthly", previousScheduledFor: "2024-01-31", anchorDay: 31, anchorMonth: 1 });
    expect(feb24).toBe("2024-02-29");
    const mar24 = nextRecurrenceDate({ frequency: "monthly", previousScheduledFor: feb24, anchorDay: 31, anchorMonth: 1 });
    expect(mar24).toBe("2024-03-31");
  });

  it("advances quarterly with anchor", () => {
    expect(
      nextRecurrenceDate({ frequency: "quarterly", previousScheduledFor: "2026-01-31", anchorDay: 31, anchorMonth: 1 })
    ).toBe("2026-04-30");
  });

  it("preserves yearly month/day and maps Feb 29 to Feb 28 off-leap", () => {
    expect(
      nextRecurrenceDate({ frequency: "yearly", previousScheduledFor: "2024-02-29", anchorDay: 29, anchorMonth: 2 })
    ).toBe("2025-02-28");
    expect(
      nextRecurrenceDate({ frequency: "yearly", previousScheduledFor: "2027-02-28", anchorDay: 29, anchorMonth: 2 })
    ).toBe("2028-02-29");
  });

  it("skips missed cycles on resume (first on/after today)", () => {
    const next = firstIssueAfterOrOn({
      frequency: "monthly",
      anchorDay: 15,
      anchorMonth: 6,
      startDate: "2026-06-15",
      fromDate: "2026-10-07"
    });
    expect(next).toBe("2026-10-15");
  });
});
