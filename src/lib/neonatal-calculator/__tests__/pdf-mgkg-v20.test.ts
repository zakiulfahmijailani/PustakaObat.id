import { describe, expect, it } from "vitest";
import { calculateRecommendations } from "../recommendation-engine";
import { evaluateRegimen } from "../evaluation-engine";
import { buildEvaluationPdf, buildRecommendationPdf } from "../pdf-reports";
import { v20ActualDoseText } from "../notebook-results";
import { patient } from "./fixtures";

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const pdfText = (bytes: Uint8Array) => [...decode(bytes).matchAll(/\((.*)\) Tj/g)]
  .map(match => match[1].replace(/\\([\\()])/g, "$1")).join(" ");

describe("[3.1] PDF dosis mg dan mg/kg (presentasi saja)", () => {
  it.each([
    {
      antibiotic: "gentamisin" as const, weight: 1.5, scr: 0.4,
      hospital: "7,5-11,25 mg (5-7,5 mg/kg per pemberian)",
      literature: "7,5 mg (5 mg/kg per pemberian)",
    },
    {
      antibiotic: "amikasin" as const, weight: 1.38, scr: 0.4,
      hospital: "20,7 mg (15 mg/kg per pemberian)",
      literature: "16,56 mg (12 mg/kg per pemberian)",
    },
    {
      antibiotic: "vankomisin" as const, weight: 1.8, scr: 1,
      hospital: "18 mg (10 mg/kg per pemberian)",
      literature: "27 mg (15 mg/kg per pemberian)",
    },
  ])("menampilkan nilai RS dan ANMF tepat dalam mg dan mg/kg: $antibiotic", ({ antibiotic, weight, scr, hospital, literature }) => {
    const result = calculateRecommendations(patient({
      antibiotic, currentWeightKg: weight, serumCreatinineMgDl: scr,
    }));
    const before = JSON.stringify(result);
    const recommendation = pdfText(buildRecommendationPdf(result));
    expect(recommendation).toContain("Dosis per pemberian");
    expect(recommendation).toContain("Pedoman Rumah Sakit");
    expect(recommendation).toContain("Literatur Terkini");
    expect(recommendation).toContain(hospital);
    expect(recommendation).toContain(literature);
    expect(recommendation).not.toContain("Dosis aktual:");
    const evaluation = evaluateRegimen(result, {
      actualDoseMg: 9, actualIntervalHours: antibiotic === "vankomisin" ? null : 24,
      manualDoseMinMg: 9, manualDoseMaxMg: 9,
      manualIntervalMinHours: antibiotic === "vankomisin" ? null : 24,
      manualIntervalMaxHours: antibiotic === "vankomisin" ? null : 24,
    });
    const inputSnapshot = JSON.stringify(evaluation);
    const evaluationPdf = pdfText(buildEvaluationPdf(result, evaluation, false));
    expect(evaluationPdf).toContain(hospital);
    expect(evaluationPdf).toContain(literature);
    expect(evaluationPdf).toContain("Dosis aktual: " + v20ActualDoseText(9, weight));
    expect(JSON.stringify(result)).toBe(before);
    expect(JSON.stringify(evaluation)).toBe(inputSnapshot);
  });

  it("menampilkan mg/kg dosis aktual dengan pembulatan layar yang sama, tanpa mengubah status evaluasi", () => {
    const calculated = calculateRecommendations(patient({
      antibiotic: "amikasin", gestationalAgeWeeks: 30, postnatalAgeDays: 4, currentWeightKg: 1.38,
    }));
    const evaluation = evaluateRegimen(calculated, {
      actualDoseMg: 21, actualIntervalHours: 24,
      manualDoseMinMg: 21, manualDoseMaxMg: 21,
      manualIntervalMinHours: 24, manualIntervalMaxHours: 24,
    });
    const original = JSON.stringify({ calculated, evaluation });
    expect(v20ActualDoseText(21, 1.38)).toBe("21 mg (15,217 mg/kg per pemberian)");
    for (const enabled of [false, true]) {
      const bytes = buildEvaluationPdf(calculated, evaluation, enabled);
      expect(decode(bytes).startsWith("%PDF-1.4")).toBe(true);
      const content = pdfText(bytes);
      expect(content).toContain("Dosis aktual: 21 mg (15,217 mg/kg per pemberian)");
      expect(content).toContain("20,7 mg (15 mg/kg per pemberian)");
      expect(content).toContain("16,56 mg (12 mg/kg per pemberian)");
      expect(content).toContain("Berlebih (+0,3 mg; +1,4%)");
      expect(content).toContain("Berlebih (+4,44 mg; +26,8%)");
      expect(content.includes("Manual dosis:")).toBe(enabled);
    }
    expect(JSON.stringify({ calculated, evaluation })).toBe(original);
  });

  it("tidak mencantumkan mg/kg aktual pada PDF rekomendasi saja dan menjaga sumber v20", () => {
    const result = calculateRecommendations(patient({ antibiotic: "gentamisin", currentWeightKg: 1.5 }));
    const bytes = buildRecommendationPdf(result);
    const content = pdfText(bytes);
    expect(content).toContain("7,5-11,25 mg (5-7,5 mg/kg per pemberian)");
    expect(content).toContain("7,5 mg (5 mg/kg per pemberian)");
    expect(content).not.toContain("Dosis aktual:");
    expect(content).toContain("Versi aturan: 2026.11.03");
  });
});
