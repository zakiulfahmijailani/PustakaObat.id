import {
  compareDirection,
  compareRangeToFixed,
  compareManualIntervalRange,
  FLOAT_EPSILON,
  evaluateActualInterval,
} from "./interval-model";
import type {
  CalculatorResult,
  DoseEvaluation,
  ManualRangeEvaluation,
  Recommendation,
  RegimenEvaluationInput,
  RegimenEvaluationResult,
} from "./types";
import { validateRegimenEvaluationInput } from "./validation";

function evaluateDose(actualMg: number, recommendation: Recommendation): DoseEvaluation {
  const { minTotalMg, maxTotalMg } = recommendation.dose;
  if (minTotalMg === null || maxTotalMg === null) {
    return { status: "tidak-dapat-dievaluasi", message: "Tidak ada rekomendasi dosis numerik.", deviationPercent: null };
  }
  if (actualMg < minTotalMg - FLOAT_EPSILON) {
    const deviation = ((minTotalMg - actualMg) / minTotalMg) * 100;
    return { status: "kurang", message: `Kurang ${deviation.toFixed(1)}% dari batas bawah rekomendasi.`, deviationPercent: deviation };
  }
  if (actualMg > maxTotalMg + FLOAT_EPSILON) {
    const deviation = ((actualMg - maxTotalMg) / maxTotalMg) * 100;
    return { status: "berlebih", message: `Berlebih ${deviation.toFixed(1)}% dari batas atas rekomendasi.`, deviationPercent: deviation };
  }
  return { status: "sesuai", message: "Berada di dalam batas rekomendasi inklusif.", deviationPercent: 0 };
}

function compareManualDoseRange(
  minMg: number,
  maxMg: number,
  recommendation: Recommendation,
): ManualRangeEvaluation {
  const { minTotalMg, maxTotalMg } = recommendation.dose;
  if (minTotalMg === null || maxTotalMg === null) {
    return { lowerBound: null, upperBound: null, fixedRecommendation: false };
  }
  const fixed = Math.abs(minTotalMg - maxTotalMg) <= FLOAT_EPSILON;
  if (fixed) {
    return {
      lowerBound: compareRangeToFixed(minMg, maxMg, minTotalMg, "mg"),
      upperBound: null,
      fixedRecommendation: true,
    };
  }
  return {
    lowerBound: compareDirection(minMg, minTotalMg, "mg"),
    upperBound: fixed ? null : compareDirection(maxMg, maxTotalMg, "mg"),
    fixedRecommendation: false,
  };
}

export function evaluateRegimen(
  calculatorResult: CalculatorResult,
  input: RegimenEvaluationInput,
): RegimenEvaluationResult {
  const recommendations = Object.values(calculatorResult.recommendations);
  const intervalsRequired = recommendations.some(
    (recommendation) =>
      recommendation.eligibleForRegimenEvaluation &&
      recommendation.interval.kind !== "single-dose-only" &&
      recommendation.interval.kind !== "continuous-range",
  );
  const validated = validateRegimenEvaluationInput(input, intervalsRequired);
  if (!validated.success) throw new Error(validated.issues.map((issue) => issue.message).join(" "));
  return {
    input: validated.data,
    targets: recommendations.map((recommendation) => ({
      recommendationId: recommendation.id,
      recommendationLabel: recommendation.label,
      actualDose: evaluateDose(validated.data.actualDoseMg, recommendation),
      manualDose: compareManualDoseRange(
        validated.data.manualDoseMinMg,
        validated.data.manualDoseMaxMg,
        recommendation,
      ),
      actualInterval: evaluateActualInterval(
        validated.data.actualIntervalHours ?? 0,
        recommendation.interval,
        recommendation.eligibleForRegimenEvaluation,
      ),
      manualInterval: compareManualIntervalRange(
        validated.data.manualIntervalMinHours ?? 0,
        validated.data.manualIntervalMaxHours ?? 0,
        recommendation.interval,
        recommendation.eligibleForRegimenEvaluation,
      ),
    })),
  };
}
