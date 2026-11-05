import { calculateRecommendations } from "./recommendation-engine";
import { evaluateActualRegimen, evaluateRegimen } from "./evaluation-engine";
import { validatePatientInput, validateRegimenEvaluationInput } from "./validation";
import type {
  ActualRegimenEvaluationResult,
  Antibiotic,
  CalculatorResult,
  PatientInput,
  RegimenEvaluationInput,
  RegimenEvaluationResult,
} from "./types";

export const BATCH_SHEET_NAME = "Data Pasien";
export const BATCH_MAX_ROWS = 1_000;

export const BATCH_COLUMNS = [
  "kode_pasien",
  "antibiotik",
  "usia_gestasi_lahir_minggu",
  "usia_gestasi_lahir_hari",
  "usia_pascalahir_hari",
  "berat_badan_kg",
  "kreatinin_serum_mg_dl",
  "produksi_urin_ml_kg_jam",
  "hipotermia_terapeutik",
  "terapi_cox_inhibitor",
  "sepsis_berat",
  "dosis_manual_min_mg",
  "dosis_manual_max_mg",
  "frekuensi_manual_min_jam",
  "frekuensi_manual_max_jam",
  "dosis_aktual_mg",
  "frekuensi_aktual_jam",
] as const;

export type BatchColumn = (typeof BATCH_COLUMNS)[number];

export const BATCH_COLUMN_LABELS: Record<BatchColumn, string> = {
  kode_pasien: "Kode pasien",
  antibiotik: "Antibiotik",
  usia_gestasi_lahir_minggu: "Usia gestasi saat lahir — minggu",
  usia_gestasi_lahir_hari: "Usia gestasi saat lahir — tambahan hari",
  usia_pascalahir_hari: "Usia pascalahir (hari)",
  berat_badan_kg: "Berat badan saat ini (kg)",
  kreatinin_serum_mg_dl: "Kreatinin serum (mg/dL)",
  produksi_urin_ml_kg_jam: "Produksi urin (mL/kg/jam)",
  hipotermia_terapeutik: "Hipotermia terapeutik",
  terapi_cox_inhibitor: "Terapi indometasin/ibuprofen",
  sepsis_berat: "Dugaan sepsis berat (khusus vankomisin)",
  dosis_manual_min_mg: "Dosis manual batas bawah (mg)",
  dosis_manual_max_mg: "Dosis manual batas atas (mg)",
  frekuensi_manual_min_jam: "Frekuensi manual paling sering (interval dalam jam)",
  frekuensi_manual_max_jam: "Frekuensi manual paling jarang (interval dalam jam)",
  dosis_aktual_mg: "Dosis aktual per pemberian (mg)",
  frekuensi_aktual_jam: "Frekuensi aktual (interval dalam jam)",
} as const;

export type BatchManualInput = Omit<RegimenEvaluationInput, "actualDoseMg" | "actualIntervalHours">;

export type BatchSuccessRow = {
  status: "berhasil";
  sourceRow: number;
  patientCode: string;
  calculator: CalculatorResult;
  actualEvaluation: ActualRegimenEvaluationResult | null;
  manualInput?: BatchManualInput | null;
  manualEvaluation: RegimenEvaluationResult | null;
  warnings: string[];
};

export type BatchErrorRow = {
  status: "gagal";
  sourceRow: number;
  patientCode: string;
  errors: string[];
};

export type BatchResultRow = BatchSuccessRow | BatchErrorRow;

export type BatchProcessingResult = {
  rows: BatchResultRow[];
  ignoredRows: number;
  candidateRows: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
};

function textValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeHeader(value: unknown): string {
  return textValue(value).toLowerCase().replace(/\s+/g, "_");
}

function isBlank(value: unknown): boolean {
  return textValue(value) === "";
}

