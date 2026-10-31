import { notebookBatchRecord } from "./notebook-results";
import { summarizeBatch } from "./batch-statistics";
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
  for(const c of statistics.counts) summary.addRow([c.group,c.metric,c.reference,c.category,c.count,c.total,c.percent / 100]);
  summary.getColumn(7).numFmt = "0.0%"; setUsefulWidths(summary,38);
  const tests = workbook.addWorksheet("Analisis Statistik");
  addHeader(tests, ["Kelompok","Metrik","Referensi","n","Shapiro-Wilk W","Shapiro p","Uji Berpasangan","Statistik","p dua sisi","Catatan"]);
  for(const p of statistics.paired) tests.addRow([p.group,p.metric,p.reference,p.n,fmt(p.shapiroW),fmt(p.shapiroP),p.method,fmt(p.statistic),fmt(p.pValue),p.note]);
  tests.addRow([]);
  const start = tests.rowCount + 1;
  tests.addRow(["McNemar: Kelompok","Metrik","N pasangan","Sesuai keduanya","Hanya RS","Hanya Literatur","Tidak sesuai keduanya","Uji","Statistik","p dua sisi"]);
  styleHeader(tests.getRow(start));
  for(const p of statistics.mcnemar) tests.addRow([p.group,p.metric,p.n,p.both,p.rsOnly,p.literatureOnly,p.neither,p.method,fmt(p.statistic),fmt(p.pValue)]);
  setUsefulWidths(tests,42);
  const interpretation = workbook.addWorksheet("Interpretasi & Kesimpulan");
  interpretation.addRows([
    ["Ringkasan Analisis Batch","DRAF — hasil harus diverifikasi terhadap notebook acuan sebelum digunakan dalam penelitian/keputusan klinis"],
    ["Kandidat",result.candidateRows],["Berhasil",result.successCount],["Gagal",result.errorCount],
    ["Baris contoh diabaikan",result.ignoredRows],["Versi aturan",CALCULATOR_RULE_VERSION],
    ["Metode","Uji normalitas Shapiro–Wilk dilakukan pada selisih berpasangan, lalu paired t-test atau Wilcoxon; McNemar membandingkan status kesesuaian pasangan."],
    ["Frekuensi","Uji frekuensi dalam dosis per hari (24 / interval jam)."],
    ["Interpretasi","Nilai p < 0,05 dapat menunjukkan perbedaan statistik, bukan kesesuaian klinis. Hasil kosong berarti tidak dapat diuji."],
    ["Keamanan","Tidak ada data disimpan oleh aplikasi. Hindari identitas pasien dalam kode kasus."]
  ]);
  for(const p of statistics.paired.filter(x=>x.pValue!==null).slice(0,40))
    interpretation.addRow([p.group + " — " + p.metric, p.reference + ": " + p.method + "; n=" + p.n + "; p=" + String(p.pValue)]);
  interpretation.getColumn(1).width=38; interpretation.getColumn(2).width=110;
  interpretation.getColumn(2).alignment={wrapText:true};
  const warnings = workbook.addWorksheet("Peringatan");
  addHeader(warnings,["Baris sumber","Kode pasien","Kategori","Catatan"]);
  for (const row of result.rows) {
    if(row.status==="gagal") warnings.addRow([row.sourceRow,row.patientCode,"Baris dilewati",row.errors.join(" | ")]);
    else {
      for(const warning of row.warnings) warnings.addRow([row.sourceRow,row.patientCode,"Peringatan data",warning]);
      for(const warning of [...row.calculator.globalWarnings,...row.calculator.recommendations.institutionalPrimary.warnings,...row.calculator.recommendations.anmf2024.warnings])
        warnings.addRow([row.sourceRow,row.patientCode,warning.severity,warning.message]);
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
