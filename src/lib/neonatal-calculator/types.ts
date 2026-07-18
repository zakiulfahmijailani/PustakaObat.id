export type Antibiotic = "gentamisin" | "amikasin" | "vankomisin";

export type PatientInput = {
  patientLabel?: string;
  antibiotic: Antibiotic;
  gestationalAgeWeeks: number;
  postnatalAgeDays: number;
  currentWeightKg: number;
  renalDataAvailable: boolean;
  serumCreatinineMgDl?: number;
  urineOutputMlKgHour?: number;
  therapeuticHypothermia: boolean;
  coxInhibitorTherapy: boolean;
  severeSepsisOrHighRiskInfection: boolean;
};

export type IntervalRecommendation =
  | { kind: "single"; hours: number; label: string }
  | { kind: "discrete"; allowedHours: readonly number[]; label: string }
  | {
      kind: "continuous-range";
      minHours: number;
      maxHours: number;
      label: string;
    }
  | { kind: "single-dose-only"; label: string };

export type DoseRecommendation = {
  minMgPerKg: number | null;
  maxMgPerKg: number | null;
  minTotalMg: number | null;
  maxTotalMg: number | null;
};

export type ClinicalWarning = {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
};

export type Recommendation = {
  id: string;
  label: string;
  provenanceLabel: string;
  provenanceDetail: string;
  dose: DoseRecommendation;
  interval: IntervalRecommendation;
  notes: string[];
  warnings: ClinicalWarning[];
  eligibleForRegimenEvaluation: boolean;
};

export type RenalStatus =
  | "data-unavailable"
  | "no-renal-impairment-criteria-met"
  | "renal-impairment-criteria-met";

export type CalculatorResult = {
  input: PatientInput;
  pmaWeeks: number;
  renalStatus: RenalStatus;
  recommendations: {
    institutionalPrimary: Recommendation;
    institutionalAgeComparator: Recommendation;
    anmf2024: Recommendation;
  };
  globalWarnings: ClinicalWarning[];
  qualitativeReferenceNotes: string[];
  calculatorRuleVersion: string;
};

export type ValidationIssue = {
  field: string;
  message: string;
};

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: ValidationIssue[] };

export type RegimenEvaluationInput = {
  manualDoseMinMg: number;
  manualDoseMaxMg: number;
  manualIntervalMinHours: number | null;
  manualIntervalMaxHours: number | null;
  actualDoseMg: number;
  actualIntervalHours: number | null;
};

export type DoseEvaluation = {
  status: "sesuai" | "kurang" | "berlebih" | "tidak-dapat-dievaluasi";
  message: string;
  deviationPercent: number | null;
};

export type DirectionComparison = {
  direction: "sama" | "lebih-kecil" | "lebih-besar" | "mencakup";
  difference: number;
  message: string;
};

export type ManualRangeEvaluation = {
  lowerBound: DirectionComparison | null;
  upperBound: DirectionComparison | null;
  fixedRecommendation: boolean;
};

export type IntervalEvaluation = {
  status:
    | "sesuai"
    | "lebih-pendek"
    | "lebih-panjang"
    | "opsi-diskrit-tidak-cocok"
    | "tidak-dapat-dievaluasi";
  message: string;
};

export type RecommendationEvaluation = {
  recommendationId: string;
  recommendationLabel: string;
  actualDose: DoseEvaluation;
  manualDose: ManualRangeEvaluation;
  actualInterval: IntervalEvaluation;
  manualInterval: ManualRangeEvaluation;
};

export type ActualRecommendationEvaluation = Pick<
  RecommendationEvaluation,
  "recommendationId" | "recommendationLabel" | "actualDose" | "actualInterval"
>;

export type ActualRegimenEvaluationResult = {
  actualDoseMg: number;
  actualIntervalHours: number | null;
  targets: ActualRecommendationEvaluation[];
};

export type RegimenEvaluationResult = {
  input: RegimenEvaluationInput;
  targets: RecommendationEvaluation[];
};
