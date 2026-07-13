import { describe, expect, it } from "vitest";
import { calculateRecommendations } from "../recommendation-engine";
import { patient } from "./fixtures";

// Rule IDs: VANC-INST-001, VANC-RENAL-001, VANC-INST-002, VANC-AGE-001,
// VANC-ANMF-001, VANC-ANMF-002, VANC-ANMF-003.
function vanc(overrides = {}) {
  return calculateRecommendations(patient({ antibiotic: "vankomisin", ...overrides }));
}

describe("vancomycin rules", () => {
  it("labels UNC provenance because the referenced local SPO has no regimen", () => {
    const recommendations = vanc().recommendations;
    const rec = recommendations.institutionalPrimary;
    expect(rec.provenanceLabel).toBe("UNC Medical Center 2023");
    expect(rec.provenanceDetail).toContain("SPO lokal yang dirujuk tidak memuat regimen vankomisin");
    expect(recommendations.institutionalAgeComparator.label).toBe(
      "Pembanding usia GA/PNA — bukan stratifikasi resmi SPO",
    );
  });

  it("uses 10 mg/kg once and blocks routine interval evaluation when renal criteria match", () => {
    const result = vanc({ serumCreatinineMgDl: 1 });
    const rec = result.recommendations.institutionalPrimary;
    expect(rec.dose).toMatchObject({ minMgPerKg: 10, maxMgPerKg: 10, minTotalMg: 15 });
    expect(rec.interval.kind).toBe("single-dose-only");
    expect(rec.eligibleForRegimenEvaluation).toBe(false);
    expect(rec.warnings[0]?.severity).toBe("critical");
  });

  it("keeps general q8–q18 coverage informational and non-evaluable", () => {
    const rec = vanc().recommendations.institutionalPrimary;
    expect(rec.interval.kind).toBe("continuous-range");
    expect(rec.eligibleForRegimenEvaluation).toBe(false);
  });

  it.each([
    [{ gestationalAgeWeeks: 27, postnatalAgeDays: 14 }, 18],
    [{ gestationalAgeWeeks: 27.5, postnatalAgeDays: 7 }, 18],
    [{ gestationalAgeWeeks: 24, postnatalAgeDays: 29 }, 12],
    [{ gestationalAgeWeeks: 29, postnatalAgeDays: 14 }, 12],
    [{ gestationalAgeWeeks: 29, postnatalAgeDays: 15 }, 8],
    [{ gestationalAgeWeeks: 34, postnatalAgeDays: 14 }, 12],
    [{ gestationalAgeWeeks: 36, postnatalAgeDays: 7 }, 12],
    [{ gestationalAgeWeeks: 36, postnatalAgeDays: 8 }, 8],
    [{ gestationalAgeWeeks: 43, postnatalAgeDays: 7 }, 12],
  ])("matches notebook UNC PMA/PNA comparator boundary %#", (override, hours) => {
    expect(vanc(override).recommendations.institutionalAgeComparator.interval).toMatchObject({ kind: "single", hours });
  });

  it.each([
    [{ gestationalAgeWeeks: 29, postnatalAgeDays: 2 }, 18],
    [{ gestationalAgeWeeks: 29, postnatalAgeDays: 3 }, 12],
    [{ gestationalAgeWeeks: 30, postnatalAgeDays: 0 }, 12],
    [{ gestationalAgeWeeks: 34, postnatalAgeDays: 14 }, 12],
    [{ gestationalAgeWeeks: 34, postnatalAgeDays: 15 }, 8],
    [{ gestationalAgeWeeks: 37, postnatalAgeDays: 0 }, 12],
    [{ gestationalAgeWeeks: 37, postnatalAgeDays: 7 }, 12],
    [{ gestationalAgeWeeks: 37, postnatalAgeDays: 8 }, 8],
    [{ gestationalAgeWeeks: 43, postnatalAgeDays: 14 }, 6],
  ])("covers ANMF PMA/PNA boundary %#", (override, hours) => {
    expect(vanc(override).recommendations.anmf2024.interval).toMatchObject({ kind: "single", hours });
  });

  it("adds severe infection consideration and hypothermia TDM note without changing maintenance dose", () => {
    const rec = vanc({ severeSepsisOrHighRiskInfection: true, therapeuticHypothermia: true }).recommendations.anmf2024;
    expect(rec.dose.minMgPerKg).toBe(15);
    expect(rec.notes.join(" ")).toContain("loading dose 20 mg/kg");
    expect(rec.notes.join(" ")).toContain("sebelum dosis ke-2");
  });

  it("reports unavailable renal data without assuming normal", () => {
    const result = vanc({ renalDataAvailable: false, serumCreatinineMgDl: undefined, urineOutputMlKgHour: undefined });
    expect(result.renalStatus).toBe("data-unavailable");
    expect(result.globalWarnings[0]?.code).toBe("RENAL_DATA_UNAVAILABLE");
  });

  it("warns when UOP is absent and the combined renal criterion is incomplete", () => {
    const result = vanc({ serumCreatinineMgDl: 0.5, urineOutputMlKgHour: undefined });
    expect(result.renalStatus).toBe("no-renal-impairment-criteria-met");
    expect(result.globalWarnings).toContainEqual(
      expect.objectContaining({ code: "RENAL_URINE_OUTPUT_UNAVAILABLE" }),
    );
  });
});