function parseNumber(
  value: unknown,
  label: string,
  errors: string[],
  required: boolean,
): number | null {
  if (isBlank(value)) {
    if (required) errors.push(`${label} wajib diisi.`);
    return null;
  }
  const raw = typeof value === "string" ? value.trim().replace(",", ".") : value;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed)) {
    errors.push(`${label} harus berupa angka.`);
    return null;
  }
  return parsed;
}

function parseBoolean(value: unknown, label: string, errors: string[]): boolean {
  if (isBlank(value)) return false;
  const normalized = textValue(value).toLowerCase();
  if (["ya", "yes", "true", "1"].includes(normalized)) return true;
  if (["tidak", "no", "false", "0"].includes(normalized)) return false;
  errors.push(`${label} harus Ya atau Tidak.`);
  return false;
}

function parseAntibiotic(value: unknown, errors: string[]): Antibiotic | null {
  const normalized = textValue(value).toLowerCase();
  if (["gentamisin", "amikasin", "vankomisin"].includes(normalized)) {
    return normalized as Antibiotic;
  }
  errors.push("Antibiotik harus Gentamisin, Amikasin, atau Vankomisin.");
  return null;
}

function getRecord(
  row: readonly unknown[],
  headerIndex: ReadonlyMap<BatchColumn, number>,
): Record<BatchColumn, unknown> {
  return Object.fromEntries(
    BATCH_COLUMNS.map((column) => [column, row[headerIndex.get(column) ?? -1]]),
  ) as Record<BatchColumn, unknown>;
}

function parseManualEvaluation(
  record: Record<BatchColumn, unknown>,
  errors: string[],
  incompleteErrors: string[],
): BatchManualInput | null {
  const manualColumns = [
    "dosis_manual_min_mg",
    "dosis_manual_max_mg",
    "frekuensi_manual_min_jam",
    "frekuensi_manual_max_jam",
  ] as const;
  const anyManual = manualColumns.some((column) => !isBlank(record[column]));
  if (!anyManual) return null;
  if (manualColumns.some((column) => isBlank(record[column]))) {
    incompleteErrors.push(
      "Hitung manual harus diisi lengkap (dosis batas bawah dan atas, frekuensi paling sering dan paling jarang) atau dikosongkan semua.",
    );
    return null;
  }

  const manualDoseMinMg = parseNumber(record.dosis_manual_min_mg, BATCH_COLUMN_LABELS.dosis_manual_min_mg, errors, true);
  const manualDoseMaxMg = parseNumber(record.dosis_manual_max_mg, BATCH_COLUMN_LABELS.dosis_manual_max_mg, errors, true);
  const manualIntervalMinHours = parseNumber(record.frekuensi_manual_min_jam, BATCH_COLUMN_LABELS.frekuensi_manual_min_jam, incompleteErrors, true);
  const manualIntervalMaxHours = parseNumber(record.frekuensi_manual_max_jam, BATCH_COLUMN_LABELS.frekuensi_manual_max_jam, incompleteErrors, true);
  if (manualIntervalMinHours !== null && manualIntervalMaxHours !== null &&
      (!Number.isInteger(manualIntervalMinHours) || !Number.isInteger(manualIntervalMaxHours) ||
       manualIntervalMinHours < 1 || manualIntervalMaxHours > 96 || manualIntervalMinHours > manualIntervalMaxHours)) {
    incompleteErrors.push("Frekuensi hitung manual harus bilangan bulat 1–96 jam, dan paling sering tidak boleh lebih besar dari paling jarang.");
  }
  if (
    manualDoseMinMg === null ||
    manualDoseMaxMg === null ||
    manualIntervalMinHours === null ||
    manualIntervalMaxHours === null
  ) {
    return null;
  }

  return {
    manualDoseMinMg,
    manualDoseMaxMg,
    manualIntervalMinHours,
    manualIntervalMaxHours,
  };
}

