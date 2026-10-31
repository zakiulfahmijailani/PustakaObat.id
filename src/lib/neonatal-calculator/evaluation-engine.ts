import { categorizeRange, categoryText, frequencyResult, intervalBounds, manualText } from "./notebook-results";
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
  const result = categorizeRange(actualMg,actualMg,minTotalMg,maxTotalMg);
  return {status: result.category.toLowerCase() as DoseEvaluation["status"], message: categoryText(result), deviationPercent: result.percent === null ? null : Math.abs(result.percent)};
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
      summary: manualText(minMg,maxMg,minTotalMg,maxTotalMg),
    };
  }
  return {
    lowerBound: compareDirection(minMg, minTotalMg, "mg"),
    upperBound: fixed ? null : compareDirection(maxMg, maxTotalMg, "mg"),
    fixedRecommendation: false,
    summary: manualText(minMg,maxMg,minTotalMg,maxTotalMg),
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
      actualInterval: (() => {
        if (actualIntervalHours === null) return {status:"tidak-dapat-dievaluasi" as const,message:"Interval aktual tidak diisi."};
        const [lower,upper] = intervalBounds(recommendation.interval);
        const result = frequencyResult(actualIntervalHours,actualIntervalHours,lower,upper);
        const base = evaluateActualInterval(actualIntervalHours ?? 0,recommendation.interval,recommendation.eligibleForRegimenEvaluation);
        return { ...base, message: result.category ? categoryText(result) : base.message };
      })(),
    })),
  };
}

export function evaluateRegimen(
  calculatorResult: CalculatorResult,
  input: RegimenEvaluationInput,
): RegimenEvaluationResult {
  const recommendations = Object.values(calculatorResult.recommendations);
  const intervalsRequired = calculatorResult.recommendations.institutionalPrimary.interval.kind !== "single-dose-only" && recommendations.some(
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
      manualInterval: {
        ...compareManualIntervalRange(validated.data.manualIntervalMinHours ?? 0,validated.data.manualIntervalMaxHours ?? 0,recommendation.interval,recommendation.eligibleForRegimenEvaluation),
        summary: manualText(validated.data.manualIntervalMinHours,validated.data.manualIntervalMaxHours,...intervalBounds(recommendation.interval),true),
      },
    })),
  };
}
