import { anmfAmikacin, anmfGentamicin, anmfVancomycin } from "./anmf-guidelines";
import {
  CALCULATOR_RULE_VERSION,
  QUALITATIVE_REFERENCE_NOTES,
} from "./constants";
import {
  institutionalAmikacinDose,
  institutionalAmikacinInterval,
  institutionalGentamicinAgeInterval,
  institutionalGentamicinDose,
  institutionalGentamicinPrimaryInterval,
  institutionalVancomycinAgeInterval,
  institutionalVancomycinRoutineInterval,
  institutionalVancomycinRenalDose,
  institutionalVancomycinRoutineDose,
  singleDoseOnlyInterval,
} from "./institutional-guidelines";
import { calculatePmaWeeks, pmaWarnings } from "./pma";
import {
  determineVancomycinRenalStatus,
  hasAminoglycosideRenalSafetySignal,
} from "./renal";
import type {
  CalculatorResult,
  ClinicalWarning,
  PatientInput,
  Recommendation,
} from "./types";
import { validatePatientInput } from "./validation";

const LOCAL_PROVENANCE =
  "SPO Sepsis Neonatal RSUP Dr. M. Djamil Padang (2017) dan PNPK Sepsis pada Anak Kemenkes RI (2021).";
const UNC_PROVENANCE =
  "UNC Medical Center Vancomycin Dosing & Monitoring Guide: Neonatal & Pediatric (2023); digunakan karena SPO lokal yang dirujuk tidak memuat regimen vankomisin.";
const ANMF_PROVENANCE = "Australasian Neonatal Medicines Formulary (ANMF), monograf 2024 yang dirujuk notebook.";

function missingRenalWarning(input?: PatientInput): ClinicalWarning {
  const isHighRisk =
    input &&
    (input.gestationalAgeWeeks < 29 ||
      input.currentWeightKg < 1.5 ||
      input.therapeuticHypothermia ||
      input.coxInhibitorTherapy ||
      input.antibiotic === "vankomisin");
  return {
    code: isHighRisk ? "RENAL_DATA_UNAVAILABLE_HIGH_RISK" : "RENAL_DATA_UNAVAILABLE",
    severity: isHighRisk ? "critical" : "warning",
    message: isHighRisk
      ? "Kreatinin serum dan produksi urin tidak diisi pada pasien berisiko tinggi. Asumsi fungsi ginjal normal mungkin tidak tepat; periksa kreatinin serum sesegera mungkin dan sebelum dosis ke-2."
      : "Kreatinin serum dan produksi urin tidak diisi. Hasil dihitung dengan ASUMSI fungsi ginjal normal sesuai usia; periksa kreatinin serum sebelum dosis ke-2.",
  };
}

function missingUrineOutputWarning(): ClinicalWarning {
  return {
    code: "RENAL_URINE_OUTPUT_UNAVAILABLE",
    severity: "info",
    message:
      "Data produksi urin tidak tersedia. Kriteria kombinasi SCr/UOP tidak dapat dinilai sepenuhnya; jangan menafsirkan hasil ini sebagai fungsi ginjal normal.",
  };
}

function aminoglycosideRenalWarning(antibiotic: "gentamisin" | "amikasin"): ClinicalWarning {
  return {
    code: `AMINOGLYCOSIDE_RENAL_REVIEW_${antibiotic.toUpperCase()}`,
    severity: "critical",
    message:
      antibiotic === "gentamisin"
        ? "Terdapat sinyal perlunya evaluasi fungsi ginjal. Kalkulator tidak melakukan penyesuaian otomatis gentamisin. Pertimbangkan perpanjangan interval, TDM/trough, dan konsultasi apoteker klinis/DPJP."
        : "Terdapat sinyal perlunya evaluasi fungsi ginjal. Kalkulator tidak melakukan penyesuaian ginjal otomatis untuk amikasin. Pertimbangkan evaluasi interval, TDM/trough, dan konsultasi klinis.",
  };
}

