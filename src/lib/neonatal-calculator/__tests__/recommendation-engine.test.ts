import { describe, expect, it } from "vitest";
import { calculateRecommendations } from "../recommendation-engine";
import { evaluateRegimen } from "../evaluation-engine";
import { patient } from "./fixtures";

// Rule IDs: CORE-RESULT-001, EVAL-DOSE-001, EVAL-MANUAL-001.
describe("recommendation and evaluation engine", () => {
  it("returns three independently labeled recommendations and a stable rule version", () => {
    const result = calculateRecommendations(patient());
    expect(Object.keys(result.recommendations)).toEqual([
      "institutionalPrimary",
      "institutionalAgeComparator",
      "anmf2024",
    ]);
    expect(result.calculatorRuleVersion).toBe("2026.07.13-production-2");
    expect(result.qualitativeReferenceNotes).toHaveLength(4);
    expect(result.qualitativeReferenceNotes.join(" ")).toContain("WHO 2024");
    expect(result.qualitativeReferenceNotes.join(" ")).toContain("Swiss Society of Neonatology 2024");
    expect(result.qualitativeReferenceNotes.join(" ")).toContain("JAID/JSC 2021");
    expect(result.qualitativeReferenceNotes.join(" ")).toContain("ACOG 2020/AAP");
  });

  it.each([
    ["gentamisin", "ampisilin/penisilin + gentamisin"],
    ["amikasin", "resistensi gentamisin tinggi"],
    ["vankomisin", "kecurigaan MRSA/CoNS"],
  ] as const)("returns notebook-specific qualitative notes for %s", (antibiotic, expected) => {
    const notes = calculateRecommendations(patient({ antibiotic })).qualitativeReferenceNotes;
    expect(notes).toHaveLength(4);
    expect(notes.join(" ")).toContain(expected);
  });

  it("evaluates inclusive dose boundaries and above/below deviations", () => {
    const result = calculateRecommendations(patient({ currentWeightKg: 1 }));
    const base = {
      manualDoseMinMg: 5,
      manualDoseMaxMg: 7.5,
      manualIntervalMinHours: 24,
      manualIntervalMaxHours: 48,
      actualIntervalHours: 24,
    };
    expect(evaluateRegimen(result, { ...base, actualDoseMg: 5 }).targets[0]?.actualDose.status).toBe("sesuai");
    expect(evaluateRegimen(result, { ...base, actualDoseMg: 7.5 }).targets[0]?.actualDose.status).toBe("sesuai");
    expect(evaluateRegimen(result, { ...base, actualDoseMg: 4 }).targets[0]?.actualDose.status).toBe("kurang");
    expect(evaluateRegimen(result, { ...base, actualDoseMg: 8 }).targets[0]?.actualDose.status).toBe("berlebih");
  });

  it("compares manual bounds independently without midpoint appropriateness", () => {
    const result = calculateRecommendations(patient({ currentWeightKg: 1 }));
    const evaluation = evaluateRegimen(result, {
      manualDoseMinMg: 4,
      manualDoseMaxMg: 8,
      manualIntervalMinHours: 24,
      manualIntervalMaxHours: 48,
      actualDoseMg: 6,
      actualIntervalHours: 24,
    });
    expect(evaluation.targets[0]?.manualDose.lowerBound?.direction).toBe("lebih-kecil");
    expect(evaluation.targets[0]?.manualDose.upperBound?.direction).toBe("lebih-besar");
  });

  it("uses one range-aware state for a fixed recommendation", () => {
    const result = calculateRecommendations(patient({ antibiotic: "amikasin", currentWeightKg: 1 }));
    const evaluation = evaluateRegimen(result, {
      manualDoseMinMg: 12,
      manualDoseMaxMg: 18,
      manualIntervalMinHours: 24,
      manualIntervalMaxHours: 24,
      actualDoseMg: 15,
      actualIntervalHours: 24,
    });
    expect(evaluation.targets[0]?.manualDose).toMatchObject({
      fixedRecommendation: true,
      upperBound: null,
      lowerBound: { direction: "mencakup" },
    });
  });

  it("does not require interval inputs for the renal vancomycin single-dose pathway", () => {
    const result = calculateRecommendations(
      patient({ antibiotic: "vankomisin", serumCreatinineMgDl: 1 }),
    );
    const evaluation = evaluateRegimen(result, {
      manualDoseMinMg: 10,
      manualDoseMaxMg: 10,
      manualIntervalMinHours: null,
      manualIntervalMaxHours: null,
      actualDoseMg: 10,
      actualIntervalHours: null,
    });
    expect(evaluation.targets.every((target) => target.actualInterval.status === "tidak-dapat-dievaluasi")).toBe(true);
  });
});
