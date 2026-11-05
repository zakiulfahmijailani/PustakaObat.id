import type { DoseRecommendation, IntervalRecommendation } from "./types";

/** Explanations of existing v20 reference shapes, never a new dosing or comparison rule. */
export type ReferenceShapeNote = {
  label: string;
  description: string;
};

export function describeDoseReference(dose: DoseRecommendation): ReferenceShapeNote {
  if (dose.minTotalMg === null || dose.maxTotalMg === null) {
    return {
      label: "Dosis numerik tidak tersedia",
      description: "Rujukan ini tidak memberikan angka dosis untuk dibandingkan.",
    };
  }
  if (dose.minTotalMg === dose.maxTotalMg) {
    return {
      label: "Nilai dosis tunggal",
      description: "Batas bawah dan batas atas sama; satu nilai dosis menjadi pembanding, bukan suatu rentang.",
    };
  }
  return {
    label: "Rentang dosis",
    description: "Ada batas bawah dan batas atas dosis; keduanya digunakan sebagai batas pembanding dosis aktual.",
  };
}

export function describeIntervalReference(interval: IntervalRecommendation, eligibleForEvaluation = true): ReferenceShapeNote {
  switch (interval.kind) {
    case "single":
      return {
        label: "Nilai interval tunggal",
        description: "Satu interval pemberian dalam jam, bukan suatu rentang.",
      };
    case "continuous-range":
      return eligibleForEvaluation
        ? {
            label: "Rentang interval kontinu",
            description: "Interval di antara batas bawah dan batas atas dibandingkan sebagai rentang kontinu.",
          }
        : {
            label: "Rentang interval informatif",
            description: "Rentang ini hanya informasi rujukan, bukan batas kepatuhan kontinu untuk evaluasi otomatis.",
          };
    case "discrete":
      return {
        label: "Opsi interval terpisah",
        description: "Hanya interval yang tercantum menjadi pilihan; interval di antaranya tidak otomatis termasuk opsi.",
      };
    case "single-dose-only":
      return {
        label: "Dosis tunggal (tanpa interval rutin)",
        description: "Tidak ada jadwal interval rutin untuk dibandingkan; keputusan dosis berikutnya memerlukan evaluasi klinis.",
      };
  }
}
