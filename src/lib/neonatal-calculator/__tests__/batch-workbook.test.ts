import { describe, expect, it } from "vitest";
import { BATCH_COLUMNS, processBatchTable } from "../batch-engine";
import { buildBatchResultWorkbook, buildBatchTemplateWorkbook } from "../batch-workbook";
import { summarizeBatch } from "../batch-statistics";
import { buildBatchSummaryPdf } from "../pdf-reports";

async function loadWorkbook(buffer: ArrayBuffer) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(buffer) as unknown as import("exceljs").Buffer);
  return workbook;
}

function vancomycinBatch(count: number) {
  return processBatchTable([
    [...BATCH_COLUMNS],
    ...Array.from({ length: count }, (_, index) => [
      `V-${index + 1}`, "Vankomisin", 30, 0, 15, 1.45, 0.5, 2,
      "Tidak", "Tidak", "Tidak", 14.5, 21.75, 8, 8, 20, 8,
    ]),
  ]);
}

describe("workbook batch", () => {
  it("membuat template yang dapat dibuka dan memiliki sheet input", async () => {
    const workbook = await loadWorkbook(await buildBatchTemplateWorkbook());

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Petunjuk", "Data Pasien"]);
    expect(workbook.getWorksheet("Data Pasien")?.getRow(1).values).toEqual([
      undefined,
      ...BATCH_COLUMNS,
    ]);
    expect(workbook.getWorksheet("Petunjuk")?.getRow(11).getCell(2).value).toBe(
      "Berat badan saat ini dalam kg, bukan gram (mis. 1720 g = 1,72 kg). Wajib.",
    );
    expect(workbook.getWorksheet("Petunjuk")?.getRow(10).getCell(2).value).toBe(
      "Usia pascalahir neonatal 0–28 hari. Di atas 28 hari gunakan pedoman dosis bayi yang sesuai. Wajib.",
    );
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

  it("menyampaikan konversi gram ke kilogram pada sheet peringatan", async () => {
    const row = ["P-GRAM", "Gentamisin", 38, 0, 1, 1720, "", "", "Tidak", "Tidak", "Tidak", 20, 30, 24, 48, 20, 24];
    const processed = processBatchTable([[...BATCH_COLUMNS], row]);
    const workbook = await loadWorkbook(await buildBatchResultWorkbook(processed));

    expect(workbook.getWorksheet("Peringatan")?.getRow(2).getCell(4).value).toBe(
      "Baris dilewati: Berat badan harus 0,3–10 kg. Tampaknya berat diisi dalam gram; isi dalam kilogram (mis. 1720 g = 1,72 kg).",
    );
  });

  it("menyampaikan batas usia pascalahir pada sheet peringatan", async () => {
    const row = ["P-PNA", "Gentamisin", 38, 0, 29, 1.5, "", "", "Tidak", "Tidak", "Tidak", 20, 30, 24, 48, 20, 24];
    const processed = processBatchTable([[...BATCH_COLUMNS], row]);
    const workbook = await loadWorkbook(await buildBatchResultWorkbook(processed));

    expect(workbook.getWorksheet("Peringatan")?.getRow(2).getCell(4).value).toBe(
      "Baris dilewati: Usia pascalahir di luar cakupan kalkulator (0–28 hari). Gunakan pedoman dosis bayi di atas 28 hari.",
    );
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

  it("mengosongkan p pada uji beda dengan kurang dari tiga pasangan, termasuk semua selisih nol", async () => {
    for (const count of [0, 1, 2]) {
      const batch = vancomycinBatch(count);
      const test = summarizeBatch(batch).paired.find(test => test.group === "vankomisin" && test.metric === "Frekuensi manual" && test.reference === "Pedoman Rumah Sakit")!;
      expect(test.method).toBe("Tidak diuji");
      expect(test.pValue).toBeNull();
      const workbook = await loadWorkbook(await buildBatchResultWorkbook(batch));
      const sheet = workbook.getWorksheet("Analisis Statistik")!;
      const row = sheet.getRows(2, sheet.rowCount - 1)!.find(row => row.getCell(1).value === "Vankomisin" && row.getCell(2).value === "Frekuensi manual" && row.getCell(3).value === "Pedoman Rumah Sakit")!;
      expect(row.getCell(11).value).toBe("Tidak diuji");
      expect(row.getCell(13).value).toBeNull();
      expect(row.getCell(15).value).toBe("Tidak diuji (n<3)");
      if (count > 0) {
        const pdf = new TextDecoder().decode(buildBatchSummaryPdf(batch));
        expect(pdf).toContain(`Tidak diuji, n=${count} \\(n<3\\)`);
      }
    }
  });

  it("tidak menguji semua pasien di dalam rentang sesuai v20", async () => {
    const batch = vancomycinBatch(3);
    const test = summarizeBatch(batch).paired.find(test => test.group === "vankomisin" && test.metric === "Frekuensi manual" && test.reference === "Pedoman Rumah Sakit")!;
    expect(test).toMatchObject({ n: 3, method: "Tidak diuji", pValue: null, medianDifference: 0, statistic: null });
    const workbook = await loadWorkbook(await buildBatchResultWorkbook(batch));
    const sheet = workbook.getWorksheet("Analisis Statistik")!;
    const row = sheet.getRows(2, sheet.rowCount - 1)!.find(row => row.getCell(1).value === "Vankomisin" && row.getCell(2).value === "Frekuensi manual" && row.getCell(3).value === "Pedoman Rumah Sakit")!;
    expect(row.getCell(11).value).toBe("Tidak diuji");
    expect(row.getCell(13).value).toBeNull();
    expect(row.getCell(8).value).toBeNull();
    expect(row.getCell(15).value).toBe("Semua di dalam rentang; uji tidak diperlukan");
    expect(new TextDecoder().decode(buildBatchSummaryPdf(batch))).toContain("Tidak diuji");
    expect(new TextDecoder().decode(buildBatchSummaryPdf(batch))).toContain("Tidak diuji, n=3 \\(semua di dalam rentang\\)");
  });

  it("memisahkan McNemar tanpa pasangan valid dari pasangan valid tanpa diskordan", async () => {
    for (const count of [0, 1]) {
      const batch = vancomycinBatch(count);
      const test = summarizeBatch(batch).mcnemar.find(test => test.group === "Keseluruhan" && test.metric === "Frekuensi aktual")!;
      expect(test.method).toBe(count === 0 ? "Tidak diuji" : "Tidak ada pasangan diskordan");
      expect(test.pValue).toBeNull();
      const workbook = await loadWorkbook(await buildBatchResultWorkbook(batch));
      const sheet = workbook.getWorksheet("Analisis Statistik")!;
      const header = sheet.getRows(1, sheet.rowCount)!.find(row => row.getCell(1).value === "McNemar: Kelompok")!;
      const row = sheet.getRows(header.number + 1, sheet.rowCount - header.number)!.find(row => row.getCell(1).value === "Keseluruhan" && row.getCell(2).value === "Frekuensi aktual")!;
      expect(row.getCell(8).value).toBe(count === 0 ? "Tidak diuji" : "Tidak diuji: tidak ada pasangan diskordan");
      expect(row.getCell(10).value).toBeNull();
      expect(String(row.getCell(11).value)).toContain(count === 0 ? "tidak ada pasangan valid" : "tidak ada pasien yang hasilnya berbeda");
      const pdf = new TextDecoder().decode(buildBatchSummaryPdf(batch));
      if (count === 0) expect(pdf).not.toContain("p=");
      else expect(pdf).toContain("Tidak diuji: tidak ada pasangan diskordan");
    }
  });
});
