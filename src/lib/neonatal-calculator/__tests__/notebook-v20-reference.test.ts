import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadV20Reference, referenceRoot } from "../../../../tests/helpers/neonatal-v20-reference";
import { processBatchTable } from "../batch-engine";
import { buildBatchResultWorkbook } from "../batch-workbook";
import { summarizeBatch } from "../batch-statistics";
import { intervalBounds, notebookBatchRecord, rangeDeviation } from "../notebook-results";
import { calculateRecommendations } from "../recommendation-engine";
import { getV20ClinicalWarnings, getDisplayV20Warnings, sortV20Warnings } from "../warning-catalog-v20";
import { buildV20Glossary } from "../glossary-v20";

const oracle = loadV20Reference();

const v20RejectedCases = [
  {
    code: "T31",
    sourceRow: 32,
    column: "usia_pascalahir_hari",
    rawValue: 29,
    reason: "Usia pascalahir di luar cakupan kalkulator (0–28 hari). Gunakan pedoman dosis bayi di atas 28 hari.",
  },
  {
    code: "T32",
    sourceRow: 33,
    column: "berat_badan_kg",
    rawValue: 1720,
    reason: "Berat badan harus 0,3–10 kg. Tampaknya berat diisi dalam gram; isi dalam kilogram (mis. 1720 g = 1,72 kg).",
  },
  {
    code: "T33",
    sourceRow: 34,
    column: "usia_gestasi_lahir_hari",
    rawValue: 7,
    reason: "Usia gestasi saat lahir — tambahan hari harus 0–6 hari dan usia gestasi total maksimal 43 minggu.",
  },
  {
    code: "T34",
    sourceRow: 35,
    column: "antibiotik",
    rawValue: "Gentamycin",
    reason: "Antibiotik harus Gentamisin, Amikasin, atau Vankomisin.",
  },
] as const;

