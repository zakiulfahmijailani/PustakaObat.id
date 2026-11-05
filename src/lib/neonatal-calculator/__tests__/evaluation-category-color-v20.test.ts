import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActualEvaluationSummary } from "../../../components/neonatal-calculator/ActualEvaluationSummary";
import {
  EVALUATION_CATEGORY_COLOR, HighlightEvaluationCategory, visibleCategoryForStatus,
} from "../../../components/neonatal-calculator/EvaluationCategoryColor";
import { EvaluationStatusText } from "../../../components/neonatal-calculator/EvaluationStatusText";
import { buildActualEvaluationSummary } from "../actual-evaluation-summary";
import { calculateRecommendations } from "../recommendation-engine";
import { evaluateRegimen } from "../evaluation-engine";
import { patient } from "./fixtures";

const renderStatus = (status: Parameters<typeof EvaluationStatusText>[0]["status"], message: string) =>
  renderToStaticMarkup(React.createElement(EvaluationStatusText, { status, message }));

describe("[2.5] identical colors for v20 actual dose and frequency categories", () => {
  it.each([
    ["Sesuai", "text-success"],
    ["Berlebih", "text-error"],
    ["Kurang", "text-warning"],
  ] as const)("maps %s to the semantic design-system token %s", (category, colorClass) => {
    expect(EVALUATION_CATEGORY_COLOR[category]).toBe(colorClass);
    const html = renderToStaticMarkup(React.createElement(HighlightEvaluationCategory, {
      category, text: category + " (+0,3 mg)",
    }));
    expect(html).toContain(`data-evaluation-category="${category}" class="${colorClass}"`);
    expect(html.replace(/<[^>]*>/g, "")).toBe(category + " (+0,3 mg)");
  });

  it.each([
    ["sesuai", "Sesuai", "Sesuai", "text-success"],
    ["berlebih", "Berlebih (+0,3 mg)", "Berlebih", "text-error"],
    ["kurang", "Kurang (-1 mg)", "Kurang", "text-warning"],
    ["lebih-pendek", "Berlebih (+0,333 dosis/hari)", "Berlebih", "text-error"],
    ["lebih-panjang", "Kurang (-0,333 dosis/hari)", "Kurang", "text-warning"],
  ] as const)("colors %s as %s on both actual-dose and actual-frequency presentations", (status, message, category, colorClass) => {
    expect(visibleCategoryForStatus(status, message)).toBe(category);
    const html = renderStatus(status, message);
    expect(html).toContain(`data-evaluation-category="${category}" class="${colorClass}"`);
    expect(html.replace(/<[^>]*>/g, "")).toBe(
      status === "lebih-pendek" ? "Lebih pendek — " + message :
      status === "lebih-panjang" ? "Lebih panjang — " + message : message
    );
  });

  it("keeps indeterminate or mismatched discrete intervals neutral, never success green", () => {
    expect(visibleCategoryForStatus("opsi-diskrit-tidak-cocok", "Sesuai")).toBeNull();
    expect(visibleCategoryForStatus("tidak-dapat-dievaluasi", "Tidak ada interval rutin")).toBeNull();
    expect(renderStatus("opsi-diskrit-tidak-cocok", "Sesuai")).not.toContain("data-evaluation-category");
    const html = renderToStaticMarkup(React.createElement(HighlightEvaluationCategory, {
      category: null, text: "Tidak dapat dibandingkan",
    }));
    expect(html).not.toContain("data-evaluation-category");
  });

  it("preserves all four comparisons and colors each independently inside a critical summary", () => {
    const calc = calculateRecommendations(patient({
      antibiotic: "amikasin", gestationalAgeWeeks: 30, postnatalAgeDays: 4, currentWeightKg: 1.38,
    }));
    const evalResult = evaluateRegimen(calc, {
      actualDoseMg: 21, actualIntervalHours: 24,
      manualDoseMinMg: 21, manualDoseMaxMg: 21,
      manualIntervalMinHours: 24, manualIntervalMaxHours: 24,
    });
    const original = JSON.stringify(evalResult);
    const summary = buildActualEvaluationSummary(calc, evalResult.input);
    expect(summary.tone).toBe("critical");
    expect(summary.items.map(item => item.category)).toEqual(["Berlebih", "Sesuai", "Berlebih", "Berlebih"]);
    const html = renderToStaticMarkup(React.createElement(ActualEvaluationSummary, { calculated: calc, evaluation: evalResult }));
    expect((html.match(/data-evaluation-category="Berlebih" class="text-error"/g) ?? []).length).toBe(3);
    expect((html.match(/data-evaluation-category="Sesuai" class="text-success"/g) ?? []).length).toBe(1);
    expect(html).toContain("Dosis aktual vs Pedoman RS");
    expect(html).toContain("Frekuensi aktual vs Pedoman RS");
    expect(html).toContain("Berlebih (+0,3 mg; +1,4%)");
    expect(JSON.stringify(evalResult)).toBe(original);
  });

  it("colors an excessive frequency red and a deficient frequency amber without altering the output", () => {
    const calc = calculateRecommendations(patient({ gestationalAgeWeeks: 33, postnatalAgeDays: 8, currentWeightKg: 1.72 }));
    const mk = (hours: number) => evaluateRegimen(calc, {
      actualDoseMg: 8.6, actualIntervalHours: hours,
      manualDoseMinMg: 8.6, manualDoseMaxMg: 8.6,
      manualIntervalMinHours: 24, manualIntervalMaxHours: 48,
    });
    const fast = mk(12), slow = mk(72);
    const origFast = JSON.stringify(fast), origSlow = JSON.stringify(slow);
    const fastHtml = renderToStaticMarkup(React.createElement(ActualEvaluationSummary, { calculated: calc, evaluation: fast }));
    const slowHtml = renderToStaticMarkup(React.createElement(ActualEvaluationSummary, { calculated: calc, evaluation: slow }));
    expect(fastHtml).toContain('data-evaluation-category="Berlebih" class="text-error"');
    expect(slowHtml).toContain('data-evaluation-category="Kurang" class="text-warning"');
    expect(JSON.stringify(fast)).toBe(origFast);
    expect(JSON.stringify(slow)).toBe(origSlow);
  });
});
