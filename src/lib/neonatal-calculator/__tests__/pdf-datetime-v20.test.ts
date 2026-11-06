import { describe, expect, it } from "vitest";
import { BATCH_COLUMNS, processBatchTable } from "../batch-engine";
import { calculateRecommendations } from "../recommendation-engine";
import { evaluateRegimen } from "../evaluation-engine";
import { buildBatchSummaryPdf, buildEvaluationPdf, buildRecommendationPdf, formatPdfGeneratedAt } from "../pdf-reports";
import { patient } from "./fixtures";

const date = new Date("2026-11-05T23:20:15.000Z"); // Indonesia: 6 November 2026
const text = (pdf: Uint8Array) => new TextDecoder().decode(pdf);
const readable = (pdf: Uint8Array) => [...text(pdf).matchAll(/\((.*)\) Tj/g)]
  .map(match => match[1].replace(/\\([\\()])/g, "$1")).join(" ");
const pages = (pdf: Uint8Array) => (text(pdf).match(/\/Type \/Page\b/g) ?? []).length;
const stamps = (pdf: Uint8Array) => (text(pdf).match(/\(Dibuat lokal:/g) ?? []).length;
const jakarta = { generatedAt: date, timeZone: "Asia/Jakarta" };

describe("[3.3] tanggal lengkap dan jam pada PDF v20", () => {
  it("format id-ID memuat hari, tanggal, bulan, tahun, jam, detik, serta zona waktu eksplisit", () => {
    expect(formatPdfGeneratedAt(date, "Asia/Jakarta"))
      .toBe("Dibuat lokal: Jumat, 6 November 2026 pukul 06.20.15 WIB (Asia/Jakarta)");
    expect(formatPdfGeneratedAt(date, "Asia/Makassar"))
      .toBe("Dibuat lokal: Jumat, 6 November 2026 pukul 07.20.15 WITA (Asia/Makassar)");
    expect(formatPdfGeneratedAt(date, "Asia/Jayapura"))
      .toBe("Dibuat lokal: Jumat, 6 November 2026 pukul 08.20.15 WIT (Asia/Jayapura)");
    expect(formatPdfGeneratedAt(date, "UTC"))
      .toBe("Dibuat lokal: Kamis, 5 November 2026 pukul 23.20.15 UTC (UTC)");
  });

  it("menghindari tanggal yang tidak valid dan tidak mengasumsikan zona WIB", () => {
    expect(() => formatPdfGeneratedAt(new Date(Number.NaN), "Asia/Jakarta")).toThrow(RangeError);
    expect(() => formatPdfGeneratedAt(date, "Invalid/Zone")).toThrow(RangeError);
  });

  it.each(["gentamisin", "amikasin", "vankomisin"] as const)(
    "PDF rekomendasi dan evaluasi %s memiliki timestamp yang identik pada seluruh halaman tanpa perubahan regimen",
    antibiotic => {
      const result = calculateRecommendations(patient({
        antibiotic, currentWeightKg: 1.5,
        serumCreatinineMgDl: antibiotic === "vankomisin" ? 1 : 0.6,
        urineOutputMlKgHour: 0.8,
      }));
      const evaluation = evaluateRegimen(result, {
        actualDoseMg: 9, actualIntervalHours: antibiotic === "vankomisin" ? null : 24,
        manualDoseMinMg: 9, manualDoseMaxMg: 9,
        manualIntervalMinHours: antibiotic === "vankomisin" ? null : 24,
        manualIntervalMaxHours: antibiotic === "vankomisin" ? null : 24,
      });
      const unchanged = JSON.stringify({ result, evaluation });
      const expectedStamp = formatPdfGeneratedAt(date, "Asia/Jakarta");
      for (const pdf of [
        buildRecommendationPdf(result, jakarta),
        buildEvaluationPdf(result, evaluation, false, jakarta),
        buildEvaluationPdf(result, evaluation, true, jakarta),
      ]) {
        expect(text(pdf).startsWith("%PDF-1.4")).toBe(true);
        expect(readable(pdf)).toContain(expectedStamp);
        expect(pages(pdf)).toBeGreaterThanOrEqual(1);
        expect(stamps(pdf)).toBe(pages(pdf));
        expect(readable(pdf)).toContain("Versi aturan: 2026.11.01");
      }
      const again = buildRecommendationPdf(result, jakarta);
      expect(text(again)).toBe(text(buildRecommendationPdf(result, jakarta)));
      expect(JSON.stringify({ result, evaluation })).toBe(unchanged);
    },
  );

  it("mengulangi satu waktu yang sama pada halaman PDF panjang meskipun halaman berganti", () => {
    const result = calculateRecommendations(patient({ antibiotic: "amikasin" }));
    result.recommendations.anmf2024.notes.push(
      Array.from({length: 700}, (_, i) => "PANJANG" + String(i).padStart(3, "0")).join(" "),
    );
    const pdf = buildRecommendationPdf(result, jakarta);
    expect(pages(pdf)).toBeGreaterThan(2);
    expect(stamps(pdf)).toBe(pages(pdf));
    expect(readable(pdf)).toContain(formatPdfGeneratedAt(date, "Asia/Jakarta"));
  });

  it("memberi timestamp pada PDF ringkasan batch tanpa mengubah data sumber", () => {
    const batch = processBatchTable([BATCH_COLUMNS, [
      "P-01","Gentamisin",32,0,5,1.5,0.4,2,"Tidak","Tidak","Tidak",
      7.5,11.25,24,48,8,24,
    ]]);
    const snapshot = JSON.stringify(batch);
    const pdf = buildBatchSummaryPdf(batch, jakarta);
    expect(readable(pdf)).toContain(formatPdfGeneratedAt(date, "Asia/Jakarta"));
    expect(stamps(pdf)).toBe(pages(pdf));
    expect(JSON.stringify(batch)).toBe(snapshot);
  });
});
