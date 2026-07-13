import { describe, expect, it } from "vitest";
import { calculatePmaWeeks, pmaWarnings } from "../pma";

// Rule IDs: CORE-PMA-001, CORE-PMA-002.
describe("PMA rules", () => {
  it("calculates exact PMA including decimal GA", () => {
    expect(calculatePmaWeeks(28, 14)).toBe(30);
    expect(calculatePmaWeeks(28.5, 7)).toBe(29.5);
  });

  it("warns only above 50 weeks", () => {
    expect(pmaWarnings(50)).toHaveLength(0);
    expect(pmaWarnings(50.01)[0]?.code).toBe("PMA_OUTSIDE_TYPICAL_NEONATAL_RANGE");
  });
});
