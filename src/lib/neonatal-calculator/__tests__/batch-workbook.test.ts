import { describe, expect, it } from "vitest";
import { BATCH_COLUMNS, processBatchTable } from "../batch-engine";
import { buildBatchResultWorkbook, buildBatchTemplateWorkbook } from "../batch-workbook";

async function loadWorkbook(buffer: ArrayBuffer) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(buffer) as unknown as import("exceljs").Buffer);
  return workbook;
}

describe("workbook batch", () => {
  it("membuat template yang dapat dibuka dan memiliki sheet input", async () => {
    const workbook = await loadWorkbook(await buildBatchTemplateWorkbook());

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Petunjuk", "Data Pasien"]);
    expect(workbook.getWorksheet("Data Pasien")?.getRow(1).values).toEqual([
      undefined,
      ...BATCH_COLUMNS,
    ]);
  });

  it("membuat hasil evaluasi yang dapat dibuka", async () => {
    const processed = processBatchTable([
      [...BATCH_COLUMNS],
      [
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
      ],
    ]);
    const workbook = await loadWorkbook(await buildBatchResultWorkbook(processed));

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Hasil per Pasien",
      "Ringkasan Kesesuaian",
      "Analisis Statistik",
      "Interpretasi & Kesimpulan",
      "Peringatan",
      "Keterangan Singkatan",
    ]);
    expect(workbook.getWorksheet("Hasil per Pasien")?.rowCount).toBe(2);
  });

  it("menampilkan pesan ginjal T11 dan T19 sekali per pasien tanpa menghilangkan peringatan lain", async () => {
    const processed = processBatchTable([
      [...BATCH_COLUMNS],
      ["T11", "Gentamisin", 38, 0, 5, 3, 1.2, 2, "Tidak", "Tidak", "Tidak", "", "", "", "", 14, 24],
      ["T19", "Amikasin", 28, 0, 6, 1.1, 1, 1.4, "Tidak", "Ya", "Tidak", 16.5, 16.5, 24, 24, 16.5, 24],
    ]);
    expect(processed.successCount).toBe(2);
    const workbook = await loadWorkbook(await buildBatchResultWorkbook(processed));
    const warnings = workbook.getWorksheet("Peringatan")!;
    const notes: { code: string; message: string }[] = [];
    warnings.eachRow((row, index) => {
      if (index > 1) notes.push({ code: String(row.getCell(2).value), message: String(row.getCell(4).value) });
    });
    for (const code of ["T11", "T19"]) {
      expect(notes.filter(note => note.code === code && note.message.startsWith("Terdapat sinyal perlunya evaluasi fungsi ginjal."))).toHaveLength(1);
      expect(notes.filter(note => note.code === code && note.message.startsWith("Kriteria gangguan fungsi ginjal terpenuhi."))).toHaveLength(1);
    }
    expect(notes.filter(note => note.code === "T19" && note.message.startsWith("Interval kedua rujukan berbeda"))).toHaveLength(1);
    expect(notes).toHaveLength(5);
  });

  it("mempertahankan pesan atau tingkat peringatan berbeda meskipun kodenya sama", async () => {
    const processed = processBatchTable([
      [...BATCH_COLUMNS],
      ["T11", "Gentamisin", 38, 0, 5, 3, 1.2, 2, "Tidak", "Tidak", "Tidak", "", "", "", "", 14, 24],
    ]);
    const patient = processed.rows[0];
    if (patient.status !== "berhasil") throw new Error("Fixture pasien tidak valid");
    const original = patient.calculator.globalWarnings.find(warning => warning.code === "RENAL_REVIEW")!;
    patient.calculator.globalWarnings.push(
      { ...original },
      { ...original, severity: "warning" },
      { ...original, message: "Periksa kembali data ginjal yang baru diperbarui." },
    );
    const workbook = await loadWorkbook(await buildBatchResultWorkbook(processed));
    const matching: string[] = [];
    let differentMessage = 0;
    workbook.getWorksheet("Peringatan")!.eachRow(row => {
      if (row.getCell(4).value === original.message) matching.push(String(row.getCell(3).value));
      if (row.getCell(4).value === "Periksa kembali data ginjal yang baru diperbarui.") differentMessage++;
    });
    expect(matching).toEqual(["PERINGATAN", "PERHATIAN"]);
    expect(differentMessage).toBe(1);
  });
});
