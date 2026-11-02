import { notebookBatchRecord } from "./notebook-results";
import { summarizeBatch } from "./batch-statistics";
import { buildBatchInterpretation } from "./batch-interpretation";
import type { ClinicalWarning } from "./types";
import {
  BATCH_COLUMNS,
  BATCH_SHEET_NAME,
  CALCULATOR_RULE_VERSION,
  type BatchProcessingResult,
  type BatchSuccessRow,
} from ".";

const COLUMN_DESCRIPTIONS: Record<(typeof BATCH_COLUMNS)[number], string> = {
  kode_pasien: "Kode kasus unik tanpa identitas langsung. Wajib.",
  antibiotik: "Gentamisin, Amikasin, atau Vankomisin. Wajib.",
  usia_gestasi_lahir_minggu: "Usia gestasi saat lahir dalam minggu lengkap. Wajib.",
  usia_gestasi_lahir_hari: "Tambahan hari 0–6. Opsional; kosong = 0.",
  usia_pascalahir_hari: "Usia pascalahir dalam hari. Wajib.",
  berat_badan_kg: "Berat badan saat ini dalam kg. Wajib.",
  kreatinin_serum_mg_dl: "Kreatinin serum dalam mg/dL. Opsional.",
  produksi_urin_ml_kg_jam: "Produksi urin dalam mL/kg/jam. Opsional; SCr wajib bila diisi.",
  hipotermia_terapeutik: "Ya/Tidak. Kosong dianggap Tidak.",
  terapi_cox_inhibitor: "Ya/Tidak. Kosong dianggap Tidak.",
  sepsis_berat: "Ya/Tidak. Kosong dianggap Tidak.",
  dosis_manual_min_mg: "Pembanding manual minimum dalam mg. Opsional sebagai satu blok lengkap.",
  dosis_manual_max_mg: "Pembanding manual maksimum dalam mg. Opsional sebagai satu blok lengkap.",
  frekuensi_manual_min_jam: "Interval manual minimum dalam jam. Opsional sebagai satu blok lengkap.",
  frekuensi_manual_max_jam: "Interval manual maksimum dalam jam. Opsional sebagai satu blok lengkap.",
  dosis_aktual_mg: "Dosis aktual per pemberian dalam mg. Wajib.",
  frekuensi_aktual_jam: "Interval aktual dalam jam. Wajib.",
};

const HEADER_FILL = "FF0F766E";
const HEADER_FONT = { color: { argb: "FFFFFFFF" }, bold: true } as const;

// Public warning labels match the calculator screen; text colors use its light-theme status palette.
const WARNING_PRESENTATION = {
  critical: { label: "PERINGATAN", foreground: "FFB4493F", background: "FFF8EDEC" },
  warning: { label: "PERHATIAN", foreground: "FFA76F24", background: "FFFFF3CD" },
  info: { label: "INFORMASI", foreground: "FF3F6F8F", background: "FFECF1F4" },
} as const;

function addWarningRow(
  sheet: import("exceljs").Worksheet,
  sourceRow: number,
  patientCode: string,
  severity: ClinicalWarning["severity"],
  message: string,
): void {
  const presentation = WARNING_PRESENTATION[severity];
  const row = sheet.addRow([sourceRow, patientCode, presentation.label, message]);
  const category = row.getCell(3);
  category.font = { bold: true, color: { argb: presentation.foreground } };
  category.fill = { type: "pattern", pattern: "solid", fgColor: { argb: presentation.background } };
  row.eachCell(cell => { cell.alignment = { vertical: "middle", wrapText: true }; });
  row.height = Math.max(28, Math.ceil(message.length / 70) * 16 + 8);
}

function cellPrimitive(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if ("result" in value) return cellPrimitive((value as { result?: unknown }).result);
  if ("richText" in value) {
    return (value as { richText: { text: string }[] }).richText.map((part) => part.text).join("");
  }
  if ("text" in value) return String((value as { text: unknown }).text);
  return String(value);
}

function styleHeader(row: import("exceljs").Row): void {
  row.height = 32;
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

function setUsefulWidths(worksheet: import("exceljs").Worksheet, maxWidth = 42): void {
  worksheet.columns.forEach((column) => {
    let width = 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      width = Math.max(width, Math.min(maxWidth, String(cell.text ?? "").length + 2));
    });
    column.width = width;
  });
}

