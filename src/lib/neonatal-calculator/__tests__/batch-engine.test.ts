import { describe, expect, it } from "vitest";
import { BATCH_COLUMNS, processBatchTable } from "../batch-engine";
import { buildBatchResultWorkbook } from "../batch-workbook";

const completeRow = [
  "P-001",
  "Gentamisin",
  38,
  0,
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
      expect(row.actualEvaluation?.targets).toHaveLength(3);
      expect(row.manualEvaluation?.targets).toHaveLength(3);
    }
  });

  it("tetap mengevaluasi dosis aktual ketika seluruh kolom manual kosong", () => {
    const row = [...completeRow];
    row[11] = "";
    row[12] = "";
    row[13] = "";
    row[14] = "";
    const result = processBatchTable([[...BATCH_COLUMNS], row]);

    expect(result.successCount).toBe(1);
    const processed = result.rows[0];
    expect(processed.status).toBe("berhasil");
    if (processed.status === "berhasil") expect(processed.manualEvaluation).toBeNull();
  });

  it("menolak semua 14 kombinasi isian manual yang tidak lengkap dengan nomor baris dan alasan", () => {
    const rows = Array.from({ length: 14 }, (_, index) => {
      const mask = index + 1;
      const row: (string | number | null)[] = [...completeRow];
      row[0] = `P-${mask}`;
      for (let field = 0; field < 4; field++) if (!(mask & (1 << field))) row[11 + field] = field % 2 ? null : " ";
      return row;
    });
    const result = processBatchTable([[...BATCH_COLUMNS], ...rows]);
    expect(result).toMatchObject({ candidateRows: 14, successCount: 0, errorCount: 14, warningCount: 0 });
    result.rows.forEach((row, index) => {
      expect(row).toMatchObject({ status: "gagal", sourceRow: index + 2, patientCode: `P-${index + 1}` });
      if (row.status === "gagal") expect(row.errors).toContain("Hitung manual harus diisi lengkap (dosis batas bawah dan atas, frekuensi paling sering dan paling jarang) atau dikosongkan semua.");
    });
  });

  it("mencantumkan alasan baris manual tidak lengkap pada Excel tanpa menghasilkan hasil pasien", async () => {
    const partial = [...completeRow];
    partial[12] = "";
    const result = processBatchTable([[...BATCH_COLUMNS], partial]);
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(await buildBatchResultWorkbook(result)) as unknown as import("exceljs").Buffer);
    expect(workbook.getWorksheet("Hasil per Pasien")!.rowCount).toBe(1);
    const row = workbook.getWorksheet("Peringatan")!.getRow(2);
    expect(row.getCell(1).value).toBe(2);
    expect(row.getCell(2).value).toBe("P-001");
    expect(String(row.getCell(4).value)).toContain("Hitung manual harus diisi lengkap");
  });

  it("menolak dosis dan frekuensi aktual yang hanya terisi satu serta mencatat alasan di Excel", async () => {
    const doseOnly = [...completeRow]; doseOnly[0] = "DOSIS"; doseOnly[16] = "";
    const frequencyOnly = [...completeRow]; frequencyOnly[0] = "FREKUENSI"; frequencyOnly[15] = "";
    const result = processBatchTable([[...BATCH_COLUMNS], doseOnly, frequencyOnly]);
    const reason = "Dosis aktual dan frekuensi aktual harus diisi bersama.";
    expect(result).toMatchObject({successCount: 0, errorCount: 2});
    for (const [index, row] of result.rows.entries()) {
      expect(row).toMatchObject({status: "gagal", sourceRow: index + 2, patientCode: index ? "FREKUENSI" : "DOSIS"});
      if (row.status === "gagal") expect(row.errors).toContain(reason);
    }
    const ExcelJS = await import("exceljs"); const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(await buildBatchResultWorkbook(result)) as unknown as import("exceljs").Buffer);
    expect(workbook.getWorksheet("Hasil per Pasien")!.rowCount).toBe(1);
    for (const [index, code] of ["DOSIS", "FREKUENSI"].entries()) {
      const row = workbook.getWorksheet("Peringatan")!.getRow(index + 2);
      expect(row.getCell(1).value).toBe(index + 2); expect(row.getCell(2).value).toBe(code);
      expect(String(row.getCell(4).value)).toContain(reason);
    }
  });

  it.each([0, 1, 36.5, 96, 97])("memeriksa frekuensi aktual %s jam", (hours) => {
    const row = [...completeRow]; row[16] = hours;
    const result = processBatchTable([[...BATCH_COLUMNS], row]);
    expect(result.rows[0].status).toBe(hours === 1 || hours === 96 ? "berhasil" : "gagal");
    if (result.rows[0].status === "gagal") expect(result.rows[0].errors).toContain("Frekuensi aktual harus bilangan bulat 1–96 jam (setiap ... jam).");
  });

  it.each([0, 1, 36.5, 96, 97])("memeriksa kedua batas frekuensi manual %s jam", (hours) => {
    for (const index of [13, 14]) {
      const row = [...completeRow]; row[13] = 1; row[14] = 96; row[index] = hours;
      const result = processBatchTable([[...BATCH_COLUMNS], row]);
      expect(result.rows[0].status).toBe(hours === 1 || hours === 96 ? "berhasil" : "gagal");
      if (result.rows[0].status === "gagal") expect(result.rows[0].errors.join(" ")).toContain("bilangan bulat 1–96 jam");
    }
  });

  it("menolak batas frekuensi manual yang terbalik", () => {
    const row = [...completeRow]; row[13] = 48; row[14] = 24;
    const result = processBatchTable([[...BATCH_COLUMNS], row]);
    expect(result.rows[0].status).toBe("gagal");
    if (result.rows[0].status === "gagal") expect(result.rows[0].errors.join(" ")).toContain("paling sering tidak boleh lebih besar");
  });

  it("melaporkan duplikat dan data ginjal yang tidak lengkap per baris", () => {
    const duplicate = [...completeRow];
    const renalWithoutCreatinine = [...completeRow];
    renalWithoutCreatinine[0] = "P-002";
    renalWithoutCreatinine[7] = 1.2;

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
    expect(messages).toContain("Kreatinin serum wajib diisi jika produksi urin dicantumkan.");
  });

  it("tetap memproses evaluasi aktual ketika pembanding manual tidak valid", () => {
    const row = [...completeRow];
    row[11] = 30;
    row[12] = 20;
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

  it("menjelaskan konversi gram ke kilogram pada baris berat yang dilewati", () => {
    const row = [...completeRow];
    row[5] = 1720;
    const result = processBatchTable([[...BATCH_COLUMNS], row]);

    expect(result.errorCount).toBe(1);
    expect(result.rows[0]).toMatchObject({
      status: "gagal",
      errors: [
        "Berat badan harus 0,3–10 kg. Tampaknya berat diisi dalam gram; isi dalam kilogram (mis. 1720 g = 1,72 kg).",
      ],
    });
  });

  it("menjelaskan batas cakupan neonatal untuk usia pascalahir di atas 28 hari", () => {
    const row = [...completeRow];
    row[4] = 29;
    const result = processBatchTable([[...BATCH_COLUMNS], row]);

    expect(result.rows[0]).toMatchObject({
      status: "gagal",
      errors: ["Usia pascalahir di luar cakupan kalkulator (0–28 hari). Gunakan pedoman dosis bayi di atas 28 hari."],
    });
  });

  it("menolak kreatinin 70 mg/dL dan mengekspor petunjuk µmol/L tanpa konversi diam-diam", async () => {
    const source = [...completeRow]; source[6] = 70;
    const result = processBatchTable([[...BATCH_COLUMNS], source]);
    expect(result).toMatchObject({successCount:0,errorCount:1});
    expect(source[6]).toBe(70);
    const ExcelJS = await import("exceljs"); const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(await buildBatchResultWorkbook(result)) as unknown as import("exceljs").Buffer);
    expect(workbook.getWorksheet("Hasil per Pasien")!.rowCount).toBe(1);
    const warning = workbook.getWorksheet("Peringatan")!.getRow(2);
    expect(warning.getCell(1).value).toBe(2); expect(warning.getCell(2).value).toBe("P-001");
    expect(String(warning.getCell(4).value)).toContain("Kreatinin serum di luar rentang 0–10 mg/dL");
    expect(String(warning.getCell(4).value)).toContain("µmol/L; bagi dengan 88,4");
  });
});
