import type { DoseRecommendation, IntervalRecommendation, PatientInput } from "./types";

function dose(minMgPerKg: number, maxMgPerKg: number, weightKg: number): DoseRecommendation {
  return {
    minMgPerKg,
    maxMgPerKg,
    minTotalMg: minMgPerKg * weightKg,
    maxTotalMg: maxMgPerKg * weightKg,
  };
}

export function institutionalGentamicinDose(weightKg: number): DoseRecommendation {
  return dose(5, 7.5, weightKg);
}

export function institutionalGentamicinPrimaryInterval(): IntervalRecommendation {
  return { kind: "discrete", allowedHours: [24, 48], label: "q24h atau q48h" };
}

export function institutionalGentamicinAgeInterval(input: PatientInput): IntervalRecommendation {
  let hours: number;
  if (input.gestationalAgeWeeks < 29) {
    hours = input.postnatalAgeDays <= 7 ? 48 : input.postnatalAgeDays <= 28 ? 36 : 24;
  } else if (input.gestationalAgeWeeks < 34) {
    hours = input.postnatalAgeDays <= 7 ? 36 : 24;
  } else {
    hours = 24;
  }
  return { kind: "single", hours, label: `q${hours}h` };
}

export function institutionalAmikacinDose(weightKg: number): DoseRecommendation {
  return dose(15, 15, weightKg);
}

export function institutionalAmikacinInterval(): IntervalRecommendation {
  return { kind: "single", hours: 24, label: "q24h" };
}

export function institutionalVancomycinRoutineDose(weightKg: number): DoseRecommendation {
  return dose(15, 15, weightKg);
}

export function institutionalVancomycinRenalDose(weightKg: number): DoseRecommendation {
  return dose(10, 10, weightKg);
}

export function institutionalVancomycinGeneralCoverage(): IntervalRecommendation {
  return {
    kind: "continuous-range",
    minHours: 8,
    maxHours: 18,
    label: "Informasi cakupan umum q8h–q18h; bukan rentang kepatuhan kontinu",
  };
}

export function institutionalVancomycinAgeInterval(
  pmaWeeks: number,
  postnatalAgeDays: number,
): IntervalRecommendation {
  let hours: number;
  if (pmaWeeks < 29) {
    hours = postnatalAgeDays <= 14 ? 18 : 12;
  } else if (pmaWeeks < 36) {
    hours = postnatalAgeDays <= 14 ? 12 : 8;
  } else if (pmaWeeks < 44) {
    hours = postnatalAgeDays <= 7 ? 12 : 8;
  } else {
    hours = 8;
  }
  return { kind: "single", hours, label: `q${hours}h` };
}

export function singleDoseOnlyInterval(): IntervalRecommendation {
  return { kind: "single-dose-only", label: "Dosis tunggal, bukan regimen rutin" };
}
