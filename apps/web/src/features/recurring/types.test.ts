import { describe, expect, it } from "vitest";

import { nextIssuePreview } from "./types";

describe("recurring types", () => {
  it("previews next invoice and due dates", () => {
    expect(nextIssuePreview("2026-09-30", "monthly", 14)).toBe("Next invoice: 2026-09-30 · Due 2026-10-14");
  });
});
