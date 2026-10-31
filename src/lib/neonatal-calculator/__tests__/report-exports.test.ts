import { describe, expect, it } from "vitest";
import { calculateRecommendations } from "../recommendation-engine";
import { evaluateRegimen } from "../evaluation-engine";
import { patient } from "./fixtures";
import { BATCH_COLUMNS, processBatchTable } from "../batch-engine";
import { buildBatchSummaryPdf, buildEvaluationPdf, buildRecommendationPdf } from "../pdf-reports";
import { summarizeBatch, shapiroWilk } from "../batch-statistics";

describe("PDF laporan neonatal", () => {
  const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  it("menghasilkan berkas PDF rekomendasi nyata", () => {
    const bytes = buildRecommendationPdf(calculateRecommendations(patient()));
    expect(decode(bytes).startsWith("%PDF-1.4")).toBe(true);
    expect(decode(bytes)).toContain("xref");
    expect(decode(bytes)).toContain("Literatur Terkini");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
  it("menghasilkan evaluasi dengan dan tanpa bagian manual", () => {
    const result = calculateRecommendations(patient());
    const evaluation = evaluateRegimen(result, {
      manualDoseMinMg: 7.5, manualDoseMaxMg: 11.25,
      manualIntervalMinHours: 24, manualIntervalMaxHours: 48,
      actualDoseMg: 8, actualIntervalHours: 24,
    });
    expect(decode(buildEvaluationPdf(result,evaluation,false))).not.toContain("Manual dosis:");
    expect(decode(buildEvaluationPdf(result,evaluation,true))).toContain("Manual dosis:");
  });
  it("menghasilkan ringkasan batch PDF", () => {
    const batch=processBatchTable([BATCH_COLUMNS,[
      "P-01","Gentamisin",32,0,5,1.5,0.4,2,"Tidak","Tidak","Tidak",
      7.5,11.25,24,48,8,24
    ]]);
    const bytes=buildBatchSummaryPdf(batch);
    expect(decode(bytes)).toContain("Ringkasan Evaluasi Batch");
    expect(bytes[0]).toBe(37);
  });
});

describe("statistik batch eksploratif", () => {
  it("tidak menguji Shapiro–Wilk untuk kurang dari tiga pasang atau data konstan", () => {
    expect(shapiroWilk([1,2])).toBeNull();
    expect(shapiroWilk([1,1,1])).toBeNull();
  });
  it("membuat kelompok ringkasan untuk setiap antibiotik", () => {
    const result=processBatchTable([BATCH_COLUMNS,["P-01","Gentamisin",32,0,5,1.5,0.4,2,"Tidak","Tidak","Tidak",7.5,11.25,24,48,8,24]]);
    const summary=summarizeBatch(result);
    expect(summary.counts.some(row=>row.group==="Keseluruhan")).toBe(true);
    expect(summary.counts.some(row=>row.group==="gentamisin")).toBe(true);
    expect(summary.paired.some(row=>row.n===1 && row.method==="Tidak diuji")).toBe(true);
  });
});
