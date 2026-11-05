import { describe, expect, it } from "vitest";
import { describeDoseReference, describeIntervalReference } from "../reference-shape-v20";
import { calculateRecommendations } from "../recommendation-engine";
import { evaluateRegimen } from "../evaluation-engine";
import { patient } from "./fixtures";
import type { DoseRecommendation, IntervalRecommendation } from "../types";

describe("[2.7] keterangan bentuk rujukan pada layar v20", () => {
  const dose = (min: number | null, max: number | null): DoseRecommendation => ({
    minTotalMg: min, maxTotalMg: max, minMgPerKg: min, maxMgPerKg: max,
  });

  it("membedakan nilai dosis tunggal dari rentang tanpa mengubah angka atau input", () => {
    const fixed = dose(15, 15);
    const range = dose(7.5, 11.25);
    const missing = dose(null, null);
    const original = JSON.stringify([fixed, range, missing]);
    expect(describeDoseReference(fixed).label).toBe("Nilai dosis tunggal");
    expect(describeDoseReference(fixed).description).toContain("Batas bawah dan batas atas sama");
    expect(describeDoseReference(range).label).toBe("Rentang dosis");
    expect(describeDoseReference(range).description).toContain("batas pembanding dosis aktual");
    expect(describeDoseReference(missing).label).toBe("Dosis numerik tidak tersedia");
    expect(JSON.stringify([fixed, range, missing])).toBe(original);
  });

  it.each([
    [{ kind: "single", hours: 24, label: "q24h" } as const, true, "Nilai interval tunggal"],
    [{ kind: "continuous-range", minHours: 24, maxHours: 48, label: "tiap 24–48 jam" } as const, true, "Rentang interval kontinu"],
    [{ kind: "continuous-range", minHours: 24, maxHours: 48, label: "tiap 24–48 jam" } as const, false, "Rentang interval informatif"],
    [{ kind: "discrete", allowedHours: [24, 48], label: "q24h atau q48h" } as const, true, "Opsi interval terpisah"],
    [{ kind: "single-dose-only", label: "Dosis tunggal" } as const, false, "Dosis tunggal (tanpa interval rutin)"],
  ] as const)("menjelaskan jenis interval %s tanpa mengubah interval sumber", (interval, eligible, expected) => {
    const original = JSON.stringify(interval);
    expect(describeIntervalReference(interval, eligible).label).toBe(expected);
    expect(JSON.stringify(interval)).toBe(original);
  });

  it("membedakan opsi terpisah dari rentang kontinu, terutama nilai di antaranya", () => {
    const options: IntervalRecommendation = { kind: "discrete", allowedHours: [24, 48], label: "q24h atau q48h" };
    const range: IntervalRecommendation = { kind: "continuous-range", minHours: 24, maxHours: 48, label: "tiap 24–48 jam" };
    expect(describeIntervalReference(options).description).toContain("interval di antaranya tidak otomatis termasuk opsi");
    expect(describeIntervalReference(range).description).toContain("batas bawah dan batas atas");
    const single: IntervalRecommendation = { kind: "single-dose-only", label: "Dosis tunggal" };
    expect(describeIntervalReference(single).description).toContain("Tidak ada jadwal interval rutin");
  });

  it.each(["gentamisin", "amikasin", "vankomisin"] as const)(
    "menggunakan angka rujukan yang sudah dihitung, bukan membuat nilai baru untuk %s", antibiotic => {
      const result = calculateRecommendations(patient({ antibiotic }));
      const original = JSON.stringify(result);
      const primary = result.recommendations.institutionalPrimary;
      const literature = result.recommendations.anmf2024;
      for (const rec of [primary, literature]) {
        const doseShape = describeDoseReference(rec.dose);
        const intervalShape = describeIntervalReference(rec.interval, rec.eligibleForRegimenEvaluation);
        expect(doseShape.label).not.toBe("");
        expect(intervalShape.label).not.toBe("");
        expect(doseShape.description.length).toBeGreaterThan(15);
      }
      const regimen = evaluateRegimen(result, {
        actualDoseMg: 10, actualIntervalHours: 24,
        manualDoseMinMg: 8, manualDoseMaxMg: 12,
        manualIntervalMinHours: 24, manualIntervalMaxHours: 48,
      });
      expect(regimen.targets).toHaveLength(3);
      expect(JSON.stringify(result)).toBe(original);
    },
  );

  it("memberi keterangan dosis tunggal tanpa frekuensi rutin untuk vankomisin dengan kriteria gangguan ginjal", () => {
    const result = calculateRecommendations(patient({ antibiotic: "vankomisin", currentWeightKg: 1.8, serumCreatinineMgDl: 1 }));
    const primary = result.recommendations.institutionalPrimary;
    expect(primary.interval.kind).toBe("single-dose-only");
    expect(describeDoseReference(primary.dose).label).toBe("Nilai dosis tunggal");
    expect(describeIntervalReference(primary.interval, primary.eligibleForRegimenEvaluation).label).toBe("Dosis tunggal (tanpa interval rutin)");
    expect(primary.dose.minTotalMg).toBe(18);
    expect(primary.dose.maxTotalMg).toBe(18);
  });
});