function workbookBytes(buffer: import("exceljs").Buffer): ArrayBuffer {
  const source = new Uint8Array(buffer as ArrayBuffer);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy.buffer;
}

function downloadBytes(bytes: ArrayBuffer, filename: string): void {
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function timestamp(): string {
  const date = new Date();
  const two = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}-${two(date.getHours())}${two(date.getMinutes())}`;
}

export async function readBatchWorkbook(file: File): Promise<readonly (readonly unknown[])[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const data = new Uint8Array(await file.arrayBuffer());
  await workbook.xlsx.load(data as unknown as import("exceljs").Buffer);
  const worksheet = workbook.worksheets.find(
    (sheet) => sheet.name.trim().toLowerCase() === BATCH_SHEET_NAME.toLowerCase(),
  );
  if (!worksheet) throw new Error(`Sheet '${BATCH_SHEET_NAME}' tidak ditemukan.`);

  const columnCount = Math.max(worksheet.actualColumnCount, BATCH_COLUMNS.length);
  return Array.from({ length: worksheet.actualRowCount }, (_, rowIndex) =>
    Array.from({ length: columnCount }, (_, columnIndex) =>
      cellPrimitive(worksheet.getCell(rowIndex + 1, columnIndex + 1).value),
    ),
  );
}

export async function buildBatchTemplateWorkbook(): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PustakaObat.id";
  workbook.created = new Date();

  const instructions = workbook.addWorksheet("Petunjuk", { views: [{ state: "frozen", ySplit: 4 }] });
  instructions.mergeCells("A1:D1");
  instructions.getCell("A1").value = "TEMPLATE EVALUASI DOSIS ANTIBIOTIK NEONATUS — BATCH";
  instructions.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  instructions.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  instructions.getCell("A1").alignment = { vertical: "middle" };
  instructions.getRow(1).height = 30;
  instructions.mergeCells("A3:D3");
  instructions.getCell("A3").value =
    "Isi sheet 'Data Pasien'. Satu baris = satu kasus. Semua proses berjalan lokal di browser dan tidak disimpan otomatis.";
  instructions.getCell("A3").alignment = { wrapText: true, vertical: "middle" };
  instructions.getRow(3).height = 42;
  instructions.addRow([]);
  instructions.addRow(["Kolom", "Keterangan"]);
  styleHeader(instructions.getRow(5));
  for (const column of BATCH_COLUMNS) instructions.addRow([column, COLUMN_DESCRIPTIONS[column]]);
  instructions.getColumn(1).width = 36;
  instructions.getColumn(2).width = 80;
  instructions.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  const dataSheet = workbook.addWorksheet(BATCH_SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  dataSheet.addRow([...BATCH_COLUMNS]);
  styleHeader(dataSheet.getRow(1));
  dataSheet.autoFilter = { from: "A1", to: "Q1" };
  dataSheet.addRow([
    "CONTOH-1",
    "Gentamisin",
    32,
    0,
    3,
    1.5,
    "",
    "",
    "Tidak",
    "Tidak",
    "Tidak",
    "",
    "",
    "",
    "",
    7.5,
    36,
  ]);
  dataSheet.addRow([
    "CONTOH-2",
    "Vankomisin",
    38,
    0,
    7,
    3.1,
    0.6,
    1.5,
    "Tidak",
    "Tidak",
    "Ya",
    31,
    31,
    12,
    12,
    31,
    12,
  ]);
  for (let row = 2; row <= 1001; row += 1) {
    dataSheet.getCell(row, 2).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"Gentamisin,Amikasin,Vankomisin"'],
    };
    for (const column of [9, 10, 11]) {
      dataSheet.getCell(row, column).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Ya,Tidak"'],
      };
    }
  }
  setUsefulWidths(dataSheet, 34);

  const buffer = await workbook.xlsx.writeBuffer();
  return workbookBytes(buffer);
}

export async function downloadBatchTemplate(): Promise<void> {
  downloadBytes(await buildBatchTemplateWorkbook(), "template-batch-pustakaobat.xlsx");
}

export async function buildBatchResultWorkbook(result: BatchProcessingResult): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PustakaObat.id";
  workbook.created = new Date();


  const statistics = summarizeBatch(result);
  const fmt = (value: number | null) => value === null || !Number.isFinite(value) ? "" : value;
  const capitalizeLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  const addHeader = (sheet: import("exceljs").Worksheet, headers: string[]) => {
    sheet.addRow(headers); styleHeader(sheet.getRow(1));
    sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 2 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  };
  const values = workbook.addWorksheet("Hasil per Pasien");
  const successful = result.rows.filter((row): row is BatchSuccessRow => row.status === "berhasil");
  const publicHeaders = ["Kode Pasien","Antibiotik","Usia Gestasi (mgg)","Usia Pascalahir (hari)","PMA (mgg)","Berat (kg)","Fungsi Ginjal","Dosis RS (mg)","Frek RS","Dosis Literatur (mg)","Frek Literatur","Dosis Manual (mg)","Frek Manual","Dosis Aktual (mg)","Dosis Aktual (mg/kg/dosis)","Frek Aktual","Aktual vs RS (dosis)","Aktual vs RS (frek)","Aktual vs Literatur (dosis)","Aktual vs Literatur (frek)","Manual vs RS (dosis)","Manual vs RS (frek)","Manual vs Literatur (dosis)","Manual vs Literatur (frek)"];
  addHeader(values, publicHeaders);
  for (const row of successful) {
    const record = notebookBatchRecord(row);
    values.addRow(publicHeaders.map(key => record[key]));
  }
  setUsefulWidths(values, 40);
  const summary = workbook.addWorksheet("Ringkasan Kesesuaian");
  addHeader(summary, ["Kelompok", "Metrik", "Referensi", "Kategori", "Jumlah", "N dapat dinilai", "Persentase"]);
  for(const c of statistics.counts.filter(count => count.category !== "opsi-diskrit-tidak-cocok"))
    summary.addRow([capitalizeLabel(c.group),c.metric,c.reference,capitalizeLabel(c.category),c.count,c.total,c.percent / 100]);
  summary.getColumn(7).numFmt = "0.0%"; setUsefulWidths(summary,38);
  const tests = workbook.addWorksheet("Analisis Statistik");
  addHeader(tests, ["Kelompok","Metrik","Referensi","n","Shapiro-Wilk W","Shapiro p","Uji Berpasangan","Statistik","p dua sisi","Median selisih","Satuan","Kesimpulan","Catatan"]);
  for(const p of statistics.paired.filter(test => test.group !== "Keseluruhan")) {
    const available = p.n >= 3 && p.pValue !== null && Number.isFinite(p.pValue);
    const conclusion = !available ? (p.n < 3 ? "Tidak diuji (n<3)" : "Tidak dapat diuji")
      : p.pValue! < 0.05 ? "Berbeda signifikan (p<0,05)" : "Tidak berbeda signifikan (p≥0,05)";
    const row = tests.addRow([capitalizeLabel(p.group),p.metric,p.reference,p.n,fmt(p.shapiroW),fmt(p.shapiroP),p.method,fmt(p.statistic),fmt(p.pValue),available ? fmt(p.medianDifference) : "",p.metric.startsWith("Dosis") ? "mg/kg" : "dosis/hari",conclusion,p.note]);
    for (const column of [5, 6, 9]) row.getCell(column).numFmt = "0.0000";
    for (const column of [8, 10]) row.getCell(column).numFmt = "0.000";
    row.getCell(12).alignment = { wrapText: true, vertical: "middle" };
    row.eachCell(cell => { cell.alignment = { ...cell.alignment, vertical: "middle" }; });
    row.height = 32;
  }
  tests.addRow([]);
  const start = tests.rowCount + 1;
  tests.addRow(["McNemar: Kelompok","Metrik","N pasangan","Sesuai keduanya","Hanya RS","Hanya Literatur","Tidak sesuai keduanya","Uji","Statistik","p dua sisi","Kesimpulan"]);
  styleHeader(tests.getRow(start));
  for(const p of statistics.mcnemar) {
    const conclusion = p.pValue === null || !Number.isFinite(p.pValue) ? "Tidak dapat diuji"
      : p.pValue < 0.05 ? "Proporsi kesesuaian BERBEDA signifikan antara RS & Literatur (p<0,05)"
        : "Proporsi kesesuaian TIDAK berbeda signifikan (p≥0,05)";
    const row = tests.addRow([capitalizeLabel(p.group),p.metric,p.n,p.both,p.rsOnly,p.literatureOnly,p.neither,p.method,fmt(p.statistic),fmt(p.pValue),conclusion]);
    row.getCell(9).numFmt = "0.000";
    row.getCell(10).numFmt = "0.0000";
    row.getCell(11).alignment = { wrapText: true, vertical: "middle" };
    row.eachCell(cell => { cell.alignment = { ...cell.alignment, vertical: "middle" }; });
    row.height = Math.max(32, Math.ceil(conclusion.length / 38) * 16 + 8);
  }
  setUsefulWidths(tests,42);
  const interpretation = workbook.addWorksheet("Interpretasi & Kesimpulan");
  interpretation.addRows([
    ["Ringkasan Analisis Batch","Ringkasan kesesuaian, analisis statistik, dan interpretasi hasil batch."],
    ["Kandidat",result.candidateRows],["Berhasil",result.successCount],["Gagal",result.errorCount],
    ["Baris contoh diabaikan",result.ignoredRows],["Versi aturan",CALCULATOR_RULE_VERSION],
  ]);
  interpretation.getColumn(1).width = 32;
  interpretation.getColumn(2).width = 92;
  interpretation.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  interpretation.getRow(1).height = 36;
  interpretation.views = [{ showGridLines: false }];
  for (const section of buildBatchInterpretation(result, statistics)) {
    interpretation.addRow([]);
    const heading = interpretation.addRow([section.title]);
    interpretation.mergeCells(heading.number, 1, heading.number, 2);
    styleHeader(heading);
    for (const paragraph of section.paragraphs) {
      const row = interpretation.addRow([paragraph.text]);
      interpretation.mergeCells(row.number, 1, row.number, 2);
      const cell = row.getCell(1);
      cell.alignment = { wrapText: true, vertical: "top" };
      cell.font = { size: 11, bold: paragraph.kind === "penting" };
      if (paragraph.kind === "penting") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
      }
      row.height = Math.max(34, Math.ceil(paragraph.text.length / 100) * 17 + 10);
    }
  }
  const warnings = workbook.addWorksheet("Peringatan");
  addHeader(warnings,["Baris sumber","Kode pasien","Kategori","Catatan"]);
  for (const row of result.rows) {
    if(row.status==="gagal") addWarningRow(warnings, row.sourceRow, row.patientCode, "critical", "Baris dilewati: " + row.errors.join(" | "));
    else {
      for(const warning of row.warnings) addWarningRow(warnings, row.sourceRow, row.patientCode, "warning", "Peringatan data: " + warning);
      const seenWarnings = new Set<string>();
      for(const warning of [...row.calculator.globalWarnings,...row.calculator.recommendations.institutionalPrimary.warnings,...row.calculator.recommendations.anmf2024.warnings]) {
        const key = JSON.stringify([warning.severity, warning.message]);
        if (seenWarnings.has(key)) continue;
        seenWarnings.add(key);
        addWarningRow(warnings, row.sourceRow, row.patientCode, warning.severity, warning.message);
      }
    }
  }
  setUsefulWidths(warnings,75);
  const abbreviations = workbook.addWorksheet("Keterangan Singkatan");
  addHeader(abbreviations,["Singkatan","Kepanjangan"]);
  abbreviations.addRows([
    ["RS","Rumah Sakit"],["RSUP","Rumah Sakit Umum Pusat"],["SPO","Standar Prosedur Operasional"],
    ["PNPK","Pedoman Nasional Pelayanan Kedokteran"],["ANMF","Australasian Neonatal Medicines Formulary"],
    ["UNC","University of North Carolina Medical Center"],["PMA","Usia pascamenstruasi"],
    ["SCr","Kreatinin serum"],["UOP","Produksi urin"],["DPJP","Dokter penanggung jawab pasien"],
    ["HIE","Ensefalopati hipoksik-iskemik"],["COX","Siklooksigenase"],["MRSA","Staphylococcus aureus resisten metisilin"],
    ["TDM","Therapeutic Drug Monitoring"]
  ]);
  setUsefulWidths(abbreviations,65);
  const buffer = await workbook.xlsx.writeBuffer();
  return workbookBytes(buffer);
}

export async function downloadBatchResult(result: BatchProcessingResult): Promise<void> {
  downloadBytes(await buildBatchResultWorkbook(result), `hasil-batch-pustakaobat-${timestamp()}.xlsx`);
}
