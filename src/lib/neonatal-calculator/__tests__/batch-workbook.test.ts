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
      "Ringkasan",
      "Hasil Evaluasi",
      "Kesalahan",
      "Peringatan Data",
    ]);
    expect(workbook.getWorksheet("Hasil Evaluasi")?.rowCount).toBe(2);
  });
});
