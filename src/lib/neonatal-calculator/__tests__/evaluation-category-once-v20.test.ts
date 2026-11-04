import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EvaluationStatusText, categoryDisplayParts } from "../../../components/neonatal-calculator/EvaluationStatusText";
import { calculateRecommendations } from "../recommendation-engine";
import { evaluateRegimen } from "../evaluation-engine";
import { patient } from "./fixtures";

const sample = [
  { status: "sesuai", message: "Sesuai", expected: "Sesuai" },
  { status: "sesuai", message: "Sesuai dengan q24h.", expected: "Sesuai dengan q24h." },
  { status: "berlebih", message: "Berlebih (+0,3 mg; +1,4%)", expected: "Berlebih (+0,3 mg; +1,4%)" },
  { status: "kurang", message: "Kurang (-1 mg; -6,7%)", expected: "Kurang (-1 mg; -6,7%)" },
  { status: "berlebih", message: "Berlebih: (+0,3 mg)", expected: "Berlebih: (+0,3 mg)" },
  { status: "tidak-dapat-dievaluasi", message: "Tidak dapat dievaluasi.", expected: "Tidak dapat dievaluasi." },
  { status: "tidak-dapat-dievaluasi", message: "Tidak ada interval rutin untuk dibandingkan.", expected: "Tidak dapat dievaluasi — Tidak ada interval rutin untuk dibandingkan." },
  { status: "lebih-pendek", message: "Berlebih (+0,333 dosis/hari; +50,0%)", expected: "Lebih pendek — Berlebih (+0,333 dosis/hari; +50,0%)" },
  { status: "lebih-panjang", message: "Kurang (-0,333 dosis/hari)", expected: "Lebih panjang — Kurang (-0,333 dosis/hari)" },
  { status: "opsi-diskrit-tidak-cocok", message: "Sesuai", expected: "Opsi diskrit tidak cocok — Sesuai" },
] as const;

const renderedText = (status: Parameters<typeof EvaluationStatusText>[0]["status"], message: string) =>
  renderToStaticMarkup(React.createElement(EvaluationStatusText, { status, message }))
    .replace(/<[^>]*>/g, "");

describe("[kategori-sekali] — hasil evaluasi v20 pada kartu web", () => {
  it.each(sample)("renders $status with one status and the original comparison: $message", ({status,message,expected}) => {
    const normalized = categoryDisplayParts(status, message);
    expect(normalized.label).not.toBe("");
    const html = renderToStaticMarkup(React.createElement(EvaluationStatusText,{status,message}));
    expect(html).toContain("<strong");
    expect(renderedText(status,message)).toBe(expected);
    expect(html).not.toMatch(/(Sesuai|Berlebih|Kurang)<\/strong>\s*[—-]\s*\1/);
  });

  it.each(["gentamisin", "amikasin", "vankomisin"] as const)(
    "does not change clinical evaluation for %s", antibiotic => {
      const calc = calculateRecommendations(patient({
        antibiotic, gestationalAgeWeeks: 30, postnatalAgeDays: 4, currentWeightKg: 1.38,
      }));
      const before = JSON.stringify(calc);
      for(const dose of [8, 21]) {
        const evaluation = evaluateRegimen(calc,{
          actualDoseMg:dose, actualIntervalHours:24,
          manualDoseMinMg:7.5, manualDoseMaxMg:11.25,
          manualIntervalMinHours:24, manualIntervalMaxHours:48,
        });
        const unchanged = JSON.stringify(evaluation);
        for (const target of evaluation.targets) {
          for (const part of [target.actualDose,target.actualInterval]) {
            const display=renderedText(part.status,part.message);
            if (part.status === "sesuai") expect(display).not.toMatch(/^Sesuai\s*[—-]\s*Sesuai/);
            if (part.status === "berlebih") expect(display).not.toMatch(/^Berlebih\s*[—-]\s*Berlebih/);
            if (part.status === "kurang") expect(display).not.toMatch(/^Kurang\s*[—-]\s*Kurang/);
          }
        }
        expect(JSON.stringify(evaluation)).toBe(unchanged);
      }
      expect(JSON.stringify(calc)).toBe(before);
    },
  );

  it("matches the actual review example without duplicated classifications", () => {
    const calc=calculateRecommendations(patient({
      antibiotic:"amikasin",gestationalAgeWeeks:30,postnatalAgeDays:4,currentWeightKg:1.38,
    }));
    const evaluation=evaluateRegimen(calc,{
      actualDoseMg:21,actualIntervalHours:24,
      manualDoseMinMg:21,manualDoseMaxMg:21,
      manualIntervalMinHours:24,manualIntervalMaxHours:24,
    });
    const primary = evaluation.targets.find(t=>t.recommendationId===calc.recommendations.institutionalPrimary.id)!;
    const lit = evaluation.targets.find(t=>t.recommendationId===calc.recommendations.anmf2024.id)!;
    expect(renderedText(primary.actualDose.status,primary.actualDose.message)).toBe("Berlebih (+0,3 mg; +1,4%)");
    expect(renderedText(lit.actualDose.status,lit.actualDose.message)).toBe("Berlebih (+4,44 mg; +26,8%)");
    expect(renderedText(lit.actualInterval.status,lit.actualInterval.message)).toContain("Berlebih (+0,333 dosis/hari; +50,0%");
  });
});
