import { describe, expect, it } from "vitest";
import { validatePatientInput, validateRegimenEvaluationInput } from "../validation";
import { patient } from "./fixtures";

// Rule IDs: VALID-PATIENT-001, VALID-RENAL-001.
describe("input validation", () => {
  it("accepts exact GA limits and rejects values outside them", () => {
    expect(validatePatientInput(patient({ gestationalAgeWeeks: 22 })).success).toBe(true);
    expect(validatePatientInput(patient({ gestationalAgeWeeks: 43 })).success).toBe(true);
    expect(validatePatientInput(patient({ gestationalAgeWeeks: 21.99 })).success).toBe(false);
    expect(validatePatientInput(patient({ gestationalAgeWeeks: 43.01 })).success).toBe(false);
  });

  it.each([
    ["postnatalAgeDays", { postnatalAgeDays: -1 }],
    ["decimal PNA", { postnatalAgeDays: 1.5 }],
    ["low weight", { currentWeightKg: 0.3 }],
    ["high weight", { currentWeightKg: 10.1 }],
    ["weight with more than three decimals", { currentWeightKg: 1.2345 }],
    ["negative SCr", { serumCreatinineMgDl: -0.1 }],
    ["negative UOP", { urineOutputMlKgHour: -0.1 }],
    ["SCr above upper bound", { serumCreatinineMgDl: 10.01 }],
    ["UOP above upper bound", { urineOutputMlKgHour: 10.01 }],
    ["PNA above upper bound", { postnatalAgeDays: 366 }],
  ])("rejects %s", (_label, override) => {
    expect(validatePatientInput(patient(override)).success).toBe(false);
  });

  it("requires SCr when renal data are marked available", () => {
    expect(validatePatientInput(patient({ serumCreatinineMgDl: undefined })).success).toBe(false);
  });

  it("does not accept hidden renal values when data are unavailable", () => {
    expect(
      validatePatientInput(
        patient({ renalDataAvailable: false, serumCreatinineMgDl: 0.4, urineOutputMlKgHour: 2 }),
      ).success,
    ).toBe(false);
  });

  it("sanitizes the optional non-identifying label", () => {
    const result = validatePatientInput(patient({ patientLabel: "  <Kasus>\u0000   B  " }));
    expect(result.success && result.data.patientLabel).toBe("Kasus B");
  });
});

// Rule IDs: VALID-REGIMEN-001, EVAL-MANUAL-001.
describe("regimen validation", () => {
  const valid = {
    manualDoseMinMg: 10,
    manualDoseMaxMg: 12,
    manualIntervalMinHours: 24,
    manualIntervalMaxHours: 48,
    actualDoseMg: 11,
    actualIntervalHours: 24,
  };

  it("rejects zero/negative and decimal interval hours", () => {
    expect(validateRegimenEvaluationInput({ ...valid, actualIntervalHours: 0 }).success).toBe(false);
    expect(validateRegimenEvaluationInput({ ...valid, manualIntervalMinHours: -1 }).success).toBe(false);
    expect(validateRegimenEvaluationInput({ ...valid, actualIntervalHours: 24.5 }).success).toBe(false);
  });

  it("rejects zero or negative dose values", () => {
    expect(validateRegimenEvaluationInput({ ...valid, actualDoseMg: 0 }).success).toBe(false);
    expect(validateRegimenEvaluationInput({ ...valid, manualDoseMinMg: -1 }).success).toBe(false);
  });

  it("rejects reversed manual bounds", () => {
    expect(validateRegimenEvaluationInput({ ...valid, manualDoseMinMg: 13 }).success).toBe(false);
    expect(validateRegimenEvaluationInput({ ...valid, manualIntervalMinHours: 72 }).success).toBe(false);
  });

  it("allows omitted interval fields when the calling clinical path marks them irrelevant", () => {
    expect(
      validateRegimenEvaluationInput(
        { ...valid, manualIntervalMinHours: null, manualIntervalMaxHours: null, actualIntervalHours: null },
        false,
      ).success,
    ).toBe(true);
  });
});
