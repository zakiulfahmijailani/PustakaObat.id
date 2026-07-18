import { describe, expect, it } from "vitest";
import { BATCH_COLUMNS, processBatchTable } from "../batch-engine";

const completeRow = [
  "P-001",
  "Gentamisin",
  38,
  1,
  3.94,
  "",
  "",
  "Tidak",
  "Tidak",
  "Tidak",
  20,
  30,
  24,
  48,
  20,
  24,
];

describe("processBatchTable", () => {
  it("mengabaikan contoh dan memproses baris dengan pembanding manual", () => {
    const result = processBatchTable([
      [...BATCH_COLUMNS],
      ["CONTOH-1", ...completeRow.slice(1)],
      completeRow,
    ]);

    expect(result).toMatchObject({
      candidateRows: 1,
      ignoredRows: 1,
      successCount: 1,
      errorCount: 0,
    });
    const row = result.rows[0];
    expect(row.status).toBe("berhasil");
    if (row.status === "berhasil") {
      expect(row.calculator.input.patientLabel).toBe("P-001");
      expect(row.actualEvaluation.targets).toHaveLength(3);
      expect(row.manualEvaluation?.targets).toHaveLength(3);
    }
  });

  it("tetap mengevaluasi dosis aktual ketika seluruh kolom manual kosong", () => {
    const row = [...completeRow];
    row[10] = "";
    row[11] = "";
    row[12] = "";
    row[13] = "";
    const result = processBatchTable([[...BATCH_COLUMNS], row]);

    expect(result.successCount).toBe(1);
    const processed = result.rows[0];
    expect(processed.status).toBe("berhasil");
    if (processed.status === "berhasil") expect(processed.manualEvaluation).toBeNull();
  });

  it("melaporkan duplikat dan data ginjal yang tidak lengkap per baris", () => {
    const duplicate = [...completeRow];
    const renalWithoutCreatinine = [...completeRow];
    renalWithoutCreatinine[0] = "P-002";
    renalWithoutCreatinine[6] = 1.2;

    const result = processBatchTable([
      [...BATCH_COLUMNS],
      completeRow,
      duplicate,
      renalWithoutCreatinine,
    ]);

    expect(result.successCount).toBe(1);
    expect(result.errorCount).toBe(2);
    const messages = result.rows
      .filter((row) => row.status === "gagal")
      .flatMap((row) => row.errors);
    expect(messages).toContain("kode_pasien duplikat di dalam file.");
    expect(messages).toContain("kreatinin_serum_mg_dl wajib diisi jika produksi urin dicantumkan.");
  });

  it("tetap memproses evaluasi aktual ketika pembanding manual tidak valid", () => {
    const row = [...completeRow];
    row[10] = 30;
    row[11] = 20;
    const result = processBatchTable([[...BATCH_COLUMNS], row]);

    expect(result).toMatchObject({ successCount: 1, errorCount: 0, warningCount: 1 });
    const processed = result.rows[0];
    expect(processed.status).toBe("berhasil");
    if (processed.status === "berhasil") {
      expect(processed.manualEvaluation).toBeNull();
      expect(processed.warnings).toContain("Dosis manual minimum tidak boleh melebihi maksimum.");
    }
  });

  it("menolak template dengan kolom wajib yang hilang", () => {
    expect(() => processBatchTable([["kode_pasien", "antibiotik"]])).toThrow(
      "Kolom wajib 'usia_gestasi_lahir_minggu' tidak ditemukan.",
    );
  });
});
