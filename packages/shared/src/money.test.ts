import { describe, expect, it } from "vitest";

import { convertNairaToKobo, formatKoboToNaira } from "./money";

describe("money helpers", () => {
  it("converts naira strings to integer kobo", () => {
    expect(convertNairaToKobo("1250")).toBe(125000);
    expect(convertNairaToKobo("1,250.75")).toBe(125075);
    expect(convertNairaToKobo("0.50")).toBe(50);
  });

  it("converts naira numbers to integer kobo", () => {
    expect(convertNairaToKobo(1000)).toBe(100000);
    expect(convertNairaToKobo(1000.25)).toBe(100025);
  });

  it("rejects ambiguous string amounts", () => {
    expect(() => convertNairaToKobo("100.999")).toThrow(RangeError);
    expect(() => convertNairaToKobo("not-money")).toThrow(RangeError);
  });

  it("formats integer kobo as clear NGN amounts", () => {
    expect(formatKoboToNaira(125075)).toBe("NGN 1,250.75");
    expect(formatKoboToNaira(0)).toBe("NGN 0.00");
    expect(formatKoboToNaira(-5000)).toBe("NGN -50.00");
  });
});
