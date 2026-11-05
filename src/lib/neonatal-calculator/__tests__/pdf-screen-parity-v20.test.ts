import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { calculateRecommendations } from "../recommendation-engine";
import { evaluateRegimen } from "../evaluation-engine";
import { buildEvaluationPdf, buildRecommendationPdf } from "../pdf-reports";
import { v20ActualDoseText, v20RenalText } from "../notebook-results";
import { buildActualEvaluationSummary } from "../actual-evaluation-summary";
import { getDisplayV20Warnings, V20_WARNING_STYLE } from "../warning-catalog-v20";
import { describeDoseReference, describeIntervalReference } from "../reference-shape-v20";
import { getV20ReferenceEntries } from "../reference-block-v20";
import { patient } from "./fixtures";

const rawPdf = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replaceAll("≥", ">=").replaceAll("≤", "<=").replaceAll("−", "-")
  .replace(/[^\x20-\x7e]/g, character => character === "–" || character === "—" ? "-" : " ")
  .replace(/\s+/g, " ").trim();
const textPdf = (bytes: Uint8Array) => normalize([...rawPdf(bytes).matchAll(/\((.*)\) Tj/g)]
  .map(match => match[1].replace(/\\([\\()])/g, "$1")).join(" "));
const rgb = (hex: string) => [1,3,5].map(i => Number((Number.parseInt(hex.slice(i,i+2),16)/255).toFixed(4)).toString()).join(" ");
const css = readFileSync("src/app/globals.css", "utf8");

describe("[3.2] kesesuaian isi layar dan PDF v20", () => {
  it.each(["gentamisin", "amikasin", "vankomisin"] as const)(
    "menjaga ringkasan klinis, nilai dan jenis rujukan, peringatan, serta sumber pada dua jenis PDF %s",
    antibiotic => {
      const calculated = calculateRecommendations(patient({
        antibiotic, currentWeightKg: 1.5, serumCreatinineMgDl: antibiotic === "vankomisin" ? 1 : 0.6,
        urineOutputMlKgHour: 0.8,
      }));
      const evaluation = evaluateRegimen(calculated, {
        actualDoseMg: 9, actualIntervalHours: antibiotic === "vankomisin" ? null : 24,
        manualDoseMinMg: 9, manualDoseMaxMg: 9,
        manualIntervalMinHours: antibiotic === "vankomisin" ? null : 24,
        manualIntervalMaxHours: antibiotic === "vankomisin" ? null : 24,
      });
      const frozen = JSON.stringify({ calculated, evaluation });
      const refs = [calculated.recommendations.institutionalPrimary, calculated.recommendations.anmf2024];
      for (const [mode, bytes] of [
        ["rekomendasi", buildRecommendationPdf(calculated)],
        ["evaluasi", buildEvaluationPdf(calculated, evaluation, true)],
      ] as const) {
        const full = textPdf(bytes);
        expect(rawPdf(bytes)).toContain("%PDF-1.4");
        expect(full).toContain(normalize("Fungsi ginjal: " + v20RenalText(calculated)));
        expect(full).toContain("Konteks klinis:");
        expect(full).toContain("Pedoman Rumah Sakit tidak membedakan usia gestasi");
        expect(full).toContain("Cara membaca rujukan:");
        expect(full).toContain("Pedoman Rumah Sakit");
        expect(full).toContain("Literatur Terkini (ANMF 2024)");
        for (const reference of refs) {
          expect(full).toContain(normalize(describeDoseReference(reference.dose).label));
          expect(full).toContain(normalize(describeDoseReference(reference.dose).description));
          expect(full).toContain(normalize(describeIntervalReference(reference.interval, reference.eligibleForRegimenEvaluation).label));
          expect(full).toContain(normalize(describeIntervalReference(reference.interval, reference.eligibleForRegimenEvaluation).description));
          for (const note of reference.notes) expect(full).toContain(normalize(note));
        }
        for (const warning of getDisplayV20Warnings(calculated)) {
          if (warning.title) expect(full).toContain(normalize(warning.title));
          expect(full).toContain(normalize(warning.message));
          const style = V20_WARNING_STYLE[warning.severity];
          expect(rawPdf(bytes)).toContain(rgb(style.background) + " rg");
          expect(rawPdf(bytes)).toContain(rgb(style.color) + " RG");
        }
        for (const entry of getV20ReferenceEntries(antibiotic)) {
          expect(full).toContain(normalize(entry.label));
          expect(full).toContain(normalize(entry.text));
        }
        if (mode === "evaluasi") {
          expect(full).toContain(normalize(v20ActualDoseText(evaluation.input.actualDoseMg, calculated.input.currentWeightKg)));
          const summary = buildActualEvaluationSummary(calculated,evaluation.input);
          expect(full).toContain(normalize(summary.title));
          for (const item of summary.items) expect(full).toContain(normalize(item.label + ": " + item.message));
        } else expect(full).not.toContain("Dosis aktual:");
      }
      expect(JSON.stringify({ calculated, evaluation })).toBe(frozen);
    },
  );

  it("memakai palet warna kategori yang identik dengan token warna layar dan mewarnai hanya label", () => {
    const palette = [
      ["Sesuai", "success", "#287344"],
      ["Berlebih", "error", "#b4493f"],
      ["Kurang", "warning", "#a76f24"],
    ] as const;
    for (const [, token, hex] of palette) {
      expect(css).toContain("--color-" + token + ": " + hex + ";");
    }
    const result = calculateRecommendations(patient({antibiotic:"amikasin",currentWeightKg:1.5}));
    const samples = [
      {actual:22.5, expected:"Sesuai"}, // RS 15 mg/kg
      {actual:30, expected:"Berlebih"},
      {actual:3, expected:"Kurang"},
    ] as const;
    for (const {actual,expected} of samples) {
      const evaluation = evaluateRegimen(result,{
        actualDoseMg:actual, actualIntervalHours:24,
        manualDoseMinMg:actual, manualDoseMaxMg:actual, manualIntervalMinHours:24, manualIntervalMaxHours:24,
      });
      expect(buildActualEvaluationSummary(result,evaluation.input).items[0].category).toBe(expected);
      const pdf = rawPdf(buildEvaluationPdf(result,evaluation,true));
      const [, , hex] = palette.find(([label]) => label === expected)!;
      const color = rgb(hex);
      const pattern = new RegExp(color.replaceAll(".", "\\.") + " rg\\n[^\\n]+ Td\\n\\(" + expected + "\\) Tj");
      expect(pdf).toMatch(pattern);
    }
  });

  it("menyamakan warna dan latar ringkasan evaluasi, tanpa mengubah katalog peringatan klinis", () => {
    const p = {critical:"#b4493f",warning:"#a76f24",info:"#3f6f8f",success:"#14532d"};
    for (const [status, color] of Object.entries(p)) {
      const result=calculateRecommendations(patient({
        antibiotic: "amikasin",currentWeightKg:1.5,renalDataAvailable:false,serumCreatinineMgDl:undefined,urineOutputMlKgHour:undefined,
      }));
      const d = status === "critical" ? 30 : status === "warning" ? 3 : 22.5;
      const evaluation=evaluateRegimen(result,{
        actualDoseMg:d,actualIntervalHours:24,manualDoseMinMg:d,manualDoseMaxMg:d,manualIntervalMinHours:24,manualIntervalMaxHours:24,
      });
      const pdf=rawPdf(buildEvaluationPdf(result,evaluation,false));
      expect(pdf).toContain(rgb(color) + " RG");
    }
  });
});
