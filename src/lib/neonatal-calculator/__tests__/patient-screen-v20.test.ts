import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RenalStatusSummary, ActualAdministeredDoseSummary } from "../../../components/neonatal-calculator/PatientOutcomeSummary";
import { calculateRecommendations } from "../recommendation-engine";
import { evaluateRegimen } from "../evaluation-engine";
import { v20RenalText, v20ActualDoseText } from "../notebook-results";
import { patient } from "./fixtures";

describe("v20 single-patient results: renal status and actual dose in mg/kg", () => {
  it.each(["gentamisin", "amikasin", "vankomisin"] as const)(
    "shows the correct assumption when renal data are absent: %s", antibiotic => {
      const result = calculateRecommendations(patient({
        antibiotic, renalDataAvailable: false,
        serumCreatinineMgDl: undefined, urineOutputMlKgHour: undefined,
      }));
      expect(v20RenalText(result)).toBe("Tidak diisi (diasumsikan normal sesuai usia)");
      const html = renderToStaticMarkup(React.createElement(RenalStatusSummary,{calculated:result}));
      expect(html).toContain('aria-label="Ringkasan fungsi ginjal"');
      expect(html).toContain("diasumsikan normal sesuai usia");
      expect(html).not.toContain("SCr 0");
    },
  );

  it.each(["gentamisin", "amikasin", "vankomisin"] as const)(
    "displays measured SCr/UOP and UNC status without hiding the values: %s", antibiotic => {
      const result = calculateRecommendations(patient({
        antibiotic, renalDataAvailable: true, serumCreatinineMgDl: 0.6, urineOutputMlKgHour: 0.8,
      }));
      expect(result.renalStatus).toBe("renal-impairment-criteria-met");
      expect(v20RenalText(result)).toBe("SCr 0,6 mg/dL; produksi urin 0,8 mL/kg/jam: memenuhi kriteria gangguan ginjal UNC");
      const html = renderToStaticMarkup(React.createElement(RenalStatusSummary,{calculated:result}));
      expect(html).toContain("SCr 0,6 mg/dL");
      expect(html).toContain("0,8 mL/kg/jam");
      expect(html).toContain("memenuhi kriteria gangguan ginjal UNC");
    },
  );

  it.each(["gentamisin", "amikasin", "vankomisin"] as const)(
    "preserves zero measured values when UNC thresholds are not met: %s", antibiotic => {
      const result = calculateRecommendations(patient({
        antibiotic, renalDataAvailable: true, serumCreatinineMgDl: 0, urineOutputMlKgHour: 0,
      }));
      expect(result.renalStatus).toBe("no-renal-impairment-criteria-met");
      expect(v20RenalText(result)).toContain("SCr 0 mg/dL; produksi urin 0 mL/kg/jam");
      expect(v20RenalText(result)).toContain("tidak memenuhi kriteria");
    },
  );

  it("shows absent UOP as unknown, not zero, with its source-specific label", () => {
    const result = calculateRecommendations(patient({
      antibiotic:"gentamisin", renalDataAvailable:true, serumCreatinineMgDl:0.7, urineOutputMlKgHour:undefined,
    }));
    expect(v20RenalText(result)).toBe(
      "SCr 0,7 mg/dL; produksi urin tidak diisi: tidak memenuhi kriteria gangguan ginjal UNC",
    );
  });

  it.each([
    { weight: 1.5, dose: 9, expected: "9 mg (6 mg/kg per pemberian)" },
    { weight: 1.2, dose: 7.5, expected: "7,5 mg (6,25 mg/kg per pemberian)" },
    { weight: 0.3, dose: 0.01, expected: "0,01 mg (0,033 mg/kg per pemberian)" },
    { weight: 1.38, dose: 21, expected: "21 mg (15,217 mg/kg per pemberian)" },
  ])("shows actual dose and mg/kg without changing the evaluation: $dose mg / $weight kg", ({weight,dose,expected}) => {
    const calculated = calculateRecommendations(patient({ antibiotic:"amikasin", currentWeightKg:weight }));
    const evaluation = evaluateRegimen(calculated,{
      actualDoseMg:dose, actualIntervalHours:24,
      manualDoseMinMg:dose,manualDoseMaxMg:dose,
      manualIntervalMinHours:24,manualIntervalMaxHours:24,
    });
    const unchanged = JSON.stringify(evaluation);
    expect(v20ActualDoseText(dose,weight)).toBe(expected);
    const html = renderToStaticMarkup(React.createElement(ActualAdministeredDoseSummary,{calculated,evaluation}));
    expect(html).toContain('aria-label="Ringkasan dosis aktual"');
    expect(html).toContain(expected);
    expect(html).toContain("diberikan tiap 24 jam.");
    expect(JSON.stringify(evaluation)).toBe(unchanged);
  });
});
