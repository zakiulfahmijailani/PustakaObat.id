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

function weightValidationMessage(value: number): string {
  const limitMessage = "Berat badan harus 0,3–10 kg.";
  if (finite(value) && value > INPUT_LIMITS.currentWeightKg.max) {
    return `${limitMessage} Tampaknya berat diisi dalam gram; isi dalam kilogram (mis. 1720 g = 1,72 kg).`;
  }
  return limitMessage;
}

function postnatalAgeValidationMessage(value: number): string {
  if (finite(value) && Number.isInteger(value) && value > INPUT_LIMITS.postnatalAgeDays.max) {
    return "Usia pascalahir di luar cakupan kalkulator (0–28 hari). Gunakan pedoman dosis bayi di atas 28 hari.";
  }
  return "Usia pascalahir harus bilangan bulat 0–28 hari.";
}

export function validatePatientInput(input: PatientInput): ValidationResult<PatientInput> {
  const issues: ValidationIssue[] = [];
  if (!ANTIBIOTICS.includes(input.antibiotic)) {
    issues.push({ field: "antibiotic", message: "Pilih antibiotik yang didukung: Gentamisin, Amikasin, atau Vankomisin." });
  }
  if (
    !finite(input.gestationalAgeWeeks) ||
    !Number.isInteger(input.gestationalAgeWeeks) ||
    input.gestationalAgeWeeks < INPUT_LIMITS.gestationalAgeWeeks.min ||
    input.gestationalAgeWeeks > INPUT_LIMITS.gestationalAgeWeeks.max
  ) {
    issues.push({ field: "gestationalAgeWeeks", message: "Usia gestasi saat lahir — minggu harus 22–43 minggu." });
  }
  if (
    input.gestationalAgeDays !== undefined &&
    (!Number.isInteger(input.gestationalAgeDays) ||
      input.gestationalAgeDays < INPUT_LIMITS.gestationalAgeDays.min ||
      input.gestationalAgeDays > INPUT_LIMITS.gestationalAgeDays.max ||
      input.gestationalAgeWeeks + input.gestationalAgeDays / 7 > INPUT_LIMITS.gestationalAgeWeeks.max)
  ) {
    issues.push({ field: "gestationalAgeDays", message: "Usia gestasi saat lahir — tambahan hari harus 0–6 hari dan usia gestasi total maksimal 43 minggu." });
  }
  if (
    !finite(input.postnatalAgeDays) ||
    !Number.isInteger(input.postnatalAgeDays) ||
    input.postnatalAgeDays < INPUT_LIMITS.postnatalAgeDays.min ||
    input.postnatalAgeDays > INPUT_LIMITS.postnatalAgeDays.max
  ) {
    issues.push({ field: "postnatalAgeDays", message: postnatalAgeValidationMessage(input.postnatalAgeDays) });
  }
  if (
    !finite(input.currentWeightKg) ||
    input.currentWeightKg < INPUT_LIMITS.currentWeightKg.min ||
    input.currentWeightKg > INPUT_LIMITS.currentWeightKg.max
  ) {
    issues.push({ field: "currentWeightKg", message: weightValidationMessage(input.currentWeightKg) });
  } else if (Math.abs(input.currentWeightKg * 1000 - Math.round(input.currentWeightKg * 1000)) > 1e-9) {
    issues.push({ field: "currentWeightKg", message: "Berat badan maksimal tiga angka desimal." });
  }
  if (input.patientLabel && input.patientLabel.length > INPUT_LIMITS.patientLabelMaxLength) {
    issues.push({ field: "patientLabel", message: `Kode pasien maksimal ${INPUT_LIMITS.patientLabelMaxLength} karakter.` });
  }
  if (!input.renalDataAvailable) {
    if (input.serumCreatinineMgDl !== undefined || input.urineOutputMlKgHour !== undefined) {
      issues.push({ field: "renalDataAvailable", message: "Data ginjal harus dikosongkan ketika dinyatakan tidak tersedia." });
    }
  } else if (input.serumCreatinineMgDl === undefined) {
    issues.push({ field: "serumCreatinineMgDl", message: "Kreatinin serum wajib diisi ketika data fungsi ginjal tersedia." });
  }
  if (
    input.serumCreatinineMgDl !== undefined &&
    (!finite(input.serumCreatinineMgDl) ||
      input.serumCreatinineMgDl < INPUT_LIMITS.serumCreatinineMgDl.min ||
      input.serumCreatinineMgDl > INPUT_LIMITS.serumCreatinineMgDl.max)
  ) {
    const unitHint = finite(input.serumCreatinineMgDl) && input.serumCreatinineMgDl > 10
      ? " Tampaknya kreatinin diisi dalam µmol/L; bagi dengan 88,4 untuk mendapatkan mg/dL."
      : " Periksa kembali isian.";
    issues.push({ field: "serumCreatinineMgDl", message: "Kreatinin serum di luar rentang 0–10 mg/dL." + unitHint });
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
  positiveNumber(input.manualDoseMinMg, "manualDoseMinMg", "Dosis manual batas bawah (mg)", issues);
  positiveNumber(input.manualDoseMaxMg, "manualDoseMaxMg", "Dosis manual batas atas (mg)", issues);
  positiveNumber(input.actualDoseMg, "actualDoseMg", "Dosis aktual per pemberian (mg)", issues);
  if (intervalsRequired) {
    if (input.manualIntervalMinHours === null) issues.push({ field: "manualIntervalMinHours", message: "Frekuensi manual paling sering (interval dalam jam) wajib diisi." });
    else positiveInteger(input.manualIntervalMinHours, "manualIntervalMinHours", "Frekuensi manual paling sering (interval dalam jam)", issues);
    if (input.manualIntervalMaxHours === null) issues.push({ field: "manualIntervalMaxHours", message: "Frekuensi manual paling jarang (interval dalam jam) wajib diisi." });
    else positiveInteger(input.manualIntervalMaxHours, "manualIntervalMaxHours", "Frekuensi manual paling jarang (interval dalam jam)", issues);
    if (input.actualIntervalHours === null) issues.push({ field: "actualIntervalHours", message: "Frekuensi aktual (interval dalam jam) wajib diisi." });
    else positiveInteger(input.actualIntervalHours, "actualIntervalHours", "Frekuensi aktual (interval dalam jam)", issues);
  }
  if (input.manualDoseMinMg > input.manualDoseMaxMg) {
    issues.push({ field: "manualDoseMaxMg", message: "Dosis manual batas bawah (mg) tidak boleh melebihi batas atas (mg)." });
  }
  if (
    input.manualIntervalMinHours !== null &&
    input.manualIntervalMaxHours !== null &&
    input.manualIntervalMinHours > input.manualIntervalMaxHours
  ) {
    issues.push({ field: "manualIntervalMaxHours", message: "Frekuensi manual paling sering (interval dalam jam) tidak boleh melebihi paling jarang (interval dalam jam)." });
  }
  return issues.length > 0 ? { success: false, issues } : { success: true, data: input };
}
