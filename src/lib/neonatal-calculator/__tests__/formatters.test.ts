import { describe, expect, it } from "vitest";
import { formatNumber, formatPatientAgeTitle } from "../formatters";

// Rule ID: FORMAT-DISPLAY-001.
describe("display number formatting", () => {
  it("limits output to three decimals and strips unnecessary trailing zeros", () => {
    expect(formatNumber(1)).toBe("1");
    expect(formatNumber(1.2)).toBe("1,2");
    expect(formatNumber(1.2344)).toBe("1,234");
    expect(formatNumber(1.2346)).toBe("1,235");
  });

  it("includes gestational age, postnatal age, and exact PMA in the result title", () => {
    expect(formatPatientAgeTitle({ gestationalAgeWeeks: 29, gestationalAgeDays: 3, postnatalAgeDays: 3 }))
      .toBe("Usia gestasi lahir 29 minggu 3 hari · Usia pascalahir 3 hari · Usia pascamenstruasi (PMA) 29 minggu 6 hari");
  });
});
