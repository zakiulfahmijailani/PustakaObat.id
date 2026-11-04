import { describe, expect, it } from "vitest";
import { calculateRecommendations } from "../recommendation-engine";
import { evaluateRegimen } from "../evaluation-engine";
import { buildRecommendationPdf, buildEvaluationPdf } from "../pdf-reports";
import { BATCH_COLUMNS, processBatchTable } from "../batch-engine";
import { buildBatchResultWorkbook } from "../batch-workbook";
import { loadV20Reference } from "../../../../tests/helpers/neonatal-v20-reference";
import { patient } from "./fixtures";
import type { Antibiotic } from "../types";

type CombinationCase = {
  antibiotic: Antibiotic;
  ga: number;
  pna: number;
  regular: number;
  hypothermia: number;
  cox: number;
  combined: number;
};

const cases: CombinationCase[] = [
  { antibiotic: "gentamisin", ga: 28, pna: 0, regular: 48, hypothermia: 48, cox: 60, combined: 48 },
  { antibiotic: "gentamisin", ga: 32, pna: 0, regular: 36, hypothermia: 36, cox: 48, combined: 36 },
  { antibiotic: "gentamisin", ga: 35, pna: 0, regular: 24, hypothermia: 36, cox: 36, combined: 36 },
  { antibiotic: "amikasin", ga: 28, pna: 5, regular: 48, hypothermia: 60, cox: 60, combined: 60 },
  { antibiotic: "amikasin", ga: 26, pna: 20, regular: 36, hypothermia: 48, cox: 48, combined: 48 },
  { antibiotic: "amikasin", ga: 32, pna: 5, regular: 36, hypothermia: 48, cox: 48, combined: 48 },
  { antibiotic: "amikasin", ga: 32, pna: 15, regular: 24, hypothermia: 36, cox: 36, combined: 36 },
  { antibiotic: "amikasin", ga: 35, pna: 5, regular: 24, hypothermia: 36, cox: 36, combined: 36 },
  { antibiotic: "vankomisin", ga: 28, pna: 2, regular: 18, hypothermia: 18, cox: 18, combined: 18 },
  { antibiotic: "vankomisin", ga: 32, pna: 5, regular: 12, hypothermia: 12, cox: 12, combined: 12 },
  { antibiotic: "vankomisin", ga: 40, pna: 10, regular: 8, hypothermia: 8, cox: 8, combined: 8 },
];
const flags = [
  { name: "regular", hypothermia: false, cox: false },
  { name: "hypothermia", hypothermia: true, cox: false },
  { name: "cox", hypothermia: false, cox: true },
  { name: "combined", hypothermia: true, cox: true },
] as const;

function calculate(c: CombinationCase, hypothermia: boolean, cox: boolean) {
  return calculateRecommendations(patient({
    antibiotic: c.antibiotic,
    gestationalAgeWeeks: c.ga,
    gestationalAgeDays: 0,
    postnatalAgeDays: c.pna,
    currentWeightKg: 1.5,
    renalDataAvailable: true,
    serumCreatinineMgDl: 0.4,
    urineOutputMlKgHour: 2,
    therapeuticHypothermia: hypothermia,
    coxInhibitorTherapy: cox,
  }));
}
const pdfText = (bytes: Uint8Array) => [...new TextDecoder().decode(bytes).matchAll(/\((.*)\) Tj/g)]
  .map(match => match[1].replace(/\\([\\()])/g, "$1")).join(" ").replace(/\s+/g, " ");

