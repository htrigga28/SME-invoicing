import { describe, expect, it } from "vitest";

import { previewReminder, relativeDayLabel, validateReminderStep } from "./types";

describe("reminder types", () => {
  it("labels relative days", () => {
    expect(relativeDayLabel(-3)).toBe("3 days before due");
    expect(relativeDayLabel(0)).toBe("On due date");
    expect(relativeDayLabel(7)).toBe("7 days overdue");
  });

  it("rejects unknown variables", () => {
    expect(
      validateReminderStep({ relativeDays: 1, subjectTemplate: "Hi {{hacker}}", bodyTemplate: "x" })
    ).toMatch(/Unknown variable/);
  });

  it("previews samples without sending", () => {
    expect(previewReminder("INV {{invoiceNumber}}", { invoiceNumber: "INV-000184" })).toBe("INV INV-000184");
  });
});
