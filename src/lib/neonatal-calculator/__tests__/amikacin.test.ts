import { describe, expect, it } from "vitest";
import { calculateRecommendations } from "../recommendation-engine";
import { patient } from "./fixtures";

// Rule IDs: AMIK-INST-001, AMIK-ANMF-001, AMIK-ANMF-002, AMIK-TDM-001,
// AMIK-RENAL-001.
function amik(overrides = {}) {
  return calculateRecommendations(patient({ antibiotic: "amikasin", ...overrides }));
}

describe("amikacin rules", () => {
  it("returns institutional 15 mg/kg q24h", () => {
    const rec = amik().recommendations.institutionalPrimary;
    expect(rec.dose).toMatchObject({ minMgPerKg: 15, maxMgPerKg: 15, minTotalMg: 22.5, maxTotalMg: 22.5 });
    expect(rec.interval).toMatchObject({ kind: "single", hours: 24 });
  });

  it.each([
    [{ gestationalAgeWeeks: 27.5, postnatalAgeDays: 7 }, 14, 48],
    [{ gestationalAgeWeeks: 24, postnatalAgeDays: 28 }, 12, 36],
    [{ gestationalAgeWeeks: 22, postnatalAgeDays: 29 }, 12, 24],
    [{ gestationalAgeWeeks: 29, postnatalAgeDays: 0 }, 12, 36],
    [{ gestationalAgeWeeks: 29, postnatalAgeDays: 7 }, 12, 36],
    [{ gestationalAgeWeeks: 32, postnatalAgeDays: 8 }, 12, 24],
    [{ gestationalAgeWeeks: 34, postnatalAgeDays: 0 }, 12, 24],
  ])("covers ANMF PMA/PNA branch %#", (override, mgPerKg, hours) => {
    const rec = amik(override).recommendations.anmf2024;
    expect(rec.dose.minMgPerKg).toBe(mgPerKg);
    expect(rec.interval).toMatchObject({ kind: "single", hours });
  });

  it("adds 12 hours once when hypothermia and/or COX modifier is active", () => {
    expect(amik({ therapeuticHypothermia: true }).recommendations.anmf2024.interval).toMatchObject({ hours: 48 });
    expect(amik({ coxInhibitorTherapy: true }).recommendations.anmf2024.interval).toMatchObject({ hours: 48 });
    expect(
      amik({ therapeuticHypothermia: true, coxInhibitorTherapy: true }).recommendations.anmf2024.interval,
    ).toMatchObject({ hours: 48 });
  });

  it("includes the notebook-derived ANMF TDM targets", () => {
    const notes = amik().recommendations.anmf2024.notes.join(" ");
    expect(notes).toContain("peak 20–35 mg/L");
    expect(notes).toContain("hingga 40 mg/L pada infeksi berat");
    expect(notes).toContain("trough <5 mg/L");
  });

  it("adds review warning without automatic renal adjustment", () => {
    const rec = amik({ serumCreatinineMgDl: 1 }).recommendations.institutionalPrimary;
    expect(rec.interval).toMatchObject({ hours: 24 });
    expect(rec.warnings[0]?.message).toContain("tidak melakukan penyesuaian ginjal otomatis");
  });
});
