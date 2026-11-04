import { describe, expect, it } from "vitest";
import { calculateRecommendations } from "../recommendation-engine";
import { evaluateRegimen } from "../evaluation-engine";
import { buildRecommendationPdf, buildEvaluationPdf } from "../pdf-reports";
import { BATCH_COLUMNS, processBatchTable } from "../batch-engine";
import { buildBatchResultWorkbook } from "../batch-workbook";
import { ANMF_RENAL, getDisplayV20Warnings, withAnmfRenalNote } from "../warning-catalog-v20";
import { patient } from "./fixtures";

const antibiotics = ["gentamisin", "amikasin", "vankomisin"] as const;
const renalScenarios = [
  { name: "SCr tepat 1 tanpa oliguria", scr: 1, uop: 2, impaired: true },
  { name: "SCr tepat 0,5 dan UOP di bawah 1", scr: 0.5, uop: 0.99, impaired: true },
  { name: "SCr di bawah 0,5", scr: 0.49, uop: 0.1, impaired: false },
  { name: "UOP tepat 1", scr: 0.5, uop: 1, impaired: false },
  { name: "UOP tidak diketahui pada SCr 0,7", scr: 0.7, uop: undefined, impaired: false },
  { name: "SCr 1 tanpa data UOP", scr: 1, uop: undefined, impaired: true },
] as const;

const actualText = (bytes: Uint8Array) => [...new TextDecoder().decode(bytes).matchAll(/\\((.*)\\) Tj/g)]
  .map(match => match[1].replace(/\\\\([\\\\()])/g, "$1")).join(" ");

