import { describe, expect, it } from "vitest";
import { buildActualEvaluationSummary } from "../actual-evaluation-summary";
import { calculateRecommendations } from "../recommendation-engine";
import { evaluateRegimen } from "../evaluation-engine";
import { patient } from "./fixtures";

describe("ringkasan pemberian aktual", () => {
  it("menampilkan tiga perbandingan berlebih pada kasus Amikasin dalam review", () => {
    const calc = calculateRecommendations(patient({ antibiotic: "amikasin", gestationalAgeWeeks: 30, postnatalAgeDays: 4, currentWeightKg: 1.38 }));
    const before = JSON.stringify(calc);
    const summary = buildActualEvaluationSummary(calc, { actualDoseMg: 21, actualIntervalHours: 24 });
    expect(summary.tone).toBe("critical");
    expect(summary.title).toBe("Pemberian aktual BERLEBIH dibanding rujukan");
    expect(summary.items.map(item => item.message)).toEqual([
      "Berlebih (+0,3 mg; +1,4%)", "Sesuai", "Berlebih (+4,44 mg; +26,8%)",
      "Berlebih (+0,333 dosis/hari; +50,0%; interval 12 jam lebih pendek dari interval 36 jam)",
    ]);
    expect(summary.items.map(item => item.label)).toEqual([
      "Dosis aktual vs Pedoman RS", "Frekuensi aktual vs Pedoman RS",
      "Dosis aktual vs Literatur Terkini", "Frekuensi aktual vs Literatur Terkini",
    ]);
    expect(JSON.stringify(calc)).toBe(before);
  });

  it("memberi perhatian kuning ketika dosis kurang dan tidak ada komponen berlebih", () => {
    const calc = calculateRecommendations(patient({ gestationalAgeWeeks: 38, currentWeightKg: 3 }));
    const summary = buildActualEvaluationSummary(calc, { actualDoseMg: 14, actualIntervalHours: 24 });
    expect(summary.tone).toBe("warning");
    expect(summary.title).toContain("KURANG");
    expect(summary.items.map(item => item.category)).toEqual(["Kurang", "Sesuai", "Kurang", "Sesuai"]);
    expect(summary.items[0].message).toBe("Kurang (-1 mg; -6,7%)");
  });

  it("tetap merah dan menjelaskan kedua arah ketika rujukan memberi hasil campuran", () => {
    const calc = calculateRecommendations(patient({ antibiotic: "amikasin", gestationalAgeWeeks: 30, postnatalAgeDays: 4, currentWeightKg: 1.38 }));
    const summary = buildActualEvaluationSummary(calc, { actualDoseMg: 20.5, actualIntervalHours: 24 });
    expect(summary.tone).toBe("critical");
    expect(summary.title).toContain("BERLEBIH dan KURANG");
    expect(summary.items[0].category).toBe("Kurang");
    expect(summary.items[2].category).toBe("Berlebih");
  });

  it("menggunakan frekuensi dosis per hari, bukan arah interval dalam jam", () => {
    const calc = calculateRecommendations(patient({ gestationalAgeWeeks: 33, postnatalAgeDays: 8, currentWeightKg: 1.72 }));
    const fast = buildActualEvaluationSummary(calc, { actualDoseMg: 8.6, actualIntervalHours: 12 });
    const slow = buildActualEvaluationSummary(calc, { actualDoseMg: 8.6, actualIntervalHours: 72 });
    expect(fast.tone).toBe("critical");
    expect(fast.items[1].category).toBe("Berlebih");
    expect(slow.tone).toBe("warning");
    expect(slow.items[1].category).toBe("Kurang");
  });

  it("mengabaikan pembanding usia tersembunyi dan perhitungan manual", () => {
    const calc = calculateRecommendations(patient({ gestationalAgeWeeks: 33, postnatalAgeDays: 8, currentWeightKg: 1.72 }));
    calc.recommendations.institutionalAgeComparator.dose = { minMgPerKg: 100, maxMgPerKg: 100, minTotalMg: 172, maxTotalMg: 172 };
    const actual = { actualDoseMg: 8.6, actualIntervalHours: 36 };
    const evaluation = evaluateRegimen(calc, { ...actual, manualDoseMinMg: 100, manualDoseMaxMg: 100, manualIntervalMinHours: 1, manualIntervalMaxHours: 1 });
    expect(evaluation.targets[1].actualDose.status).toBe("kurang");
    const summary = buildActualEvaluationSummary(calc, evaluation.input);
    expect(summary).toEqual(buildActualEvaluationSummary(calc, actual));
    expect(summary.tone).toBe("success");
    expect(summary.items.every(item => item.category === "Sesuai")).toBe(true);
  });

  it("tidak mengklaim sesuai penuh jika interval atau rekomendasi tidak dapat dibandingkan", () => {
    const calc = calculateRecommendations(patient());
    const summary = buildActualEvaluationSummary(calc, { actualDoseMg: 7.5, actualIntervalHours: null });
    expect(summary.tone).toBe("info");
    expect(summary.items[1].message).toContain("interval aktual tidak diisi");
    calc.recommendations.institutionalPrimary.interval = { kind: "single-dose-only", label: "Dosis tunggal" };
    const single = buildActualEvaluationSummary(calc, { actualDoseMg: 7.5, actualIntervalHours: 36 });
    expect(single.tone).toBe("info");
    expect(single.items[1].message).toContain("tidak menetapkan interval rutin");
  });

  it("tidak menganggap interval di antara opsi diskrit sebagai sesuai", () => {
    const calc = calculateRecommendations(patient());
    calc.recommendations.institutionalPrimary.interval = { kind: "discrete", allowedHours: [24, 48], label: "24 atau 48 jam" };
    const summary = buildActualEvaluationSummary(calc, { actualDoseMg: 7.5, actualIntervalHours: 36 });
    expect(summary.tone).toBe("info");
    expect(summary.items[1].category).toBeNull();
    expect(summary.items[1].message).toBe("Tidak sesuai opsi interval yang tersedia.");
  });
});