function createGentamicinRecommendations(input: PatientInput, pmaWeeks: number) {
  const warnings = hasAminoglycosideRenalSafetySignal(input)
    ? [aminoglycosideRenalWarning("gentamisin")]
    : [];
  const anmf = anmfGentamicin(input, pmaWeeks);
  return {
    institutionalPrimary: {
      id: "GENT-INST-PRIMARY",
      label: "Pedoman Institusi / RS — Utama",
      provenanceLabel: "SPO RSUP Dr. M. Djamil + PNPK 2021",
      provenanceDetail: LOCAL_PROVENANCE,
      dose: institutionalGentamicinDose(input.currentWeightKg),
      interval: institutionalGentamicinPrimaryInterval(),
      notes: ["SPO yang digunakan tidak mencantumkan stratifikasi resmi berdasarkan usia gestasi atau usia pascalahir."],
      warnings,
      eligibleForRegimenEvaluation: true,
    },
    institutionalAgeComparator: {
      id: "GENT-INST-AGE-COMPARATOR",
      label: "Pembanding usia GA/PNA — bukan stratifikasi resmi SPO",
      provenanceLabel: "Pembanding usia dari logika notebook",
      provenanceDetail: "Nomogram pembanding usia pada notebook; bukan tabel resmi dalam SPO RS yang dirujuk.",
      dose: institutionalGentamicinDose(input.currentWeightKg),
      interval: institutionalGentamicinAgeInterval(input),
      notes: ["Gunakan sebagai pembanding terpisah; jangan menyebutnya stratifikasi resmi SPO RS."],
      warnings,
      eligibleForRegimenEvaluation: true,
    },
    anmf2024: {
      id: "GENT-ANMF-2024",
      label: "ANMF 2024",
      provenanceLabel: "ANMF Gentamicin v4.0 (24 April 2024)",
      provenanceDetail: ANMF_PROVENANCE,
      dose: anmf.dose,
      interval: anmf.interval,
      notes: anmf.notes,
      warnings,
      eligibleForRegimenEvaluation: true,
    },
  } satisfies CalculatorResult["recommendations"];
}

function createAmikacinRecommendations(input: PatientInput, pmaWeeks: number) {
  const warnings = hasAminoglycosideRenalSafetySignal(input)
    ? [aminoglycosideRenalWarning("amikasin")]
    : [];
  const anmf = anmfAmikacin(input, pmaWeeks);
  const dose = institutionalAmikacinDose(input.currentWeightKg);
  const interval = institutionalAmikacinInterval();
  return {
    institutionalPrimary: {
      id: "AMIK-INST-PRIMARY",
      label: "Pedoman Institusi / RS — Utama",
      provenanceLabel: "SPO RSUP Dr. M. Djamil + PNPK 2021",
      provenanceDetail: LOCAL_PROVENANCE,
      dose,
      interval,
      notes: ["SPO yang dirujuk menetapkan 15 mg/kg q24h tanpa stratifikasi resmi GA/PNA."],
      warnings,
      eligibleForRegimenEvaluation: true,
    },
    institutionalAgeComparator: {
      id: "AMIK-INST-AGE-COMPARATOR",
      label: "Pembanding usia GA/PNA — bukan stratifikasi resmi SPO",
      provenanceLabel: "Tidak berbeda dari pedoman utama",
      provenanceDetail: LOCAL_PROVENANCE,
      dose,
      interval,
      notes: ["Tidak berbeda karena sumber institusi yang dirujuk tidak menyediakan penyesuaian spesifik usia."],
      warnings,
      eligibleForRegimenEvaluation: true,
    },
    anmf2024: {
      id: "AMIK-ANMF-2024",
      label: "ANMF 2024",
      provenanceLabel: "ANMF Amikacin v3.0 (2 Mei 2024)",
      provenanceDetail: ANMF_PROVENANCE,
      dose: anmf.dose,
      interval: anmf.interval,
      notes: anmf.notes,
      warnings,
      eligibleForRegimenEvaluation: true,
    },
  } satisfies CalculatorResult["recommendations"];
}

function renalVancomycinRecommendation(
  id: string,
  label: string,
  input: PatientInput,
  notes: string[] = [],
): Recommendation {
  return {
    id,
    label,
    provenanceLabel: "UNC Medical Center 2023",
    provenanceDetail: UNC_PROVENANCE,
    dose: institutionalVancomycinRenalDose(input.currentWeightKg),
    interval: singleDoseOnlyInterval(),
    notes,
    warnings: [
      {
        code: "VANCOMYCIN_RENAL_SINGLE_DOSE",
        severity: "critical",
        message:
          "Pasien memenuhi kriteria gangguan ginjal. Berikan dosis tunggal 10 mg/kg, periksa kadar 12–24 jam pascainfus (dapat lebih awal bila indikasi klinis mendesak), dan tahan dosis berikutnya hingga hasil kadar tersedia. Penyesuaian lanjutan harus berdasarkan kadar dan evaluasi klinis.",
      },
    ],
    eligibleForRegimenEvaluation: false,
  };
}

