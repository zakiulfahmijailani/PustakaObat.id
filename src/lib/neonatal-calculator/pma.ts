import type { ClinicalWarning } from "./types";

export function calculatePmaWeeks(
  gestationalAgeWeeks: number,
  postnatalAgeDays: number,
): number {
  return gestationalAgeWeeks + postnatalAgeDays / 7;
}

export function pmaWarnings(pmaWeeks: number): ClinicalWarning[] {
  return pmaWeeks > 50
    ? [
        {
          code: "PMA_OUTSIDE_TYPICAL_NEONATAL_RANGE",
          severity: "critical",
          message:
            "PMA saat ini berada di luar rentang neonatal yang lazim dicakup nomogram. Pertimbangkan pedoman dosis pediatrik, bukan neonatal.",
        },
      ]
    : [];
}
