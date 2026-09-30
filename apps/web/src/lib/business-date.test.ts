import { describe, expect, it } from "vitest";
import { lagosBusinessDate } from "./business-date";

describe("Lagos business date", () => {
  it("uses Lagos midnight when UTC is still on the previous day", () => {
    expect(lagosBusinessDate(new Date("2026-09-22T23:30:00.000Z"))).toBe("2026-09-23");
  });
});
