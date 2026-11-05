import { describe, expect, it } from "vitest";
import { BATCH_COLUMN_LABELS, BATCH_COLUMNS, processBatchTable } from "../batch-engine";
import { validatePatientInput, validateRegimenEvaluationInput } from "../validation";
import { patient } from "./fixtures";
import type { PatientInput, RegimenEvaluationInput } from "../types";

const regimen: RegimenEvaluationInput = {
  manualDoseMinMg: 10, manualDoseMaxMg: 12,
  manualIntervalMinHours: 24, manualIntervalMaxHours: 48,
  actualDoseMg: 11, actualIntervalHours: 24,
};

const errorFor = (input: RegimenEvaluationInput, field: string) => {
  const result = validateRegimenEvaluationInput(input);
  expect(result.success).toBe(false);
  return result.success ? "" : result.issues.find(issue => issue.field === field)?.message;
};

const completeRow: (string | number)[] = [
  "UJI-001", "Gentamisin", 38, 0, 1, 3.94, "", "", "Tidak", "Tidak", "Tidak",
  20, 30, 24, 48, 20, 24,
];

describe("[2.6] nama isian di pesan kesalahan sesuai formulir dan templat v20", () => {
  it.each([
    ["antibiotic", { antibiotic: "" as PatientInput["antibiotic"] }, "Pilih antibiotik yang didukung: Gentamisin, Amikasin, atau Vankomisin."],
    ["gestationalAgeWeeks", { gestationalAgeWeeks: 21 }, "Usia gestasi saat lahir — minggu harus 22–43 minggu."],
    ["gestationalAgeDays", { gestationalAgeDays: 7 }, "Usia gestasi saat lahir — tambahan hari harus 0–6 hari dan usia gestasi total maksimal 43 minggu."],
    ["patientLabel", { patientLabel: "X".repeat(61) }, "Kode pasien maksimal 60 karakter."],
  ] as const)("mengenali isian pasien %s dengan nama yang sama seperti di formulir", (field, override, expected) => {
    const result = validatePatientInput(patient(override));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues).toContainEqual({ field, message: expected });
  });

  it.each([
    ["manualDoseMinMg", { manualDoseMinMg: 0 }, "Dosis manual batas bawah (mg) harus lebih dari 0."],
    ["manualDoseMaxMg", { manualDoseMaxMg: 0 }, "Dosis manual batas atas (mg) harus lebih dari 0."],
    ["actualDoseMg", { actualDoseMg: 0 }, "Dosis aktual per pemberian (mg) harus lebih dari 0."],
    ["manualIntervalMinHours", { manualIntervalMinHours: null }, "Frekuensi manual paling sering (interval dalam jam) wajib diisi."],
    ["manualIntervalMaxHours", { manualIntervalMaxHours: null }, "Frekuensi manual paling jarang (interval dalam jam) wajib diisi."],
    ["actualIntervalHours", { actualIntervalHours: null }, "Frekuensi aktual (interval dalam jam) wajib diisi."],
    ["manualIntervalMinHours", { manualIntervalMinHours: 24.5 }, "Frekuensi manual paling sering (interval dalam jam) harus bilangan bulat positif."],
    ["actualIntervalHours", { actualIntervalHours: 0 }, "Frekuensi aktual (interval dalam jam) harus bilangan bulat positif."],
    ["manualDoseMaxMg", { manualDoseMinMg: 13 }, "Dosis manual batas bawah (mg) tidak boleh melebihi batas atas (mg)."],
    ["manualIntervalMaxHours", { manualIntervalMinHours: 72 }, "Frekuensi manual paling sering (interval dalam jam) tidak boleh melebihi paling jarang (interval dalam jam)."],
  ] as const)("mempertahankan penolakan isian evaluasi %s", (field, change, expected) => {
    expect(errorFor({ ...regimen, ...change }, field)).toBe(expected);
  });

  it("tidak mengubah nilai atau kriteria validasi ketika interval tidak relevan", () => {
    const valid = validateRegimenEvaluationInput(regimen);
    expect(valid).toEqual({ success: true, data: regimen });
    const noInterval = {
      ...regimen, actualIntervalHours: null,
      manualIntervalMinHours: null, manualIntervalMaxHours: null,
    };
    expect(validateRegimenEvaluationInput(noInterval, false)).toEqual({ success: true, data: noInterval });
    expect(validateRegimenEvaluationInput(noInterval, true).success).toBe(false);
  });

  it("memberi label yang terbaca untuk setiap nama kolom tanpa mengubah kunci template", () => {
    expect(Object.keys(BATCH_COLUMN_LABELS)).toEqual([...BATCH_COLUMNS]);
    expect(Object.values(BATCH_COLUMN_LABELS).every(label => !!label && !/[a-z]+_[a-z]+/.test(label))).toBe(true);
    expect(BATCH_COLUMN_LABELS.dosis_aktual_mg).toBe("Dosis aktual per pemberian (mg)");
    expect(BATCH_COLUMN_LABELS.frekuensi_aktual_jam).toBe("Frekuensi aktual (interval dalam jam)");
    expect(BATCH_COLUMN_LABELS.frekuensi_manual_min_jam).toContain("paling sering");
    expect(BATCH_COLUMN_LABELS.frekuensi_manual_max_jam).toContain("paling jarang");
  });

  it("memunculkan label yang dibaca pengguna pada kesalahan impor Excel, bukan nama snake_case", () => {
    const bad: (string | number)[] = [...completeRow];
    bad[0] = "";
    bad[2] = "tidak valid";
    bad[5] = "abc";
    bad[8] = "mungkin";
    bad[15] = "bukan angka";
    const result = processBatchTable([[...BATCH_COLUMNS], bad]);
    expect(result.errorCount).toBe(1);
    const first = result.rows[0];
    expect(first.status).toBe("gagal");
    if (first.status === "gagal") {
      expect(first.errors).toContain("Kode pasien wajib diisi.");
      expect(first.errors).toContain("Usia gestasi saat lahir — minggu harus berupa angka.");
      expect(first.errors).toContain("Berat badan saat ini (kg) harus berupa angka.");
      expect(first.errors).toContain("Dosis aktual per pemberian (mg) harus berupa angka.");
      expect(first.errors.every(message => !/(kode_pasien|usia_gestasi_lahir_minggu|berat_badan_kg|dosis_aktual_mg)/.test(message))).toBe(true);
    }
  });

  it("menampilkan label dan nama kolom asli bila struktur template tidak lengkap", () => {
    expect(() => processBatchTable([["kode_pasien", "antibiotik"]])).toThrow(
      "Kolom wajib 'usia_gestasi_lahir_minggu' (Usia gestasi saat lahir — minggu) tidak ditemukan.",
    );
  });

  it("mengidentifikasi nama kotak centang pada data batch yang tidak valid", () => {
    const bad = [...completeRow];
    bad[8] = "mungkin";
    const result = processBatchTable([[...BATCH_COLUMNS], bad]);
    const first = result.rows[0];
    expect(first.status).toBe("gagal");
    if (first.status === "gagal") expect(first.errors).toContain("Hipotermia terapeutik harus Ya atau Tidak.");
  });
});
