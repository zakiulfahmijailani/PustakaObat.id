import { beforeAll, describe, expect, it } from "vitest";
import { Workbook, type Buffer as ExcelBuffer } from "exceljs";
import { loadV20Reference } from "./helpers/neonatal-v20-reference";
import { processBatchTable } from "../src/lib/neonatal-calculator/batch-engine";
import { buildBatchResultWorkbook } from "../src/lib/neonatal-calculator/batch-workbook";
import { summarizeBatch } from "../src/lib/neonatal-calculator/batch-statistics";
import { buildBatchInterpretation } from "../src/lib/neonatal-calculator/batch-interpretation";

const oracle = loadV20Reference();
const batch = processBatchTable([oracle.header, ...oracle.inputRows]);
const book = new Workbook();

beforeAll(async () => { await book.xlsx.load(Buffer.from(await buildBatchResultWorkbook(batch)) as unknown as ExcelBuffer); });

describe("v20 batch acceptance (remaining migration work must stay visible)", () => {
  it("exports the complete v20 patient column schema", () => {
    const sheet = book.getWorksheet("Hasil per Pasien")!;
    const headers = Array.from({ length: sheet.columnCount }, (_, index) => String(sheet.getRow(1).getCell(index + 1).value));
    expect(headers).toEqual(oracle.publicHeaders);
  });

  it("passes the supplied Cek patient/header matching rules on the actual application XLSX", () => {
    const sheet = book.getWorksheet("Hasil per Pasien")!;
    const headers = new Map(Array.from({ length: sheet.columnCount }, (_, index) => [String(sheet.getRow(1).getCell(index + 1).value), index + 1]));
    const rows = new Map(Array.from({ length: sheet.rowCount - 1 }, (_, index) => [String(sheet.getRow(index + 2).getCell(headers.get("Kode Pasien")!).value), index + 2]));
    const failures: unknown[] = [];
    expect([...rows.keys()].sort()).toEqual(oracle.comparator.rows.map(row => String(row[0])).sort());
    for (const row of oracle.comparator.rows) {
      const id = String(row[0]);
      for (const header of oracle.comparator.checkedHeaders) {
        const col = headers.get(header);
        const actual = col === undefined ? undefined : sheet.getRow(rows.get(id)!).getCell(col).value;
        const expected = row[oracle.comparator.headers.indexOf(header)];
        if (actual === undefined || String(actual ?? "").trim() !== String(expected ?? "").trim()) {
          failures.push({ id, header, status: col === undefined ? "TIDAK ADA" : "BEDA", actual, expected });
        }
      }
    }
    expect(failures.length, JSON.stringify(failures.slice(0, 8))).toBe(0);
  });

  it("matches v20 per-antibiotic statistical values, missing p-values, and medians", () => {
    const actual = summarizeBatch(batch).paired;
    const failures: unknown[] = [];
    for (const family of ["dosis", "frekuensi"] as const) {
      for (const [drug, tests] of Object.entries(oracle.statistics[family].per_antibiotik)) {
        for (const [key, expected] of Object.entries(tests)) {
          const metric = (family === "dosis" ? "Dosis " : "Frekuensi ") + (key.startsWith("aktual") ? "aktual" : "manual");
          const reference = key.endsWith("RS") ? "Pedoman Rumah Sakit" : "Literatur Terkini";
          const test = actual.find(item => item.group === drug.toLowerCase() && item.metric === metric && item.reference === reference);
          if (!test) { failures.push({ drug, metric, reference, missing: true }); continue; }
          for (const [field, a, b, tolerance] of [
            ["n", test.n, expected.n, 0],
            ["p", test.pValue, expected.p, 1e-6],
            ["statistic", test.statistic, expected.statistik ?? null, 1e-7],
            ["median", test.medianDifference, expected.median_selisih, 1e-9],
          ] as const) {
            if (typeof a === "number" && typeof b === "number" ? !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > tolerance : a !== b) failures.push({ drug, metric, reference, field, actual: a, expected: b });
          }
        }
      }
    }
    expect(failures.length, JSON.stringify(failures.slice(0, 8))).toBe(0);
  });

  it("exports v20 above/below-range counts and the v20 median definition", () => {
    const sheet = book.getWorksheet("Analisis Statistik")!;
    const headers = Array.from({ length: sheet.columnCount }, (_, index) => sheet.getRow(1).getCell(index + 1).value);
    expect(headers).toEqual(expect.arrayContaining(["Di atas rentang (n)", "Di bawah rentang (n)", "Median penyimpangan (pasien di luar rentang)"]));
    const column = (name: string) => headers.indexOf(name) + 1;
    for (const family of ["dosis", "frekuensi"] as const) {
      for (const [drug, tests] of Object.entries(oracle.statistics[family].per_antibiotik)) {
        for (const [key, expected] of Object.entries(tests)) {
          const metric = (family === "dosis" ? "Dosis " : "Frekuensi ") + (key.startsWith("aktual") ? "aktual" : "manual");
          const reference = key.endsWith("RS") ? "Pedoman Rumah Sakit" : "Literatur Terkini";
          const row = sheet.getRows(2, sheet.rowCount - 1)!.find(row => row.getCell(column("Kelompok")).value === drug
            && row.getCell(column("Metrik")).value === metric && row.getCell(column("Rujukan")).value === reference);
          expect(row, drug + metric + reference).toBeDefined();
          expect(row!.getCell(column("Di atas rentang (n)")).value).toBe(expected.n_atas);
          expect(row!.getCell(column("Di bawah rentang (n)")).value).toBe(expected.n_bawah);
          const median = row!.getCell(column("Median penyimpangan (pasien di luar rentang)")).value;
          if (expected.n_luar === 0) expect(median).toBeNull();
          else expect(median).toBeCloseTo(expected.median_selisih, 3);
        }
      }
    }
  });

  it("matches McNemar pair counts and missing p-values overall and per antibiotic", () => {
    const actual = summarizeBatch(batch).mcnemar;
    const failures: unknown[] = [];
    for (const family of ["dosis", "frekuensi"] as const) {
      for (const group of ["Keseluruhan", "Gentamisin", "Amikasin", "Vankomisin"]) {
        for (const calculation of ["aktual", "manual"] as const) {
          const expected = group === "Keseluruhan" ? oracle.statistics[family][`mcnemar_${calculation}`]
            : oracle.statistics[family].mcnemar_per_antibiotik[group][calculation];
          const metric = (family === "dosis" ? "Dosis " : "Frekuensi ") + calculation;
          const test = actual.find(item => item.group === (group === "Keseluruhan" ? group : group.toLowerCase()) && item.metric === metric);
          if (!test) { failures.push({ group, metric, missing: true }); continue; }
          for (const [field, a, b] of [
            ["n", test.n, expected.n], ["both", test.both, expected.n_keduanya],
            ["rsOnly", test.rsOnly, expected.b_RS_only], ["literatureOnly", test.literatureOnly, expected.c_Lit_only],
            ["neither", test.neither, expected.n_tidak_keduanya], ["p", test.pValue, expected.p],
          ] as const) {
            if (typeof a === "number" && typeof b === "number" ? !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > 1e-7 : a !== b) failures.push({ group, metric, field, actual: a, expected: b });
          }
        }
      }
    }
    expect(failures.length, JSON.stringify(failures.slice(0, 8))).toBe(0);
  });

  it("matches every v20 narrative section and paragraph directly from Python", () => {
    const expected = oracle.interpretation.map(section => ({ title: section.judul, paragraphs: section.isi.map(([kind, text]) => ({ kind, text })) }));
    expect(buildBatchInterpretation(batch)).toEqual(expected);
  });
});
