import {
  ANTIBIOTIC_LABELS,
  BATCH_COLUMNS,
  BATCH_SHEET_NAME,
  CALCULATOR_RULE_VERSION,
  formatInterval,
  type BatchProcessingResult,
  type BatchSuccessRow,
} from ".";

const COLUMN_DESCRIPTIONS: Record<(typeof BATCH_COLUMNS)[number], string> = {
  kode_pasien: "Kode kasus unik tanpa identitas langsung. Wajib.",
  antibiotik: "Gentamisin, Amikasin, atau Vankomisin. Wajib.",
  usia_gestasi_lahir_minggu: "Usia gestasi saat lahir dalam minggu. Wajib.",
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

function recommendationCells(row: BatchSuccessRow, key: keyof BatchSuccessRow["calculator"]["recommendations"]): unknown[] {
  const recommendation = row.calculator.recommendations[key];
  const actual = row.actualEvaluation.targets.find(
    (target) => target.recommendationId === recommendation.id,
  );
  const manual = row.manualEvaluation?.targets.find(
    (target) => target.recommendationId === recommendation.id,
  );
  return [
    recommendation.dose.minTotalMg,
    recommendation.dose.maxTotalMg,
    formatInterval(recommendation.interval),
    actual?.actualDose.status ?? "tidak-dapat-dievaluasi",
    actual?.actualDose.message ?? "Tidak tersedia",
    actual?.actualInterval.status ?? "tidak-dapat-dievaluasi",
    actual?.actualInterval.message ?? "Tidak tersedia",
    manual?.manualDose.lowerBound?.message ?? "Tidak diisi",
    manual?.manualDose.upperBound?.message ?? "Tidak diisi/tidak berlaku",
    manual?.manualInterval.lowerBound?.message ?? "Tidak diisi",
    manual?.manualInterval.upperBound?.message ?? "Tidak diisi/tidak berlaku",
  ];
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
  workbook.creator = "Apoteq";
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
  dataSheet.autoFilter = { from: "A1", to: "P1" };
  dataSheet.addRow([
    "CONTOH-1",
    "Gentamisin",
    32,
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
    for (const column of [8, 9, 10]) {
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
  downloadBytes(await buildBatchTemplateWorkbook(), "template-batch-apoteq.xlsx");
}

export async function buildBatchResultWorkbook(result: BatchProcessingResult): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Apoteq";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Ringkasan");
  summary.addRow(["HASIL EVALUASI BATCH APOTEQ"]);
  summary.mergeCells("A1:B1");
  summary.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  summary.addRows([
    [],
    ["Diproses pada", new Date().toLocaleString("id-ID")],
    ["Versi aturan", CALCULATOR_RULE_VERSION],
    ["Baris kandidat", result.candidateRows],
    ["Berhasil", result.successCount],
    ["Gagal validasi", result.errorCount],
    ["Berhasil dengan peringatan data", result.warningCount],
    ["Baris contoh diabaikan", result.ignoredRows],
    [],
    ["Catatan", "Hasil merupakan clinical decision support; verifikasi klinis dan pedoman institusi tetap diperlukan."],
  ]);
  summary.getColumn(1).width = 28;
  summary.getColumn(2).width = 88;
  summary.getColumn(2).alignment = { wrapText: true };

  const outputHeaders = [
    "baris_sumber",
    "kode_pasien",
    "antibiotik",
    "usia_gestasi_lahir_minggu",
    "usia_pascalahir_hari",
    "pma_minggu",
    "berat_badan_kg",
    "kreatinin_serum_mg_dl",
    "produksi_urin_ml_kg_jam",
    "dosis_aktual_mg",
    "frekuensi_aktual_jam",
    ...["utama", "pembanding_usia", "anmf_2024"].flatMap((prefix) => [
      `${prefix}_dosis_min_mg`,
      `${prefix}_dosis_max_mg`,
      `${prefix}_interval`,
      `${prefix}_status_dosis_aktual`,
      `${prefix}_pesan_dosis_aktual`,
      `${prefix}_status_interval_aktual`,
      `${prefix}_pesan_interval_aktual`,
      `${prefix}_manual_dosis_batas_bawah`,
      `${prefix}_manual_dosis_batas_atas`,
      `${prefix}_manual_interval_batas_bawah`,
      `${prefix}_manual_interval_batas_atas`,
    ]),
    "peringatan_data_input",
    "peringatan_klinis",
    "versi_aturan",
  ];
  const resultsSheet = workbook.addWorksheet("Hasil Evaluasi", {
    views: [{ state: "frozen", ySplit: 1, xSplit: 2 }],
  });
  resultsSheet.addRow(outputHeaders);
  styleHeader(resultsSheet.getRow(1));
  for (const row of result.rows) {
    if (row.status !== "berhasil") continue;
    const input = row.calculator.input;
    resultsSheet.addRow([
      row.sourceRow,
      row.patientCode,
      ANTIBIOTIC_LABELS[input.antibiotic],
      input.gestationalAgeWeeks,
      input.postnatalAgeDays,
      row.calculator.pmaWeeks,
      input.currentWeightKg,
      input.serumCreatinineMgDl ?? "",
      input.urineOutputMlKgHour ?? "",
      row.actualEvaluation.actualDoseMg,
      row.actualEvaluation.actualIntervalHours ?? "",
      ...recommendationCells(row, "institutionalPrimary"),
      ...recommendationCells(row, "institutionalAgeComparator"),
      ...recommendationCells(row, "anmf2024"),
      row.warnings.join(" | "),
      [...row.calculator.globalWarnings, ...Object.values(row.calculator.recommendations).flatMap((item) => item.warnings)]
        .map((warning) => warning.message)
        .join(" | "),
      row.calculator.calculatorRuleVersion,
    ]);
  }
  resultsSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: outputHeaders.length } };
  setUsefulWidths(resultsSheet, 48);

  const errorsSheet = workbook.addWorksheet("Kesalahan", { views: [{ state: "frozen", ySplit: 1 }] });
  errorsSheet.addRow(["baris_sumber", "kode_pasien", "kesalahan"]);
  styleHeader(errorsSheet.getRow(1));
  for (const row of result.rows) {
    if (row.status === "gagal") errorsSheet.addRow([row.sourceRow, row.patientCode, row.errors.join(" | ")]);
  }
  setUsefulWidths(errorsSheet, 80);

  const warningsSheet = workbook.addWorksheet("Peringatan Data", { views: [{ state: "frozen", ySplit: 1 }] });
  warningsSheet.addRow(["baris_sumber", "kode_pasien", "peringatan", "dampak"]);
  styleHeader(warningsSheet.getRow(1));
  for (const row of result.rows) {
    if (row.status === "berhasil" && row.warnings.length > 0) {
      warningsSheet.addRow([
        row.sourceRow,
        row.patientCode,
        row.warnings.join(" | "),
        "Evaluasi aktual tetap diproses; pembanding manual diabaikan.",
      ]);
    }
  }
  setUsefulWidths(warningsSheet, 80);

  const buffer = await workbook.xlsx.writeBuffer();
  return workbookBytes(buffer);
}

export async function downloadBatchResult(result: BatchProcessingResult): Promise<void> {
  downloadBytes(await buildBatchResultWorkbook(result), `hasil-batch-apoteq-${timestamp()}.xlsx`);
}
