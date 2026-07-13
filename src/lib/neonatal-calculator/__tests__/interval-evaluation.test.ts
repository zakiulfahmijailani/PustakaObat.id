import { describe, expect, it } from "vitest";
import { evaluateActualInterval } from "../interval-model";

const discrete = { kind: "discrete", allowedHours: [24, 48], label: "q24h atau q48h" } as const;

// Rule IDs: EVAL-INTERVAL-001, EVAL-INTERVAL-002.
describe("interval evaluation", () => {
  it("accepts exact discrete options but rejects q36 between q24/q48", () => {
    expect(evaluateActualInterval(24, discrete, true).status).toBe("sesuai");
    expect(evaluateActualInterval(48, discrete, true).status).toBe("sesuai");
    expect(evaluateActualInterval(36, discrete, true)).toMatchObject({
      status: "opsi-diskrit-tidak-cocok",
      message: "Tidak cocok dengan opsi interval diskrit q24h atau q48h.",
    });
  });

  it("classifies intervals outside discrete endpoints", () => {
    expect(evaluateActualInterval(12, discrete, true).status).toBe("lebih-pendek");
    expect(evaluateActualInterval(72, discrete, true).status).toBe("lebih-panjang");
  });

  it("compares a single interval exactly", () => {
    const single = { kind: "single", hours: 24, label: "q24h" } as const;
    expect(evaluateActualInterval(24, single, true).status).toBe("sesuai");
    expect(evaluateActualInterval(12, single, true).status).toBe("lebih-pendek");
    expect(evaluateActualInterval(48, single, true).status).toBe("lebih-panjang");
  });

  it("does not evaluate unapproved continuous ranges or single-dose-only", () => {
    expect(
      evaluateActualInterval(12, { kind: "continuous-range", minHours: 8, maxHours: 18, label: "info" }, false).status,
    ).toBe("tidak-dapat-dievaluasi");
    expect(
      evaluateActualInterval(24, { kind: "single-dose-only", label: "once" }, false).message,
    ).toContain("Tidak ada interval rutin");
  });
});
