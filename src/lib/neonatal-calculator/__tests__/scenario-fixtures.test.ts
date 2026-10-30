import { describe, expect, it } from "vitest";
import { calculateRecommendations } from "../recommendation-engine";
import { patient } from "./fixtures";

// Rule IDs: CORE-RESULT-001, GENT-INST-001, GENT-AGE-001, GENT-ANMF-001,
// AMIK-INST-001, AMIK-ANMF-001, VANC-RENAL-001, VANC-ANMF-001.
describe("representative explicit recommendation fixtures", () => {
  it("matches the representative gentamisin object", () => {
    const result = calculateRecommendations(patient());

    expect({
      pmaWeeks: result.pmaWeeks,
      renalStatus: result.renalStatus,
      institutionalPrimary: result.recommendations.institutionalPrimary,
      institutionalAgeInterval: result.recommendations.institutionalAgeComparator.interval,
      anmf: {
        dose: result.recommendations.anmf2024.dose,
        interval: result.recommendations.anmf2024.interval,
      },
    }).toEqual({
      pmaWeeks: 32 + 5 / 7,
      renalStatus: "no-renal-impairment-criteria-met",
      institutionalPrimary: {
        id: "GENT-INST-PRIMARY",
        label: "Pedoman Institusi / RS — Utama",
        provenanceLabel: "SPO RSUP Dr. M. Djamil + PNPK 2021",
        provenanceDetail:
          "SPO Sepsis Neonatal RSUP Dr. M. Djamil Padang (2017) dan PNPK Sepsis pada Anak Kemenkes RI (2021).",
        dose: {
          minMgPerKg: 5,
          maxMgPerKg: 7.5,
          minTotalMg: 7.5,
          maxTotalMg: 11.25,
        },
        interval: { kind: "discrete", allowedHours: [24, 48], label: "q24h atau q48h" },
        notes: [
          "SPO yang digunakan tidak mencantumkan stratifikasi resmi berdasarkan usia gestasi atau usia pascalahir.",
        ],
        warnings: [],
        eligibleForRegimenEvaluation: true,
      },
      institutionalAgeInterval: { kind: "single", hours: 36, label: "q36h" },
      anmf: {
        dose: {
          minMgPerKg: 5,
          maxMgPerKg: 5,
          minTotalMg: 7.5,
          maxTotalMg: 7.5,
        },
        interval: { kind: "single", hours: 36, label: "q36h" },
      },
    });
  });

  it("matches the representative amikasin object", () => {
    const result = calculateRecommendations(
      patient({
        antibiotic: "amikasin",
        gestationalAgeWeeks: 27,
        postnatalAgeDays: 7,
        currentWeightKg: 2,
        renalDataAvailable: false,
        serumCreatinineMgDl: undefined,
        urineOutputMlKgHour: undefined,
      }),
    );

    expect({
      pmaWeeks: result.pmaWeeks,
      renalStatus: result.renalStatus,
      globalWarningCodes: result.globalWarnings.map((warning) => warning.code),
      primaryDose: result.recommendations.institutionalPrimary.dose,
      primaryInterval: result.recommendations.institutionalPrimary.interval,
      ageComparator: {
        dose: result.recommendations.institutionalAgeComparator.dose,
        interval: result.recommendations.institutionalAgeComparator.interval,
      },
      anmf: {
        dose: result.recommendations.anmf2024.dose,
        interval: result.recommendations.anmf2024.interval,
      },
    }).toEqual({
      pmaWeeks: 28,
      renalStatus: "data-unavailable",
      globalWarningCodes: ["RENAL_DATA_UNAVAILABLE"],
      primaryDose: {
        minMgPerKg: 15,
        maxMgPerKg: 15,
        minTotalMg: 30,
        maxTotalMg: 30,
      },
      primaryInterval: { kind: "single", hours: 24, label: "q24h" },
      ageComparator: {
        dose: {
          minMgPerKg: 15,
          maxMgPerKg: 15,
          minTotalMg: 30,
          maxTotalMg: 30,
        },
        interval: { kind: "single", hours: 24, label: "q24h" },
      },
      anmf: {
        dose: {
          minMgPerKg: 14,
          maxMgPerKg: 14,
          minTotalMg: 28,
          maxTotalMg: 28,
        },
        interval: { kind: "single", hours: 48, label: "q48h" },
      },
    });
  });

  it("matches the representative renal vankomisin object", () => {
    const result = calculateRecommendations(
      patient({ antibiotic: "vankomisin", currentWeightKg: 1.8, serumCreatinineMgDl: 1 }),
    );

    expect({
      renalStatus: result.renalStatus,
      primary: {
        dose: result.recommendations.institutionalPrimary.dose,
        interval: result.recommendations.institutionalPrimary.interval,
        eligible: result.recommendations.institutionalPrimary.eligibleForRegimenEvaluation,
        warningCodes: result.recommendations.institutionalPrimary.warnings.map(
          (warning) => warning.code,
        ),
      },
      ageComparator: {
        dose: result.recommendations.institutionalAgeComparator.dose,
        interval: result.recommendations.institutionalAgeComparator.interval,
        eligible: result.recommendations.institutionalAgeComparator.eligibleForRegimenEvaluation,
      },
      anmf: {
        dose: result.recommendations.anmf2024.dose,
        interval: result.recommendations.anmf2024.interval,
        eligible: result.recommendations.anmf2024.eligibleForRegimenEvaluation,
        warningCodes: result.recommendations.anmf2024.warnings.map((warning) => warning.code),
      },
    }).toEqual({
      renalStatus: "renal-impairment-criteria-met",
      primary: {
        dose: {
          minMgPerKg: 10,
          maxMgPerKg: 10,
          minTotalMg: 18,
          maxTotalMg: 18,
        },
        interval: { kind: "single-dose-only", label: "Dosis tunggal, bukan regimen rutin" },
        eligible: false,
        warningCodes: ["VANCOMYCIN_RENAL_SINGLE_DOSE"],
      },
      ageComparator: {
        dose: {
          minMgPerKg: 10,
          maxMgPerKg: 10,
          minTotalMg: 18,
          maxTotalMg: 18,
        },
        interval: { kind: "single-dose-only", label: "Dosis tunggal, bukan regimen rutin" },
        eligible: false,
      },
      anmf: {
        dose: {
          minMgPerKg: 15,
          maxMgPerKg: 15,
          minTotalMg: 27,
          maxTotalMg: 27,
        },
        interval: { kind: "single", hours: 12, label: "q12h" },
        eligible: false,
        warningCodes: ["ANMF_REQUIRES_RENAL_REVIEW"],
      },
    });
  });
});
