import type {
  DirectionComparison,
  IntervalEvaluation,
  IntervalRecommendation,
  ManualRangeEvaluation,
} from "./types";

export const FLOAT_EPSILON = 1e-9;

function approximatelyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= FLOAT_EPSILON;
}

export function compareDirection(
  value: number,
  reference: number,
  unit: string,
): DirectionComparison {
  const difference = value - reference;
  if (approximatelyEqual(value, reference)) {
    return { direction: "sama", difference: 0, message: `Sama dengan ${reference} ${unit}.` };
  }
  const direction = difference < 0 ? "lebih-kecil" : "lebih-besar";
  return {
    direction,
    difference,
    message: `${Math.abs(difference)} ${unit} ${difference < 0 ? "lebih kecil" : "lebih besar"} dari ${reference} ${unit}.`,
  };
}

export function compareRangeToFixed(
  minValue: number,
  maxValue: number,
  reference: number,
  unit: string,
): DirectionComparison {
  if (approximatelyEqual(minValue, reference) && approximatelyEqual(maxValue, reference)) {
    return { direction: "sama", difference: 0, message: `Sama dengan nilai tetap ${reference} ${unit}.` };
  }
  if (maxValue < reference - FLOAT_EPSILON) {
    return {
      direction: "lebih-kecil",
      difference: maxValue - reference,
      message: `Seluruh rentang lebih kecil; batas terdekat ${reference - maxValue} ${unit} di bawah nilai tetap ${reference} ${unit}.`,
    };
  }
  if (minValue > reference + FLOAT_EPSILON) {
    return {
      direction: "lebih-besar",
      difference: minValue - reference,
      message: `Seluruh rentang lebih besar; batas terdekat ${minValue - reference} ${unit} di atas nilai tetap ${reference} ${unit}.`,
    };
  }
  return {
    direction: "mencakup",
    difference: 0,
    message: `Rentang manual mencakup ${reference} ${unit}, tetapi tidak sama persis dengan rekomendasi dosis/interval tetap.`,
  };
}

export function evaluateActualInterval(
  actualHours: number,
  recommendation: IntervalRecommendation,
  eligibleForEvaluation: boolean,
): IntervalEvaluation {
  if (recommendation.kind === "single-dose-only") {
    return {
      status: "tidak-dapat-dievaluasi",
      message:
        "Tidak ada interval rutin untuk dibandingkan. Dosis berikutnya menunggu hasil kadar dan evaluasi klinis.",
    };
  }
  if (!eligibleForEvaluation || recommendation.kind === "continuous-range") {
    return {
      status: "tidak-dapat-dievaluasi",
      message:
        "Informasi interval ini tidak disetujui sebagai rentang kepatuhan kontinu; gunakan pembanding interval spesifik.",
    };
  }
  if (recommendation.kind === "single") {
    if (approximatelyEqual(actualHours, recommendation.hours)) {
      return { status: "sesuai", message: `Sesuai dengan q${recommendation.hours}h.` };
    }
    return actualHours < recommendation.hours
      ? { status: "lebih-pendek", message: "Lebih pendek / lebih sering dari rekomendasi." }
      : { status: "lebih-panjang", message: "Lebih panjang / lebih jarang dari rekomendasi." };
  }
  const allowed = [...recommendation.allowedHours].sort((a, b) => a - b);
  if (allowed.some((hours) => approximatelyEqual(actualHours, hours))) {
    return { status: "sesuai", message: `Sesuai dengan opsi ${allowed.map((hours) => `q${hours}h`).join(" atau ")}.` };
  }
  if (actualHours < allowed[0]) {
    return { status: "lebih-pendek", message: "Lebih pendek / lebih sering dari opsi interval terpendek." };
  }
  if (actualHours > allowed[allowed.length - 1]) {
    return { status: "lebih-panjang", message: "Lebih panjang / lebih jarang dari opsi interval terpanjang." };
  }
  return {
    status: "opsi-diskrit-tidak-cocok",
    message: `Tidak cocok dengan opsi interval diskrit ${allowed.map((hours) => `q${hours}h`).join(" atau ")}.`,
  };
}

export function compareManualIntervalRange(
  minHours: number,
  maxHours: number,
  recommendation: IntervalRecommendation,
  eligibleForEvaluation: boolean,
): ManualRangeEvaluation {
  if (
    !eligibleForEvaluation ||
    recommendation.kind === "single-dose-only" ||
    recommendation.kind === "continuous-range"
  ) {
    return { lowerBound: null, upperBound: null, fixedRecommendation: false };
  }
  const values =
    recommendation.kind === "single"
      ? [recommendation.hours]
      : [...recommendation.allowedHours].sort((a, b) => a - b);
  const lower = values[0];
  const upper = values[values.length - 1];
  if (values.length === 1) {
    return {
      lowerBound: compareRangeToFixed(minHours, maxHours, lower, "jam"),
      upperBound: null,
      fixedRecommendation: true,
    };
  }
  return {
    lowerBound: compareDirection(minHours, lower, "jam"),
    upperBound: values.length === 1 ? null : compareDirection(maxHours, upper, "jam"),
    fixedRecommendation: false,
  };
}
