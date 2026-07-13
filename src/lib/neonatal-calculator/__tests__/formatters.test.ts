import { describe, expect, it } from "vitest";
import { formatNumber } from "../formatters";

// Rule ID: FORMAT-DISPLAY-001.
describe("display number formatting", () => {
  it("limits output to three decimals and strips unnecessary trailing zeros", () => {
    expect(formatNumber(1)).toBe("1");
    expect(formatNumber(1.2)).toBe("1,2");
    expect(formatNumber(1.2344)).toBe("1,234");
    expect(formatNumber(1.2346)).toBe("1,235");
  });
});