describe("catatan ginjal dan atribusi peringatan — sumber notebook v20", () => {
  it.each(antibiotics)("menambah catatan ANMF tepat sekali dan tanpa mengubah catatan awal: %s", antibiotic => {
    const prior = ["Catatan standar"];
    expect(withAnmfRenalNote(prior, antibiotic, false)).toBe(prior);
    const result = withAnmfRenalNote(prior, antibiotic, true);
    expect(result).toEqual([...prior, ANMF_RENAL[antibiotic]]);
    expect(withAnmfRenalNote(result, antibiotic, true)).toEqual(result);
    expect(prior).toEqual(["Catatan standar"]);
  });

  for (const antibiotic of antibiotics) {
    for (const scenario of renalScenarios) {
      it(`${antibiotic}: ${scenario.name}`, () => {
        const r = calculateRecommendations(patient({
          antibiotic, renalDataAvailable: true,
          serumCreatinineMgDl: scenario.scr,
          urineOutputMlKgHour: scenario.uop,
          postnatalAgeDays: 2,
        }));
        expect(r.renalStatus === "renal-impairment-criteria-met").toBe(scenario.impaired);
        const notes = r.recommendations.anmf2024.notes;
        expect(notes.filter(note => note === ANMF_RENAL[antibiotic])).toHaveLength(scenario.impaired ? 1 : 0);
        const warnings = getDisplayV20Warnings(r);
        const renal = warnings.filter(warning => warning.title === "Kemungkinan gangguan fungsi ginjal");
        expect(renal).toHaveLength(scenario.impaired ? 1 : 0);
        if (scenario.impaired) {
          expect(renal[0].message).toContain("UNC (2023)");
          expect(renal[0].message).toContain("keputusan tim peneliti");
          expect(renal[0].message).toContain(ANMF_RENAL[antibiotic]);
          expect(warnings.some(w => w.title === "Kreatinin serum pada 72 jam pertama kehidupan" && w.message.includes("Evans dkk., 2023"))).toBe(true);
          if (antibiotic === "vankomisin") {
            expect(r.recommendations.institutionalPrimary.interval.kind).toBe("single-dose-only");
            expect(r.recommendations.institutionalPrimary.notes.join(" ")).toContain("UNC (2023): tahan dosis berikutnya");
          }
        } else {
          expect(warnings.every(w => !w.message.includes(ANMF_RENAL[antibiotic]))).toBe(true);
        }
        if (scenario.scr === 0.7) {
          expect(warnings.some(w => w.title === "Produksi urin tidak diisi" && w.message.includes("Menurut kriteria UNC (2023)"))).toBe(true);
        }
      });
    }
  }

  it.each(antibiotics)("data ginjal tidak tersedia = asumsi, bukan otomatis gangguan ginjal: %s", antibiotic => {
    const result = calculateRecommendations(patient({
      antibiotic, gestationalAgeWeeks: 26, currentWeightKg: 0.9,
      renalDataAvailable: false, serumCreatinineMgDl: undefined, urineOutputMlKgHour: undefined,
    }));
    expect(result.renalStatus).toBe("data-unavailable");
    expect(result.recommendations.anmf2024.notes).not.toContain(ANMF_RENAL[antibiotic]);
    const warnings = getDisplayV20Warnings(result);
    expect(warnings.some(w => w.title === "Data fungsi ginjal tidak diisi pada pasien berisiko tinggi"
      && w.severity === "critical"
      && w.message.includes("keputusan tim peneliti"))).toBe(true);
    expect(warnings.some(w => w.title === "Kemungkinan gangguan fungsi ginjal")).toBe(false);
  });

  it.each(antibiotics)("sumber Evans muncul hanya pada peringatan kreatinin 72 jam pertama: %s", antibiotic => {
    const early = calculateRecommendations(patient({
      antibiotic, postnatalAgeDays: 3, serumCreatinineMgDl: 1.1, urineOutputMlKgHour: 2,
    }));
    const later = calculateRecommendations(patient({
      antibiotic, postnatalAgeDays: 4, serumCreatinineMgDl: 1.1, urineOutputMlKgHour: 2,
    }));
    const refTitle = "Kreatinin serum pada 72 jam pertama kehidupan";
    const earlyWarning = getDisplayV20Warnings(early).find(w => w.title === refTitle);
    expect(earlyWarning?.message).toContain("Evans dkk., 2023");
    expect(getDisplayV20Warnings(later).some(w => w.title === refTitle)).toBe(false);
  });

  it("peringatan Papile menampilkan sumber hanya saat hipotermia dan usia gestasi <35 minggu", () => {
    const warning = getDisplayV20Warnings(calculateRecommendations(patient({
      antibiotic: "gentamisin", gestationalAgeWeeks: 34, therapeuticHypothermia: true,
    }))).find(w => w.title === "Periksa isian hipotermia terapeutik");
    expect(warning?.message).toContain("Papile dkk., 2014");
    const noWarning = getDisplayV20Warnings(calculateRecommendations(patient({
      antibiotic: "gentamisin", gestationalAgeWeeks: 35, therapeuticHypothermia: true,
    })));
    expect(noWarning.some(w => w.title === "Periksa isian hipotermia terapeutik")).toBe(false);
  });

  it.each(antibiotics)("PDF rekomendasi dan evaluasi memuat catatan ANMF dan UNC/Evans: %s", antibiotic => {
    const result = calculateRecommendations(patient({
      antibiotic, gestationalAgeWeeks: 26, postnatalAgeDays: 2, currentWeightKg: 0.9,
      serumCreatinineMgDl: 1.1, urineOutputMlKgHour: 1.8,
    }));
    const evaluation = evaluateRegimen(result, {
      actualDoseMg: 8, actualIntervalHours: 24,
      manualDoseMinMg: 7.5, manualDoseMaxMg: 11.25,
      manualIntervalMinHours: 24, manualIntervalMaxHours: 48,
    });
    for (const bytes of [buildRecommendationPdf(result), buildEvaluationPdf(result, evaluation, true)]) {
      const printed = actualText(bytes);
      expect(printed).toContain("ANMF, gangguan ginjal");
      expect(printed).toContain("UNC (2023)");
      expect(printed).toContain("Evans dkk., 2023");
      expect(printed).toContain("Rujukan");
      expect(printed).not.toContain("Terdapat sinyal perlunya evaluasi fungsi ginjal");
    }
  });

  it("sheet Peringatan XLSX nyata memuat peringatan ginjal masing-masing antibiotik tepat sekali", async () => {
    const rows = antibiotics.map((antibiotic, idx) => [
      "GINJAL-" + (idx + 1),
      antibiotic,
      32, 0, 2, 1.5, 1.1, 2,
      "Tidak", "Tidak", "Tidak",
      "", "", "", "", "", "",
    ]);
    const batch = processBatchTable([[...BATCH_COLUMNS], ...rows]);
    expect(batch.successCount).toBe(3);
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(await buildBatchResultWorkbook(batch)) as unknown as import("exceljs").Buffer);
    const sheet = workbook.getWorksheet("Peringatan")!;
    const cells: Array<{patient: string; text: string}> = [];
    sheet.eachRow((row, number) => {
      if (number > 1) cells.push({patient: String(row.getCell(2).value), text: String(row.getCell(4).value)});
    });
    for (let i = 0; i < antibiotics.length; i++) {
      const patientWarnings = cells.filter(x => x.patient === "GINJAL-" + (i+1));
      expect(patientWarnings.filter(x => x.text.includes(ANMF_RENAL[antibiotics[i]]))).toHaveLength(1);
      expect(patientWarnings.some(x => x.text.includes("UNC (2023)") && x.text.includes("keputusan tim peneliti"))).toBe(true);
      expect(patientWarnings.some(x => x.text.includes("Evans dkk., 2023"))).toBe(true);
    }
  });
});
