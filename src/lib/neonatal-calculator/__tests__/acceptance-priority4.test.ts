import { describe, expect, it } from "vitest";
import { calculateRecommendations } from "../recommendation-engine";
import { evaluateActualRegimen } from "../evaluation-engine";
import { validatePatientInput } from "../validation";
import { patient } from "./fixtures";
import { BATCH_COLUMNS, processBatchTable } from "../batch-engine";
import { buildBatchResultWorkbook, buildBatchTemplateWorkbook } from "../batch-workbook";
import { buildRecommendationPdf, buildEvaluationPdf, buildBatchSummaryPdf } from "../pdf-reports";
import { evaluateRegimen } from "../evaluation-engine";

// These are specification-derived acceptance probes, not notebook reference parity.
describe("acceptance: clinical specification 2026.11.01", () => {
  it("amikasin: GA 29w3d, PNA 3 days, 1.1 kg => 15.4mg every 48h ANMF", () => {
    const result=calculateRecommendations(patient({antibiotic:"amikasin",gestationalAgeWeeks:29,gestationalAgeDays:3,postnatalAgeDays:3,currentWeightKg:1.1}));
    expect(result.pmaWeeks).toBeCloseTo(29+6/7,10);
    expect(result.recommendations.anmf2024.dose.minTotalMg).toBeCloseTo(15.4,10);
    expect(result.recommendations.anmf2024.interval).toMatchObject({kind:"single",hours:48});
  });
  it.each([
    [29,6,0,14,48], [29,6,1,12,36], [30,0,0,12,36],
    [34,6,0,12,36], [34,6,8,12,24], [35,0,0,12,24],
  ])("amikasin PMA boundary GA %i weeks +%i days, PNA %i", (w,d,pna,expectedDose,expectedHours)=>{
    const result=calculateRecommendations(patient({antibiotic:"amikasin",gestationalAgeWeeks:w,gestationalAgeDays:d,postnatalAgeDays:pna}));
    expect(result.recommendations.anmf2024.dose.minMgPerKg).toBe(expectedDose);
    expect(result.recommendations.anmf2024.interval).toMatchObject({kind:"single",hours:expectedHours});
  });
  it("gentamisin hypothermia never shortens an initial 48h interval", ()=>{
    const result=calculateRecommendations(patient({gestationalAgeWeeks:28,postnatalAgeDays:0,therapeuticHypothermia:true}));
    expect(result.recommendations.anmf2024.interval).toMatchObject({kind:"single",hours:48});
  });
  it.each([0,14,15,28])("vankomisin institutional PNA %i", pna=>{
    const result=calculateRecommendations(patient({antibiotic:"vankomisin",postnatalAgeDays:pna}));
    expect(result.recommendations.institutionalPrimary.dose).toMatchObject({minMgPerKg:10,maxMgPerKg:15});
    expect(result.recommendations.institutionalPrimary.interval).toMatchObject({kind:"single",hours:pna<=14?12:8});
  });
  it("gentamisin RS interval accepts intermediate 36h",()=>{
    const result=calculateRecommendations(patient());
    const actual=evaluateActualRegimen(result,8,36);
    expect(actual.targets[0]?.actualInterval.status).toBe("sesuai");
  });
  it.each([0,28])("PNA boundary %i is valid",age=>{
    expect(validatePatientInput(patient({postnatalAgeDays:age})).success).toBe(true);
  });
  it.each([-1,29])("PNA outside scope %i rejected",age=>{
    expect(validatePatientInput(patient({postnatalAgeDays:age})).success).toBe(false);
  });
  it("renal data absent must not silently claim normal",()=>{
    const result=calculateRecommendations(patient({renalDataAvailable:false,serumCreatinineMgDl:undefined,urineOutputMlKgHour:undefined}));
    expect(result.renalStatus).toBe("data-unavailable");
    expect(result.globalWarnings.some(w=>w.code==="RENAL_DATA_UNAVAILABLE")).toBe(true);
  });
});
describe("acceptance: export structure and data integrity",()=>{
  const fixture=()=>processBatchTable([BATCH_COLUMNS,
    ["CONTOH-1","Gentamisin",29,3,3,1.1,"","","Tidak","Tidak","Tidak","","","","",16,48],
    ["P-001","Amikasin",29,3,3,1.1,"","","Tidak","Tidak","Tidak","","","","",15.4,48],
    ["P-002","Gentamisin",38,0,1,3,"","","Tidak","Tidak","Tidak","","","","",15,24],
    ["P-002","Gentamisin",38,0,1,3,"","","Tidak","Tidak","Tidak","","","","",15,24],
    ["P-003","Gentamisin",38,0,29,3,"","","Tidak","Tidak","Tidak","","","","",15,24],
  ]);
  it("ignores sample, rejects duplicate and outside PNA; counts remain consistent",()=>{
    const result=fixture();
    expect(result.ignoredRows).toBe(1);
    expect(result.candidateRows).toBe(4);
    expect(result.successCount).toBe(2);
    expect(result.errorCount).toBe(2);
  });
  it("creates exactly six expected sheets and no hidden age-comparator columns",async()=>{
    const workbookBuffer=await buildBatchResultWorkbook(fixture());
    const ExcelJS=await import("exceljs");
    const book=new ExcelJS.Workbook();
    await book.xlsx.load(new Uint8Array(workbookBuffer) as unknown as import("exceljs").Buffer);
    expect(book.worksheets.map(w=>w.name)).toEqual([
      "Hasil per Pasien","Ringkasan Kesesuaian","Analisis Statistik",
      "Interpretasi & Kesimpulan","Peringatan","Keterangan Singkatan"
    ]);
    const data=book.getWorksheet("Hasil per Pasien");
    expect(data?.rowCount).toBe(3);
    const headers=(data?.getRow(1).values as string[]).filter(Boolean);
    expect(headers).toContain("Dosis Literatur (mg)");
    expect(headers.some(name=>/pembanding_usia|GA\/PNA/.test(name))).toBe(false);
    expect(book.getWorksheet("Peringatan")?.rowCount).toBeGreaterThan(1);
    expect(book.getWorksheet("Analisis Statistik")?.rowCount).toBeGreaterThan(2);
  });
  it("generates valid PDF byte signatures for all three outputs",()=>{
    const result=calculateRecommendations(patient());
    const ev=evaluateRegimen(result,{manualDoseMinMg:5,manualDoseMaxMg:7.5,manualIntervalMinHours:24,manualIntervalMaxHours:48,actualDoseMg:7,actualIntervalHours:24});
    for(const bytes of [buildRecommendationPdf(result),buildEvaluationPdf(result,ev,false),buildBatchSummaryPdf(fixture())]){
      const value=new TextDecoder().decode(bytes);
      expect(value.startsWith("%PDF-1.4")).toBe(true);
      expect(value).toContain("%%EOF");
      expect(value).toContain("xref");
      expect(bytes.byteLength).toBeGreaterThan(700);
    }
  });
  it("template remains readable and preserves both input sheet names",async()=>{
    const ExcelJS=await import("exceljs");
    const book=new ExcelJS.Workbook();
    await book.xlsx.load(new Uint8Array(await buildBatchTemplateWorkbook()) as unknown as import("exceljs").Buffer);
    expect(book.worksheets.map(w=>w.name)).toEqual(["Petunjuk","Data Pasien"]);
  });
});