describe("kombinasi hipotermia terapeutik + indometasin/ibuprofen v20", () => {
  it.each(cases)("mempertahankan dosis dan menguji keempat status terapi: $antibiotic GA=$ga PNA=$pna", c => {
    const baseline = calculate(c, false, false);
    const baselineDose = baseline.recommendations.anmf2024.dose;
    for (const flag of flags) {
      const result = calculate(c, flag.hypothermia, flag.cox);
      const expected = c[flag.name];
      expect(result.recommendations.anmf2024.interval, flag.name).toMatchObject({ kind: "single", hours: expected });
      expect(result.recommendations.anmf2024.dose).toEqual(baselineDose);
      expect(result.recommendations.institutionalPrimary.dose).toEqual(baseline.recommendations.institutionalPrimary.dose);
      expect(result.recommendations.institutionalPrimary.interval).toEqual(baseline.recommendations.institutionalPrimary.interval);
    }
  });

  it.each(cases)("menerapkan kombinasi sekali dan tidak mengubah catatan akibat kondisi lain: $antibiotic GA=$ga PNA=$pna", c => {
    const combined = calculate(c, true, true).recommendations.anmf2024;
    const hypoOnly = calculate(c, true, false).recommendations.anmf2024;
    const coxOnly = calculate(c, false, true).recommendations.anmf2024;
    const text = combined.notes.join(" ");
    if (c.antibiotic === "gentamisin") {
      expect(combined.interval).toEqual(hypoOnly.interval);
      expect(text).toContain("ANMF tidak mengatur kombinasi keduanya");
      expect(text).toContain("kalkulator hanya menerapkan aturan hipotermia");
      expect(text).toContain("keputusan tim peneliti");
      expect(combined.notes.filter(x => x.includes("dicentang bersamaan"))).toHaveLength(1);
      expect(coxOnly.notes.join(" ")).toContain("ANMF memperpanjang interval 12 jam");
    } else if (c.antibiotic === "amikasin") {
      expect(combined.interval).toEqual(hypoOnly.interval);
      expect(combined.interval).toEqual(coxOnly.interval);
      expect(text).toContain("kalkulator memperpanjang 12 jam satu kali");
      expect(text).toContain("ANMF tidak mengatur kombinasi keduanya");
      expect(combined.notes.filter(x => x.includes("Bila keduanya dicentang"))).toHaveLength(1);
    } else {
      expect(combined.interval).toEqual(hypoOnly.interval);
      expect(combined.notes).toEqual(hypoOnly.notes);
      expect(coxOnly.notes).toEqual(calculate(c, false, false).recommendations.anmf2024.notes);
      expect(text).toContain("sebelum memberi dosis tersebut");
    }
  });

  it("mencocokkan seluruh profil notebook v20 yang mencentang kedua terapi", () => {
    const reference = loadV20Reference();
    const all = [...reference.batchRecommendations, ...reference.recommendations];
    expect(all).toHaveLength(1272);
    const simultaneous = all.filter(x => x.input.therapeuticHypothermia && x.input.coxInhibitorTherapy);
    for (const item of simultaneous) {
      const result = calculateRecommendations(item.input);
      const rec = result.recommendations.anmf2024;
      expect([rec.dose.minTotalMg, rec.dose.maxTotalMg], JSON.stringify(item.input)).toEqual(item.expected.litDose);
      if (rec.interval.kind === "single") expect([rec.interval.hours, rec.interval.hours]).toEqual(item.expected.litInterval);
    }
  });

  it.each(["gentamisin", "amikasin", "vankomisin"] as const)(
    "catatan kombinasi tetap terbaca pada PDF rekomendasi dan evaluasi: %s", antibiotic => {
      const c = cases.find(x => x.antibiotic === antibiotic)!;
      const result = calculate(c, true, true);
      const evaluation = evaluateRegimen(result, {
        actualDoseMg: 8, actualIntervalHours: 24,
        manualDoseMinMg: 7.5, manualDoseMaxMg: 11.25,
        manualIntervalMinHours: 24, manualIntervalMaxHours: 48,
      });
      const reports = [buildRecommendationPdf(result), buildEvaluationPdf(result, evaluation, true)];
      for (const bytes of reports) {
        const printed = pdfText(bytes);
        expect(printed).toContain("Hipotermia terapeutik");
        expect(printed).toContain("Rujukan");
        if (antibiotic === "gentamisin") {
          expect(printed).toContain("ANMF tidak mengatur kombinasi keduanya");
          expect(printed).toContain("aturan hipotermia");
        } else if (antibiotic === "amikasin") {
          expect(printed).toContain("memperpanjang 12 jam satu kali");
        } else {
          expect(printed).toContain("sebelum dosis ke-2");
        }
      }
    },
  );

  it("Excel nyata menyimpan interval kombinasi sesuai notebook tanpa mengubah 24 kolom", async () => {
    const choices = cases.filter((x, i, a) => a.findIndex(y => y.antibiotic === x.antibiotic) === i);
    const rows: unknown[][] = [];
    const expected = new Map<string, { interval: number; dose: string }>();
    for (const c of choices) {
      const baseline = calculate(c, false, false);
      for (const flag of flags) {
        const code = c.antibiotic + "-" + flag.name;
        const result = calculate(c, flag.hypothermia, flag.cox);
        const values: Record<string, string | number> = {
          kode_pasien: code,
          antibiotik: c.antibiotic,
          usia_gestasi_lahir_minggu: c.ga,
          usia_gestasi_lahir_hari: 0,
          usia_pascalahir_hari: c.pna,
          berat_badan_kg: 1.5,
          kreatinin_serum_mg_dl: 0.4,
          produksi_urin_ml_kg_jam: 2,
          hipotermia_terapeutik: flag.hypothermia ? "Ya" : "Tidak",
          terapi_cox_inhibitor: flag.cox ? "Ya" : "Tidak",
          sepsis_berat: "Tidak",
        };
        rows.push(BATCH_COLUMNS.map(key => values[key] ?? ""));
        expected.set(code, {
          interval: result.recommendations.anmf2024.interval.kind === "single"
            ? result.recommendations.anmf2024.interval.hours : -1,
          dose: String(baseline.recommendations.anmf2024.dose.minTotalMg),
        });
      }
    }
    const batch = processBatchTable([[...BATCH_COLUMNS], ...rows]);
    expect(batch).toMatchObject({ successCount: 12, errorCount: 0 });
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const buffer = new Uint8Array(await buildBatchResultWorkbook(batch));
    await workbook.xlsx.load(buffer as unknown as import("exceljs").Buffer);
    const sheet = workbook.getWorksheet("Hasil per Pasien")!;
    const columns = sheet.getRow(1).values as (string | undefined)[];
    const codeCol = columns.indexOf("Kode Pasien");
    const intervalCol = columns.indexOf("Frekuensi Literatur Terkini");
    const doseCol = columns.indexOf("Dosis Literatur Terkini (mg)");
    expect(columns.filter(Boolean)).toHaveLength(24);
    expect(codeCol).toBeGreaterThan(0);
    expect(intervalCol).toBeGreaterThan(0);
    for (let rowIdx = 2; rowIdx <= sheet.rowCount; rowIdx++) {
      const row = sheet.getRow(rowIdx);
      const code = String(row.getCell(codeCol).value);
      const target = expected.get(code);
      expect(target, code).toBeDefined();
      expect(String(row.getCell(intervalCol).value), code).toBe("tiap " + target!.interval + " jam");
      const dose = String(row.getCell(doseCol).value);
      expect(dose).toContain(target!.dose.replace(".", ","));
    }
  });
});
