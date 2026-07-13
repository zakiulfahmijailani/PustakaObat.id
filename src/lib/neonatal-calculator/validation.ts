import { INPUT_LIMITS } from "./constants";
import type {
  Antibiotic,
  PatientInput,
  RegimenEvaluationInput,
  ValidationIssue,
  ValidationResult,
} from "./types";

const ANTIBIOTICS: readonly Antibiotic[] = [
  "gentamisin",
  "amikasin",
  "vankomisin",
];

export function sanitizePatientLabel(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const sanitized = value
    .replace(/[<>\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, INPUT_LIMITS.patientLabelMaxLength);
  return sanitized || undefined;
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

export function validatePatientInput(input: PatientInput): ValidationResult<PatientInput> {
  const issues: ValidationIssue[] = [];
  if (!ANTIBIOTICS.includes(input.antibiotic)) {
    issues.push({ field: "antibiotic", message: "Antibiotik tidak didukung." });
  }
  if (
    !finite(input.gestationalAgeWeeks) ||
    input.gestationalAgeWeeks < INPUT_LIMITS.gestationalAgeWeeks.min ||
    input.gestationalAgeWeeks > INPUT_LIMITS.gestationalAgeWeeks.max
  ) {
    issues.push({ field: "gestationalAgeWeeks", message: "Usia gestasi harus 22–43 minggu." });
  }
  if (
    !finite(input.postnatalAgeDays) ||
    !Number.isInteger(input.postnatalAgeDays) ||
    input.postnatalAgeDays < INPUT_LIMITS.postnatalAgeDays.min ||
    input.postnatalAgeDays > INPUT_LIMITS.postnatalAgeDays.max
  ) {
    issues.push({ field: "postnatalAgeDays", message: "Usia pascalahir harus bilangan bulat 0–365 hari." });
  }
  if (
    !finite(input.currentWeightKg) ||
    input.currentWeightKg <= INPUT_LIMITS.currentWeightKg.exclusiveMin ||
    input.currentWeightKg > INPUT_LIMITS.currentWeightKg.max
  ) {
    issues.push({ field: "currentWeightKg", message: "Berat badan harus >0,3 hingga 10 kg." });
  } else if (Math.abs(input.currentWeightKg * 1000 - Math.round(input.currentWeightKg * 1000)) > 1e-9) {
    issues.push({ field: "currentWeightKg", message: "Berat badan maksimal tiga angka desimal." });
  }
  if (input.patientLabel && input.patientLabel.length > INPUT_LIMITS.patientLabelMaxLength) {
    issues.push({ field: "patientLabel", message: `Label kasus maksimal ${INPUT_LIMITS.patientLabelMaxLength} karakter.` });
  }
  if (!input.renalDataAvailable) {
    if (input.serumCreatinineMgDl !== undefined || input.urineOutputMlKgHour !== undefined) {
      issues.push({ field: "renalDataAvailable", message: "Data ginjal harus dikosongkan ketika dinyatakan tidak tersedia." });
    }
  } else if (input.serumCreatinineMgDl === undefined) {
    issues.push({ field: "serumCreatinineMgDl", message: "SCr wajib diisi ketika data fungsi ginjal tersedia." });
  }
  if (
    input.serumCreatinineMgDl !== undefined &&
    (!finite(input.serumCreatinineMgDl) ||
      input.serumCreatinineMgDl < INPUT_LIMITS.serumCreatinineMgDl.min ||
      input.serumCreatinineMgDl > INPUT_LIMITS.serumCreatinineMgDl.max)
  ) {
    issues.push({ field: "serumCreatinineMgDl", message: "SCr harus 0–10 mg/dL." });
  }
  if (
    input.urineOutputMlKgHour !== undefined &&
    (!finite(input.urineOutputMlKgHour) ||
      input.urineOutputMlKgHour < INPUT_LIMITS.urineOutputMlKgHour.min ||
      input.urineOutputMlKgHour > INPUT_LIMITS.urineOutputMlKgHour.max)
  ) {
    issues.push({ field: "urineOutputMlKgHour", message: "Produksi urin harus 0–10 mL/kg/jam." });
  }
  if (issues.length > 0) return { success: false, issues };
  return {
    success: true,
    data: { ...input, patientLabel: sanitizePatientLabel(input.patientLabel) },
  };
}

function positiveNumber(value: number, field: string, label: string, issues: ValidationIssue[]): void {
  if (!finite(value) || value <= 0) issues.push({ field, message: `${label} harus lebih dari 0.` });
}

function positiveInteger(value: number, field: string, label: string, issues: ValidationIssue[]): void {
  if (!finite(value) || !Number.isInteger(value) || value <= 0) {
    issues.push({ field, message: `${label} harus bilangan bulat positif.` });
  }
}

export function validateRegimenEvaluationInput(
  input: RegimenEvaluationInput,
  intervalsRequired = true,
): ValidationResult<RegimenEvaluationInput> {
  const issues: ValidationIssue[] = [];
  positiveNumber(input.manualDoseMinMg, "manualDoseMinMg", "Dosis manual minimum", issues);
  positiveNumber(input.manualDoseMaxMg, "manualDoseMaxMg", "Dosis manual maksimum", issues);
  positiveNumber(input.actualDoseMg, "actualDoseMg", "Dosis aktual", issues);
  if (intervalsRequired) {
    if (input.manualIntervalMinHours === null) issues.push({ field: "manualIntervalMinHours", message: "Interval manual minimum wajib diisi." });
    else positiveInteger(input.manualIntervalMinHours, "manualIntervalMinHours", "Interval manual minimum", issues);
    if (input.manualIntervalMaxHours === null) issues.push({ field: "manualIntervalMaxHours", message: "Interval manual maksimum wajib diisi." });
    else positiveInteger(input.manualIntervalMaxHours, "manualIntervalMaxHours", "Interval manual maksimum", issues);
    if (input.actualIntervalHours === null) issues.push({ field: "actualIntervalHours", message: "Interval aktual wajib diisi." });
    else positiveInteger(input.actualIntervalHours, "actualIntervalHours", "Interval aktual", issues);
  }
  if (input.manualDoseMinMg > input.manualDoseMaxMg) {
    issues.push({ field: "manualDoseMaxMg", message: "Dosis manual minimum tidak boleh melebihi maksimum." });
  }
  if (
    input.manualIntervalMinHours !== null &&
    input.manualIntervalMaxHours !== null &&
    input.manualIntervalMinHours > input.manualIntervalMaxHours
  ) {
    issues.push({ field: "manualIntervalMaxHours", message: "Interval manual minimum tidak boleh melebihi maksimum." });
  }
  return issues.length > 0 ? { success: false, issues } : { success: true, data: input };
}
