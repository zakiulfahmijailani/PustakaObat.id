import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BATCH_COLUMNS, processBatchTable } from "../batch-engine";
import { calculateRecommendations } from "../recommendation-engine";
import { evaluateRegimen } from "../evaluation-engine";
import { getV20ContextCheckboxes } from "../form-guidance-v20";
import { buildRecommendationPdf, buildEvaluationPdf, buildBatchSummaryPdf } from "../pdf-reports";
import { patient } from "./fixtures";

const pdfText = (pdf: Uint8Array) => [...new TextDecoder().decode(pdf).matchAll(/\((.*)\) Tj/g)]
  .map(match => match[1].replace(/\\([\\()])/g, "$1")).join(" ");
const internalTerms = /\bnotebook\b|\bkalkulator v20\b|\bmodifier\b|sumber dan batas aturan produksi/i;

describe("[3.4] bahasa hasil pasien tanpa istilah teknis lama", () => {
  it.each(["gentamisin", "amikasin", "vankomisin"] as const)(
    "hasil rekomendasi dan evaluasi PDF %s tidak menampilkan istilah internal; angka tetap sama",
    antibiotic => {
      const calculated = calculateRecommendations(patient({
        antibiotic, currentWeightKg: 1.5,
        serumCreatinineMgDl: antibiotic === "vankomisin" ? 1 : 0.6,
        urineOutputMlKgHour: 0.8,
      }));
      const evaluation = evaluateRegimen(calculated, {
        actualDoseMg: 9, actualIntervalHours: antibiotic === "vankomisin" ? null : 24,
        manualDoseMinMg: 9, manualDoseMaxMg: 9,
        manualIntervalMinHours: antibiotic === "vankomisin" ? null : 24,
        manualIntervalMaxHours: antibiotic === "vankomisin" ? null : 24,
      });
      const frozen = JSON.stringify({ calculated, evaluation });
      const outputs = [
        buildRecommendationPdf(calculated),
        buildEvaluationPdf(calculated, evaluation, false),
        buildEvaluationPdf(calculated, evaluation, true),
      ];
      for (const output of outputs) {
        const shown = pdfText(output);
        expect(shown).not.toMatch(internalTerms);
        expect(shown).toContain("Konteks klinis:");
        expect(shown).toContain("Tidak ada kondisi klinis tambahan yang dipilih");
        expect(shown).toContain("Pedoman Rumah Sakit");
        expect(shown).toContain("Literatur Terkini (ANMF 2024)");
        expect(shown).toContain("Versi aturan: 2026.11.03");
      }
      expect(JSON.stringify({ calculated, evaluation })).toBe(frozen);
    },
  );

  it("ringkasan batch PDF memakai 'data acuan' dan tidak membocorkan istilah notebook", () => {
    const batch = processBatchTable([BATCH_COLUMNS, [
      "P-01","Gentamisin",32,0,5,1.5,0.4,2,"Tidak","Tidak","Tidak",
      7.5,11.25,24,48,8,24,
    ]]);
    const before = JSON.stringify(batch);
    const content = pdfText(buildBatchSummaryPdf(batch));
    expect(content).toContain("hasil statistik perlu diperiksa terhadap data acuan");
    expect(content).not.toMatch(internalTerms);
    expect(JSON.stringify(batch)).toBe(before);
  });

  it("bantuan konteks vankomisin memakai kata pengguna tanpa mengubah efek tiga kondisi", () => {
    const flags = getV20ContextCheckboxes("vankomisin");
    expect(flags).toHaveLength(3);
    const cox = flags.find(flag => flag.key === "coxInhibitorTherapy");
    expect(cox?.effect).toBe(
      "Pada kalkulator ini, pilihan tersebut tidak mengubah dosis atau interval vankomisin.",
    );
    for (const flag of flags) expect(flag.effect).not.toMatch(internalTerms);
  });

  it("teks tampilan memuat penjelasan klinis, bukan kata notebook, modifier, atau istilah produksi lama", () => {
    // Source assertion supplements browser checks; internal module paths and frozen source
    // names deliberately keep the original notebook/version terminology.
    const ui = readFileSync("src/components/neonatal-calculator/NeonatalCalculator.tsx", "utf8");
    expect(ui).toContain("perhitungan menggunakan asumsi fungsi ginjal normal sesuai usia (ketetapan tim peneliti)");
    expect(ui).toContain("Rekomendasi disusun berdasarkan sumber rujukan yang tercantum");
    expect(ui).toContain("Sumber rujukan dan batas penggunaan");
    expect(ui).toContain("Tidak ada kondisi klinis tambahan yang dipilih");
    expect(ui).not.toContain("pada notebook.");
    expect(ui).not.toContain("Formulasi berasal dari materi rujukan notebook");
    expect(ui).not.toContain("Tidak ada modifier yang dipilih");
    expect(ui).not.toContain("kalkulator v20");
    // Clinical source attribution, warning wording, and rule version are not rewritten.
  });
});
