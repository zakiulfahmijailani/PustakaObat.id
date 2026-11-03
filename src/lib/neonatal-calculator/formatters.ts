import { notebookNumber } from "./python-rounding";
import type { IntervalRecommendation, PatientInput } from "./types";

export function formatNumber(value: number, maximumFractionDigits = 3): string {
  return notebookNumber(value,maximumFractionDigits);
}

export function formatInterval(interval: IntervalRecommendation): string {
  switch (interval.kind) {
    case "single":
      return `tiap ${interval.hours} jam`;
    case "discrete":
      return interval.allowedHours.map((hours) => `tiap ${hours} jam`).join(" atau ");
    case "continuous-range":
      return `tiap ${interval.minHours}-${interval.maxHours} jam`;
    case "single-dose-only":
      return "Dosis tunggal, bukan regimen rutin";
  }
}

export function formatPatientAgeTitle(
  input: Pick<PatientInput, "gestationalAgeWeeks" | "gestationalAgeDays" | "postnatalAgeDays">,
): string {
  const gestationalAgeDays = input.gestationalAgeDays ?? 0;
  const totalPmaDays = input.gestationalAgeWeeks * 7 + gestationalAgeDays + input.postnatalAgeDays;
  const pmaWeeks = Math.floor(totalPmaDays / 7);
  const pmaDays = totalPmaDays % 7;
  return `Usia gestasi lahir ${input.gestationalAgeWeeks} minggu ${gestationalAgeDays} hari · Usia pascalahir ${input.postnatalAgeDays} hari · Usia pascamenstruasi (PMA) ${pmaWeeks} minggu ${pmaDays} hari`;
}
