import { describe, expect, it } from "vitest";
import { calculateRecommendations } from "../recommendation-engine";
import { patient } from "./fixtures";

// Rule IDs: GENT-INST-001, GENT-INST-002, GENT-AGE-001, GENT-ANMF-001,
// GENT-ANMF-002, GENT-TDM-001, GENT-RENAL-001.
function gent(overrides = {}) {
  return calculateRecommendations(patient({ antibiotic: "gentamisin", ...overrides }));
}

describe("gentamicin rules", () => {
  it("returns institutional 5–7.5 mg/kg and discrete q24/q48", () => {
    const rec = gent().recommendations.institutionalPrimary;
    expect(rec.dose).toMatchObject({ minMgPerKg: 5, maxMgPerKg: 7.5, minTotalMg: 7.5, maxTotalMg: 11.25 });
    expect(rec.interval).toEqual({ kind: "discrete", allowedHours: [24, 48], label: "q24h atau q48h" });
  });

  it.each([
    [{ gestationalAgeWeeks: 28.9, postnatalAgeDays: 7 }, 48],
    [{ gestationalAgeWeeks: 28.9, postnatalAgeDays: 8 }, 36],
    [{ gestationalAgeWeeks: 28.9, postnatalAgeDays: 28 }, 36],
    [{ gestationalAgeWeeks: 28.9, postnatalAgeDays: 29 }, 24],
    [{ gestationalAgeWeeks: 29, postnatalAgeDays: 7 }, 36],
    [{ gestationalAgeWeeks: 33.9, postnatalAgeDays: 7 }, 36],
    [{ gestationalAgeWeeks: 33.9, postnatalAgeDays: 8 }, 24],
    [{ gestationalAgeWeeks: 34, postnatalAgeDays: 1 }, 24],
  ])("uses production GA/PNA comparator boundary %#", (override, hours) => {
    expect(gent(override).recommendations.institutionalAgeComparator.interval).toMatchObject({ kind: "single", hours });
  });

  it.each([
    [{ gestationalAgeWeeks: 29, postnatalAgeDays: 6 }, 48],
    [{ gestationalAgeWeeks: 30, postnatalAgeDays: 0 }, 36],
    [{ gestationalAgeWeeks: 35, postnatalAgeDays: 0 }, 24],
  ])("uses ANMF PMA boundary %#", (override, hours) => {
    expect(gent(override).recommendations.anmf2024.interval).toMatchObject({ kind: "single", hours });
  });

  it("applies hypothermia first and does not also add COX extension", () => {
    expect(
      gent({ therapeuticHypothermia: true, coxInhibitorTherapy: true }).recommendations.anmf2024.interval,
    ).toMatchObject({ kind: "single", hours: 36 });
  });

  it("extends the initial ANMF interval by 12 hours for COX inhibitor", () => {
    expect(gent({ coxInhibitorTherapy: true }).recommendations.anmf2024.interval).toMatchObject({ kind: "single", hours: 48 });
  });

  it("includes the notebook-derived ANMF TDM targets and timing", () => {
    const notes = gent().recommendations.anmf2024.notes.join(" ");
    expect(notes).toContain("22 jam setelah dosis ke-2");
    expect(notes).toContain("trough <2 mg/L");
    expect(notes).toContain("peak 5–12 mg/L");
  });

  it("warns but does not automatically adjust for renal review signal", () => {
    const result = gent({ serumCreatinineMgDl: 1 });
    expect(result.recommendations.institutionalPrimary.interval).toMatchObject({ kind: "discrete", allowedHours: [24, 48] });
    expect(result.recommendations.institutionalPrimary.warnings[0]?.code).toContain("AMINOGLYCOSIDE");
  });
});