describe("frozen v20 reference integrity and unchanged dosing", () => {
  it("pins the original notebook, two XLSX files, and review document bytes", () => {
    const hashes = {
      notebook: "d78513e5ab8cd728dc230ad7f662d06378040707e2ab08daffcaf6d237917651",
      input: "05a52548cad9d20fdaee1ee8b1c7540b6a513785c5250bd570522ebe9864f860",
      comparator: "f0dab30f11fbfb16b2e5949456576effed52a8de630296269cf856e1d0243f31",
      review: "f5c1f3a6e7c83d3e4b7d6be307d1930d4e6ec3dd7a90859be5b347f4fca5c782",
    };
    expect(Object.keys(oracle.source.files).sort()).toEqual(Object.keys(hashes).sort());
    for (const [role, expected] of Object.entries(hashes)) {
      const entry = oracle.source.files[role];
      const bytes = readFileSync(join(referenceRoot, entry.path));
      expect(bytes.byteLength).toBe(entry.bytes);
      expect(createHash("sha256").update(bytes).digest("hex"), role).toBe(expected);
      expect(entry.actualSha256, role).toBe(expected);
      expect(entry.sha256, role).toBe(expected);
    }
    expect(oracle.source.manifestSha256).toBe(createHash("sha256").update(readFileSync(join(referenceRoot, "manifest.json"))).digest("hex"));
  });

  it("executes all 113 original notebook checks under the v20 rule version", () => {
    expect(oracle.source.ruleVersion).toBe("2026.11.03");
    expect(oracle.source.executedCells).toEqual([3, 5, 6, 8, 10, 14, 18]);
    expect(oracle.source.runtime.scipy).toBe("1.17.1");
    expect(oracle.notebookChecks).toHaveLength(113);
    expect(oracle.notebookChecks.filter(check => check.Status !== "LULUS")).toEqual([]);
  });

  it("reconciles all 720 expected Excel cells with executed Python, excluding the test-purpose annotation", () => {
    expect(oracle.inputRows).toHaveLength(34);
    expect(oracle.batchRecords).toHaveLength(30);
    expect(oracle.publicHeaders).toHaveLength(24);
    expect(oracle.comparator.comparedCells).toBe(720);
    expect(oracle.comparator.differences).toEqual([]);
    expect(oracle.comparator.headers.filter(key => !oracle.publicHeaders.includes(key))).toEqual(["Tujuan uji"]);
    expect(oracle.comparator.checkedHeaders).toHaveLength(22);
    expect(new Set(oracle.comparator.checkedHeaders).size).toBe(22);
    expect(oracle.comparator.checkedHeaders).toEqual(oracle.publicHeaders.filter(key => !["Kode Pasien", "Berat Badan (kg)"].includes(key)));
    expect(oracle.comparator.checkedHeaders).not.toContain("Berat Badan (kg)");
    expect(oracle.comparator.pastedWebRows).toBe(0);
    for (const row of oracle.comparator.rows) {
      const expected = Object.fromEntries(oracle.comparator.headers.map((header, index) => [header, row[index]]));
      const actual = oracle.batchRecords.find(record => record["Kode Pasien"] === expected["Kode Pasien"]);
      expect(actual).toBeDefined();
      for (const header of oracle.publicHeaders) expect(actual![header], String(expected["Kode Pasien"]) + ": " + header).toEqual(expected[header]);
    }
  });

  it("uses the original XLSX input to reproduce valid and rejected patient IDs in the application", () => {
    const result = processBatchTable([oracle.header, ...oracle.inputRows]);
    expect(result.rows.filter(row => row.status === "berhasil").map(row => row.patientCode)).toEqual(oracle.batchRecords.map(row => row["Kode Pasien"]));
    expect(result.rows.filter(row => row.status === "gagal").map(row => row.patientCode)).toEqual(oracle.comparator.rejectedCodes);
    expect(oracle.comparator.rejectedCodes).toEqual(["T31", "T32", "T33", "T34"]);
    expect(oracle.batchWarnings).toHaveLength(4);
  });

  it.each(v20RejectedCases)("rejects original XLSX case $code with its exact validation reason", ({code, sourceRow, column, rawValue, reason}) => {
    // Read the immutable XLSX through the Python notebook oracle, not a transcribed test copy.
    const inputColumn = oracle.header.indexOf(column);
    expect(inputColumn, code + ": missing frozen XLSX column").toBeGreaterThanOrEqual(0);
    const input = oracle.inputRows.find(row => row[oracle.header.indexOf("kode_pasien")] === code);
    expect(input, code + ": missing input row").toBeDefined();
    expect(input![inputColumn], code + ": unexpected input value").toBe(rawValue);

    const batch = processBatchTable([oracle.header, ...oracle.inputRows]);
    expect(batch.successCount).toBe(30);
    expect(batch.errorCount).toBe(4);
    const rejected = batch.rows.find(row => row.patientCode === code);
    expect(rejected?.status, code).toBe("gagal");
    if (rejected?.status !== "gagal") throw new Error(code + ": rejected case is absent");
    expect(rejected.sourceRow).toBe(sourceRow);
    expect(rejected.errors).toEqual([reason]);
  });

  it("exports the exact four rejection reasons to XLSX without exporting rejected patients as results", async () => {
    const batch = processBatchTable([oracle.header, ...oracle.inputRows]);
    const ExcelJS = await import("exceljs");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(new Uint8Array(await buildBatchResultWorkbook(batch)) as unknown as import("exceljs").Buffer);

    const warningSheet = book.getWorksheet("Peringatan")!;
    const errorCodes = new Set(v20RejectedCases.map(item => item.code));
    const errorRows = warningSheet.getRows(2, warningSheet.rowCount - 1)!.filter(row =>
      errorCodes.has(String(row.getCell(2).value)));
    expect(errorRows).toHaveLength(4);
    for (const item of v20RejectedCases) {
      const row = errorRows.find(row => row.getCell(2).value === item.code);
      expect(row, item.code + ": missing exported warning").toBeDefined();
      expect(row!.getCell(1).value).toBe(item.sourceRow);
      expect(row!.getCell(3).value).toBe("PERINGATAN");
      expect(row!.getCell(4).value).toBe("Baris dilewati: " + item.reason);
    }
    const resultSheet = book.getWorksheet("Hasil per Pasien")!;
    expect(resultSheet.rowCount).toBe(31); // 30 valid patients + header
    for (const row of resultSheet.getRows(2, 30)!) {
      expect(errorCodes.has(String(row.getCell(1).value))).toBe(false);
    }
  });

  it("preserves v20 dose and interval values for 30 supplied patients and 1,242 boundary/renal profiles", () => {
    expect(oracle.batchRecommendations).toHaveLength(30);
    expect(oracle.recommendations).toHaveLength(1242);
    const failures: unknown[] = [];
    for (const { input, expected } of [...oracle.batchRecommendations, ...oracle.recommendations]) {
      const result = calculateRecommendations(input);
      for (const [actual, dose, interval] of [
        [result.recommendations.institutionalPrimary, expected.rsDose, expected.rsInterval],
        [result.recommendations.anmf2024, expected.litDose, expected.litInterval],
      ] as const) {
        if (!Number.isFinite(actual.dose.minTotalMg) || !Number.isFinite(actual.dose.maxTotalMg)
            || Math.abs(actual.dose.minTotalMg! - dose[0]) > 1e-8 || Math.abs(actual.dose.maxTotalMg! - dose[1]) > 1e-8
            || JSON.stringify(intervalBounds(actual.interval)) !== JSON.stringify(interval)) {
          failures.push({ input, reference: actual.id, dose: actual.dose, interval: intervalBounds(actual.interval), expected: { dose, interval } });
        }
      }
    }
    expect(failures.length, JSON.stringify(failures.slice(0, 5))).toBe(0);
  });

  it("matches the full v20 warning catalogue on 30 supplied and 1,242 boundary/renal profiles", () => {
    const profiles = [...oracle.batchRecommendations,...oracle.recommendations];
    expect(profiles).toHaveLength(1272);
    for (const profile of profiles) {
      const result = calculateRecommendations(profile.input);
      const actual = getV20ClinicalWarnings(result).map(({severity,title,message}) => ({severity,title,message}));
      const displayed = getDisplayV20Warnings(result).map(({severity,title,message}) => ({severity,title,message}));
      expect(actual, JSON.stringify(profile.input)).toEqual(profile.expected.warningDetails);
      expect(displayed, JSON.stringify(profile.input)).toEqual(profile.expected.warningDetails);
    }
  });

  it("preserves distinct warning messages and severity even with the same code", () => {
    const w = {code:"X",severity:"critical" as const,title:"Periksa",message:"Satu"};
    const items = sortV20Warnings([{...w,severity:"info"},{...w},{...w},{...w,message:"Dua"},{...w,severity:"warning"}]);
    expect(items.map(x=>x.severity)).toEqual(["critical","critical","warning","info"]);
    expect(items.map(x=>x.message)).toEqual(["Satu","Dua","Satu","Satu"]);
  });

  it("exports each v20 clinical warning once with source row, category, and existing colors", async () => {
    const batch = processBatchTable([oracle.header,...oracle.inputRows]);
    const ExcelJS = await import("exceljs");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(new Uint8Array(await buildBatchResultWorkbook(batch)) as unknown as import("exceljs").Buffer);
    const sheet = book.getWorksheet("Peringatan")!;
    const expected = oracle.batchRecords.flatMap(record => (record._peringatan as [string,string][]).map(([category,text]) => [record._baris,record["Kode Pasien"],category,text]));
    const validCodes = new Set(oracle.batchRecords.map(record => record["Kode Pasien"]));
    const actual: unknown[][] = [];
    sheet.eachRow((row,index) => {
      if (index === 1) return;
      const label = String(row.getCell(3).value);
      const palette = {PERINGATAN:["FFB02A37","FFF8D7DA"],PERHATIAN:["FF9A6700","FFFFF3CD"],INFORMASI:["FF0B5ED7","FFE7F1FF"]}[label]!;
      expect(row.getCell(3).font.color?.argb).toBe(palette[0]);
      expect(row.getCell(3).fill).toMatchObject({type:"pattern",fgColor:{argb:palette[1]}});
      expect(row.getCell(4).alignment.wrapText).toBe(true);
      if (validCodes.has(row.getCell(2).value)) {
        actual.push([1,2,3,4].map(column => row.getCell(column).value));
      } else {
        const source = Number(row.getCell(1).value);
        expect(oracle.inputRows[source-2][0]).toBe(row.getCell(2).value);
        expect(label).toBe("PERINGATAN");
        const text = String(row.getCell(4).value);
        expect(text).toMatch(/^Baris dilewati: .+/);
        expect(text.match(/dilewati/gi)).toHaveLength(1);
      }
    });
    expect(actual).toEqual(expected);
    expect(new Set(actual.map(row => JSON.stringify(row))).size).toBe(actual.length);
    expect(sheet.rowCount).toBe(expected.length+4+1);
  });

  it.each(oracle.glossary.cases)("matches the notebook glossary selection and wording: $name", ({text,rows}) => {
    expect(buildV20Glossary(text)).toEqual(rows);
  });

  it("exports only used abbreviations and all five v20 terms in the actual XLSX", async () => {
    const ExcelJS = await import("exceljs");
    for (const table of [[oracle.header,...oracle.inputRows],[oracle.header]]) {
      const batch = processBatchTable(table);
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(new Uint8Array(await buildBatchResultWorkbook(batch)) as unknown as import("exceljs").Buffer);
      const sheet = book.getWorksheet("Keterangan Singkatan")!;
      expect([sheet.getRow(1).getCell(1).value,sheet.getRow(1).getCell(2).value]).toEqual(oracle.glossary.headers);
      const text: string[] = [];
      for (const other of book.worksheets.filter(other => other !== sheet)) other.eachRow(row => row.eachCell(cell => {
        if (typeof cell.value === "string") text.push(cell.value);
      }));
      const content = text.join(" ");
      const rows: unknown[][] = [];
      sheet.eachRow((row,index) => {
        if (index === 1) return;
        rows.push([row.getCell(1).value,row.getCell(2).value]);
        expect(row.getCell(2).alignment.wrapText).toBe(true);
      });
      expect(rows.slice(-5)).toEqual(oracle.glossary.terms);
      const expected = oracle.glossary.abbreviations.filter(([short]) => new RegExp(`(?<![A-Za-z0-9])${short}(?![A-Za-z0-9])`).test(content))
        .map(([short,meaning,note]) => [short,meaning+(note ? ` (${note})` : "")]);
      expect(rows.slice(0,-5)).toEqual(expected);
      expect(rows.some(row => row[0] === "MRSA")).toBe(false);
      expect(rows.some(row => row[0] === "HIE")).toBe(false);
      if (batch.successCount === 30) expect(rows).toEqual(oracle.glossary.originalRows);
    }
  });

  it("matches all eight v20 deviation fields for each supplied patient", () => {
    const result = processBatchTable([oracle.header, ...oracle.inputRows]);
    for (const row of result.rows) {
      if (row.status !== "berhasil") continue;
      const actual = notebookBatchRecord(row);
      const expected = oracle.batchRecords.find(record => record["Kode Pasien"] === row.patientCode)!;
      const keys = Object.keys(expected).filter(key => key.startsWith("_dev_"));
      expect(keys).toHaveLength(8);
      for (const key of keys) {
        const a = actual[key], b = expected[key];
        if (typeof b === "number") {
          expect(typeof a, `${row.patientCode} ${key}`).toBe("number");
          expect(a as number, `${row.patientCode} ${key}`).toBeCloseTo(b, 10);
        } else expect(a, `${row.patientCode} ${key}`).toBeNull();
      }
    }
  });

  it("preserves absent renal data, measured zeros, and UNC conclusions in the exported XLSX", async () => {
    const profiles = oracle.renalExport;
    expect(profiles.rows).toHaveLength(63);
    const batch = processBatchTable([oracle.header, ...profiles.rows]);
    expect(batch.errorCount).toBe(0);
    expect(batch.successCount).toBe(63);
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const buffer = await buildBatchResultWorkbook(batch);
    await workbook.xlsx.load(new Uint8Array(buffer) as unknown as import("exceljs").Buffer);
    const sheet = workbook.getWorksheet("Hasil per Pasien")!;
    const renalColumn = Array.from({ length: sheet.columnCount }, (_, index) => sheet.getRow(1).getCell(index + 1).value).indexOf("Fungsi Ginjal") + 1;
    expect(renalColumn).toBeGreaterThan(0);
    const exported = new Map<string, unknown>();
    for (const row of batch.rows) {
      if (row.status !== "berhasil") throw new Error("Expected valid renal profile");
      const expected = profiles.records.find(record => record["Kode Pasien"] === row.patientCode)!;
      const text = notebookBatchRecord(row)["Fungsi Ginjal"];
      expect(text, row.patientCode).toBe(expected["Fungsi Ginjal"]);
      const excelRow = sheet.getRows(2, batch.successCount)!.find(value => value.getCell(1).value === row.patientCode)!;
      expect(excelRow.getCell(renalColumn).value, row.patientCode).toBe(expected["Fungsi Ginjal"]);
      exported.set(row.patientCode, text);
    }
    expect(exported.get("renal-0")).toBe("Tidak diisi (diasumsikan normal sesuai usia)");
    expect(exported.get("renal-1")).toBe("SCr 0 mg/dL; produksi urin tidak diisi: tidak memenuhi kriteria gangguan ginjal UNC");
    expect(exported.get("renal-2")).toBe("SCr 0 mg/dL; produksi urin 0 mL/kg/jam: tidak memenuhi kriteria gangguan ginjal UNC");
    expect(exported.get("renal-7")).toBe("SCr 0,5 mg/dL; produksi urin 0 mL/kg/jam: memenuhi kriteria gangguan ginjal UNC");
    expect(exported.get("renal-9")).toBe("SCr 0,5 mg/dL; produksi urin 1 mL/kg/jam: tidak memenuhi kriteria gangguan ginjal UNC");
    expect(exported.get("renal-14")).toBe("SCr 1 mg/dL; produksi urin 1 mL/kg/jam: memenuhi kriteria gangguan ginjal UNC");
    expect(exported.get("renal-16")).toBe("SCr 1,01 mg/dL; produksi urin tidak diisi: memenuhi kriteria gangguan ginjal UNC");
  });

  it("matches manual point/range categories and full text against Python and exported XLSX", async () => {
    const profiles = oracle.manualExport;
    expect(profiles.rows).toHaveLength(540);
    const batch = processBatchTable([oracle.header, ...profiles.rows]);
    expect(batch.errorCount).toBe(0);
    expect(batch.successCount).toBe(540);
    const ExcelJS = await import("exceljs");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(new Uint8Array(await buildBatchResultWorkbook(batch)) as unknown as import("exceljs").Buffer);
    const sheet = book.getWorksheet("Hasil per Pasien")!;
    const headers = Array.from({ length: sheet.columnCount }, (_, index) => String(sheet.getRow(1).getCell(index+1).value));
    const exportedRows = new Map(Array.from({ length: batch.successCount }, (_, index) => [sheet.getRow(index+2).getCell(1).value, sheet.getRow(index+2)]));
    const fields = ["Dosis Hitung Manual (mg)", "Frekuensi Hitung Manual", "Dosis Manual terhadap Pedoman RS", "Frekuensi Manual terhadap Pedoman RS", "Dosis Manual terhadap Literatur Terkini", "Frekuensi Manual terhadap Literatur Terkini"];
    const categories = ["_kma_rs", "_kma_lit", "_kmf_rs", "_kmf_lit"];
    const expectedRows = new Map(profiles.records.map(record => [record["Kode Pasien"],record]));
    const failures: unknown[] = [];
    for (const row of batch.rows) {
      if (row.status !== "berhasil") throw new Error("Expected valid manual profile");
      const actual = notebookBatchRecord(row), expected = expectedRows.get(row.patientCode)!;
      for (const key of [...fields,...categories]) {
        if (actual[key] !== expected[key]) failures.push({id:row.patientCode,field:key,actual:actual[key],expected:expected[key]});
      }
      const excelRow = exportedRows.get(row.patientCode)!;
      for (const key of fields) {
        const value = excelRow.getCell(headers.indexOf(key)+1).value;
        if (value !== expected[key]) failures.push({id:row.patientCode,field:key,excel:value,expected:expected[key]});
      }
    }
    expect(failures.length, JSON.stringify(failures.slice(0,8),null,2)).toBe(0);
    // A manual point still compares both bounds when the reference is a range.
    const singleRange = profiles.records.find(record => String(record["Kode Pasien"]).endsWith("-rs-single-inside") && String(record["Frekuensi Manual terhadap Pedoman RS"]).includes("paling jarang"))!;
    expect(singleRange).toBeDefined();
    expect(singleRange["Frekuensi Manual terhadap Pedoman RS"]).toContain("paling sering");
    expect(singleRange["Frekuensi Manual terhadap Pedoman RS"]).toContain("interval");
    expect(profiles.records.some(record => String(record["Dosis Manual terhadap Pedoman RS"]).startsWith("Berlebih: batas bawah lebih kecil"))).toBe(true);
    expect(profiles.records.some(record => String(record["Dosis Manual terhadap Literatur Terkini"]).includes("0,00%"))).toBe(true);
  });

  it("exports single-dose wording without creating a routine frequency or evaluable RS interval", async () => {
    const profiles = oracle.singleDoseExport;
    expect(profiles.rows.map(row => row[0])).toEqual([
      "single-T22-actual", "single-T22-no-actual",
      "single-T28-actual", "single-T28-no-actual",
      "single-T29-actual", "single-T29-no-actual",
    ]);
    const batch = processBatchTable([oracle.header,...profiles.rows]);
    expect(batch.successCount).toBe(6);
    expect(batch.errorCount).toBe(0);
    const ExcelJS = await import("exceljs");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(new Uint8Array(await buildBatchResultWorkbook(batch)) as unknown as import("exceljs").Buffer);
    const sheet = book.getWorksheet("Hasil per Pasien")!;
    const headers = Array.from({ length: sheet.columnCount }, (_, index) => String(sheet.getRow(1).getCell(index+1).value));
    for (const [index,row] of batch.rows.entries()) {
      if (row.status !== "berhasil") throw new Error("Expected valid single-dose profile");
      const expected = profiles.records.find(record => record["Kode Pasien"] === row.patientCode)!;
      const actual = notebookBatchRecord(row);
      for (const key of oracle.publicHeaders) {
        expect(actual[key], `${row.patientCode}: ${key}`).toBe(expected[key]);
        expect(sheet.getRow(index+2).getCell(headers.indexOf(key)+1).value, `${row.patientCode}: XLSX ${key}`).toBe(expected[key]);
      }
      const rs = row.calculator.recommendations.institutionalPrimary;
      expect(rs.interval.kind).toBe("single-dose-only");
      expect(rs.eligibleForRegimenEvaluation).toBe(false);
      expect(intervalBounds(rs.interval)).toEqual([null,null]);
      expect(actual["Frekuensi Pedoman RS"]).toBe("Dosis tunggal (bukan rutin)");
      expect(actual["Frekuensi Aktual terhadap Pedoman RS"]).toBe("-");
      expect(actual["Frekuensi Manual terhadap Pedoman RS"]).toBe("-");
      for (const key of ["_rs_freq_mid", "_dev_frek_aktual_RS", "_dev_frek_manual_RS"]) expect(actual[key], key).toBeNull();
      for (const key of ["_kfa_rs", "_kmf_rs"]) expect(actual[key], key).toBe("");
      expect(actual["Frekuensi Literatur Terkini"]).toMatch(/^tiap \d+ jam$/);
    }
    const rsFrequencyTests = summarizeBatch(batch).paired.filter(test => test.metric.startsWith("Frekuensi") && test.reference === "Pedoman Rumah Sakit");
    expect(rsFrequencyTests.length).toBeGreaterThan(0);
    for (const test of rsFrequencyTests) {
      expect(test.n).toBe(0);
      expect(test.pValue).toBeNull();
    }
  });

  it("respects v20 tolerance, missing values, and excess-first priority", () => {
    expect(rangeDeviation(null, 2, 1, 2)).toBeNull();
    expect(rangeDeviation(1, 2, 1, 2)).toBe(0);
    expect(rangeDeviation(1 - 0.5e-6, 2 + 0.5e-6, 1, 2)).toBe(0);
    expect(rangeDeviation(1 - 2e-6, 1, 1, 2)).toBeCloseTo(-2e-6, 12);
    expect(rangeDeviation(2, 2 + 2e-6, 1, 2)).toBeCloseTo(2e-6, 12);
    expect(rangeDeviation(0.5, 2.25, 1, 2)).toBeCloseTo(0.25, 12);
  });

  it.each([
    [22, 0, 0, "22 minggu", "22 minggu"],
    [29, 6, 0, "29 minggu 6 hari", "29 minggu 6 hari"],
    [29, 6, 1, "29 minggu 6 hari", "30 minggu"],
    [33, 0, 8, "33 minggu", "34 minggu 1 hari"],
    [29, 6, 28, "29 minggu 6 hari", "33 minggu 6 hari"],
  ] as const)("formats GA %s weeks + %s days and PNA %s without decimal PMA rounding", (weeks, days, pna, gaText, pmaText) => {
    const row = [...oracle.inputRows[0]];
    for (const [field,value] of [["usia_gestasi_lahir_minggu",weeks],["usia_gestasi_lahir_hari",days],["usia_pascalahir_hari",pna]] as const) row[oracle.header.indexOf(field)] = value;
    const batch = processBatchTable([oracle.header,row]);
    expect(batch.errorCount).toBe(0);
    const result = batch.rows[0];
    if (result.status !== "berhasil") throw new Error("Expected valid age profile");
    const record = notebookBatchRecord(result);
    expect(record["Usia Gestasi saat Lahir"]).toBe(gaText);
    expect(record["Usia Pascamenstruasi (PMA)"]).toBe(pmaText);
  });
});
