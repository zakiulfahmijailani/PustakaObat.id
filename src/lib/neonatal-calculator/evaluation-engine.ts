import {
  compareDirection,
  compareRangeToFixed,
  compareManualIntervalRange,
  FLOAT_EPSILON,
  evaluateActualInterval,
} from "./interval-model";
import type {
  ActualRegimenEvaluationResult,
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

export function evaluateActualRegimen(
  calculatorResult: CalculatorResult,
  actualDoseMg: number,
  actualIntervalHours: number | null,
): ActualRegimenEvaluationResult {
  if (!Number.isFinite(actualDoseMg) || actualDoseMg <= 0) {
    throw new Error("Dosis aktual harus lebih dari 0.");
  }
  if (
    actualIntervalHours !== null &&
    (!Number.isInteger(actualIntervalHours) || actualIntervalHours <= 0)
  ) {
    throw new Error("Interval aktual harus bilangan bulat positif.");
  }

  return {
    actualDoseMg,
    actualIntervalHours,
    targets: Object.values(calculatorResult.recommendations).map((recommendation) => ({
      recommendationId: recommendation.id,
      recommendationLabel: recommendation.label,
      actualDose: evaluateDose(actualDoseMg, recommendation),
      actualInterval: evaluateActualInterval(
        actualIntervalHours ?? 0,
        recommendation.interval,
        recommendation.eligibleForRegimenEvaluation,
      ),
    })),
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
  const actual = evaluateActualRegimen(
    calculatorResult,
    validated.data.actualDoseMg,
    validated.data.actualIntervalHours,
  );
  return {
    input: validated.data,
    targets: recommendations.map((recommendation, index) => ({
      recommendationId: recommendation.id,
      recommendationLabel: recommendation.label,
      actualDose: actual.targets[index].actualDose,
      manualDose: compareManualDoseRange(
        validated.data.manualDoseMinMg,
        validated.data.manualDoseMaxMg,
        recommendation,
      ),
      actualInterval: actual.targets[index].actualInterval,
      manualInterval: compareManualIntervalRange(
        validated.data.manualIntervalMinHours ?? 0,
        validated.data.manualIntervalMaxHours ?? 0,
        recommendation.interval,
        recommendation.eligibleForRegimenEvaluation,
      ),
    })),
  };
}