export function processBatchTable(table: readonly (readonly unknown[])[]): BatchProcessingResult {
  if (table.length === 0) throw new Error("Sheet 'Data Pasien' kosong.");
  const headers = table[0].map(normalizeHeader);
  const headerIndex = new Map<BatchColumn, number>();
  for (const column of BATCH_COLUMNS) {
    const index = headers.indexOf(column);
    if (column === "usia_gestasi_lahir_hari" && index === -1) continue;
    if (index === -1) throw new Error(`Kolom wajib '${column}' (${BATCH_COLUMN_LABELS[column]}) tidak ditemukan.`);
    headerIndex.set(column, index);
  }

  const nonEmptyRows = table.slice(1).filter((row) => row.some((value) => !isBlank(value)));
  if (nonEmptyRows.length > BATCH_MAX_ROWS) {
    throw new Error(`Maksimal ${BATCH_MAX_ROWS} baris data per file.`);
  }

  const results: BatchResultRow[] = [];
  const seenCodes = new Set<string>();
  let ignoredRows = 0;

  table.slice(1).forEach((row, index) => {
    const sourceRow = index + 2;
    if (row.every(isBlank)) return;
    const record = getRecord(row, headerIndex);
    const patientCode = textValue(record.kode_pasien);
    if (patientCode.toUpperCase().startsWith("CONTOH")) {
      ignoredRows += 1;
      return;
    }

    const errors: string[] = [];
    if (!patientCode) errors.push("Kode pasien wajib diisi.");
    if (patientCode.length > 60) errors.push("Kode pasien maksimal 60 karakter.");
    if (patientCode && seenCodes.has(patientCode.toLowerCase())) {
      errors.push("Kode pasien duplikat di dalam file.");
    }
    if (patientCode) seenCodes.add(patientCode.toLowerCase());

    const antibiotic = parseAntibiotic(record.antibiotik, errors);
    const gestationalAgeWeeks = parseNumber(
      record.usia_gestasi_lahir_minggu,
      BATCH_COLUMN_LABELS.usia_gestasi_lahir_minggu,
      errors,
      true,
    );
    const gestationalAgeDays = parseNumber(record.usia_gestasi_lahir_hari, BATCH_COLUMN_LABELS.usia_gestasi_lahir_hari, errors, false);
    const postnatalAgeDays = parseNumber(
      record.usia_pascalahir_hari,
      BATCH_COLUMN_LABELS.usia_pascalahir_hari,
      errors,
      true,
    );
    const currentWeightKg = parseNumber(record.berat_badan_kg, BATCH_COLUMN_LABELS.berat_badan_kg, errors, true);
    const serumCreatinineMgDl = parseNumber(
      record.kreatinin_serum_mg_dl,
      BATCH_COLUMN_LABELS.kreatinin_serum_mg_dl,
      errors,
      false,
    );
    const urineOutputMlKgHour = parseNumber(
      record.produksi_urin_ml_kg_jam,
      BATCH_COLUMN_LABELS.produksi_urin_ml_kg_jam,
      errors,
      false,
    );
    if (urineOutputMlKgHour !== null && serumCreatinineMgDl === null) {
      errors.push("Kreatinin serum wajib diisi jika produksi urin dicantumkan.");
    }
    const doseBlank = isBlank(record.dosis_aktual_mg);
    const frequencyBlank = isBlank(record.frekuensi_aktual_jam);
    const partiallyFilled = doseBlank !== frequencyBlank;
    if (partiallyFilled) errors.push("Dosis aktual dan frekuensi aktual harus diisi bersama.");
    const actualDoseMg = parseNumber(record.dosis_aktual_mg, BATCH_COLUMN_LABELS.dosis_aktual_mg, errors, false);
    const actualIntervalHours = parseNumber(
      record.frekuensi_aktual_jam,
      BATCH_COLUMN_LABELS.frekuensi_aktual_jam,
      errors,
      false,
    );

    const patient: PatientInput | null =
      antibiotic === null ||
      gestationalAgeWeeks === null ||
      postnatalAgeDays === null ||
      currentWeightKg === null
        ? null
        : {
            patientLabel: patientCode,
            antibiotic,
            gestationalAgeWeeks,
            gestationalAgeDays: gestationalAgeDays ?? 0,
            postnatalAgeDays,
            currentWeightKg,
            renalDataAvailable: serumCreatinineMgDl !== null,
            serumCreatinineMgDl: serumCreatinineMgDl ?? undefined,
            urineOutputMlKgHour: urineOutputMlKgHour ?? undefined,
            therapeuticHypothermia: parseBoolean(
              record.hipotermia_terapeutik,
              BATCH_COLUMN_LABELS.hipotermia_terapeutik,
              errors,
            ),
            coxInhibitorTherapy: parseBoolean(
              record.terapi_cox_inhibitor,
              BATCH_COLUMN_LABELS.terapi_cox_inhibitor,
              errors,
            ),
            severeSepsisOrHighRiskInfection: parseBoolean(
              record.sepsis_berat,
              BATCH_COLUMN_LABELS.sepsis_berat,
              errors,
            ),
          };

    const manualWarnings: string[] = [];
    let manualInput = parseManualEvaluation(
      record,
      manualWarnings,
      errors,
    );

    let validatedPatient: PatientInput | null = null;
    if (patient) {
      const validation = validatePatientInput(patient);
      if (validation.success) validatedPatient = validation.data;
      else errors.push(...validation.issues.map((issue) => issue.message));
    }
    if (actualDoseMg !== null && actualDoseMg <= 0) errors.push("Dosis aktual per pemberian (mg) harus lebih dari 0.");
    if (
      actualIntervalHours !== null &&
      (!Number.isInteger(actualIntervalHours) || actualIntervalHours < 1 || actualIntervalHours > 96)
    ) {
      errors.push("Frekuensi aktual harus bilangan bulat 1–96 jam (setiap ... jam).");
    }
    if (manualInput) {
      if (actualDoseMg !== null && actualIntervalHours !== null) {
        const validation = validateRegimenEvaluationInput({...manualInput, actualDoseMg, actualIntervalHours}, true);
        if (!validation.success) {
          manualWarnings.push(...validation.issues.map((issue) => issue.message));
          manualInput = null;
        }
      } else if (manualInput.manualDoseMinMg <= 0 || manualInput.manualDoseMaxMg <= 0 || manualInput.manualDoseMinMg > manualInput.manualDoseMaxMg) {
        errors.push("Dosis hitung manual harus lebih dari 0 mg dan batas bawah tidak boleh lebih besar dari batas atas.");
      }
    }

    if (errors.length > 0 || !validatedPatient) {
      results.push({
        status: "gagal",
        sourceRow,
        patientCode: patientCode || `Baris ${sourceRow}`,
        errors: [...new Set(errors)],
      });
      return;
    }

    try {
      const calculator = calculateRecommendations(validatedPatient);
      results.push({
        status: "berhasil",
        sourceRow,
        patientCode,
        calculator,
        actualEvaluation: actualDoseMg !== null && actualIntervalHours !== null ? evaluateActualRegimen(calculator, actualDoseMg, actualIntervalHours) : null,
        manualInput,
        manualEvaluation: manualInput && actualDoseMg !== null && actualIntervalHours !== null ? evaluateRegimen(calculator, {...manualInput, actualDoseMg, actualIntervalHours}) : null,
        warnings: [...new Set(manualWarnings)],
      });
    } catch (error) {
      results.push({
        status: "gagal",
        sourceRow,
        patientCode: patientCode || `Baris ${sourceRow}`,
        errors: [error instanceof Error ? error.message : "Gagal menghitung baris."],
      });
    }
  });

  return {
    rows: results,
    ignoredRows,
    candidateRows: results.length,
    successCount: results.filter((row) => row.status === "berhasil").length,
    errorCount: results.filter((row) => row.status === "gagal").length,
    warningCount: results.filter((row) => row.status === "berhasil" && row.warnings.length > 0).length,
  };
}