function createVancomycinRecommendations(
  input: PatientInput,
  pmaWeeks: number,
  renalStatus: CalculatorResult["renalStatus"],
) {
  const anmf = anmfVancomycin(input, pmaWeeks);
  const anmfWarnings: ClinicalWarning[] =
    renalStatus === "renal-impairment-criteria-met"
      ? [{ code: "ANMF_REQUIRES_RENAL_REVIEW", severity: "critical", message: "Kriteria ginjal terpenuhi; regimen ANMF rutin tidak boleh diterapkan tanpa evaluasi kadar dan klinis." }]
      : [];
  if (renalStatus === "renal-impairment-criteria-met") {
    return {
      institutionalPrimary: renalVancomycinRecommendation(
        "VANC-INST-RENAL",
        "Pedoman Institusi / RS — Utama",
        input,
      ),
      institutionalAgeComparator: renalVancomycinRecommendation(
        "VANC-INST-AGE-RENAL",
        "Pembanding usia GA/PNA — bukan stratifikasi resmi SPO",
        input,
        ["Pembanding interval usia ditangguhkan karena kriteria gangguan ginjal terpenuhi."],
      ),
      anmf2024: {
        id: "VANC-ANMF-2024",
        label: "ANMF 2024",
        provenanceLabel: "ANMF Vancomycin Intermittent v3.0 (errata 21 November 2024)",
        provenanceDetail: ANMF_PROVENANCE,
        dose: anmf.dose,
        interval: anmf.interval,
        notes: anmf.notes,
        warnings: anmfWarnings,
        eligibleForRegimenEvaluation: false,
      },
    } satisfies CalculatorResult["recommendations"];
  }
  return {
    institutionalPrimary: {
      id: "VANC-INST-PRIMARY",
      label: "Pedoman Institusi / RS — Utama",
      provenanceLabel: "UNC Medical Center 2023",
      provenanceDetail: UNC_PROVENANCE,
      dose: institutionalVancomycinRoutineDose(input.currentWeightKg),
      interval: institutionalVancomycinRoutineInterval(input.postnatalAgeDays),
      notes: [
        "Dosis 10–15 mg/kg/dosis; interval tiap 12 jam (usia pascalahir 0–14 hari) atau tiap 8 jam (15–28 hari) sesuai UNC 2023.",
        "Target trough 10–20 mg/L; 8–12 mg/L bila indikasi febrile neutropenia.",
      ],
      warnings: [],
      eligibleForRegimenEvaluation: true,
    },
    institutionalAgeComparator: {
      id: "VANC-INST-AGE-COMPARATOR",
      label: "Pembanding usia GA/PNA — bukan stratifikasi resmi SPO",
      provenanceLabel: "UNC Medical Center 2023 — nomogram PMA/PNA",
      provenanceDetail: UNC_PROVENANCE,
      dose: institutionalVancomycinRoutineDose(input.currentWeightKg),
      interval: institutionalVancomycinAgeInterval(pmaWeeks, input.postnatalAgeDays),
      notes: ["Target trough 10–20 mg/L; 8–12 mg/L bila indikasi febrile neutropenia."],
      warnings: [],
      eligibleForRegimenEvaluation: true,
    },
    anmf2024: {
      id: "VANC-ANMF-2024",
      label: "ANMF 2024",
      provenanceLabel: "ANMF Vancomycin Intermittent v3.0 (errata 21 November 2024)",
      provenanceDetail: ANMF_PROVENANCE,
      dose: anmf.dose,
      interval: anmf.interval,
      notes: anmf.notes,
      warnings: anmfWarnings,
      eligibleForRegimenEvaluation: true,
    },
  } satisfies CalculatorResult["recommendations"];
}

export function calculateRecommendations(input: PatientInput): CalculatorResult {
  const validated = validatePatientInput(input);
  if (!validated.success) {
    throw new Error(validated.issues.map((issue) => issue.message).join(" "));
  }
  const safeInput = validated.data;
  const pmaWeeks = calculatePmaWeeks(
    safeInput.gestationalAgeWeeks,
    safeInput.postnatalAgeDays,
    safeInput.gestationalAgeDays,
  );
  const renalStatus = determineVancomycinRenalStatus(safeInput);
  const globalWarnings = pmaWarnings(pmaWeeks);
  if (renalStatus === "data-unavailable") globalWarnings.push(missingRenalWarning(safeInput));
  if (
    safeInput.renalDataAvailable &&
    safeInput.urineOutputMlKgHour === undefined &&
    renalStatus === "no-renal-impairment-criteria-met"
  ) {
    globalWarnings.push(missingUrineOutputWarning());
  }
  const recommendations =
    safeInput.antibiotic === "gentamisin"
      ? createGentamicinRecommendations(safeInput, pmaWeeks)
      : safeInput.antibiotic === "amikasin"
        ? createAmikacinRecommendations(safeInput, pmaWeeks)
        : createVancomycinRecommendations(safeInput, pmaWeeks, renalStatus);
  return {
    input: safeInput,
    pmaWeeks,
    renalStatus,
    recommendations,
    globalWarnings,
    qualitativeReferenceNotes: [...QUALITATIVE_REFERENCE_NOTES[safeInput.antibiotic]],
    calculatorRuleVersion: CALCULATOR_RULE_VERSION,
  };
}
