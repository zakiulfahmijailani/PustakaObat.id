import { describe, expect, it } from "vitest";
import { Workbook, type Buffer as ExcelBuffer } from "exceljs";
import { loadV20Reference } from "../../../../tests/helpers/neonatal-v20-reference";
import { processBatchTable } from "../batch-engine";
import { summarizeBatch } from "../batch-statistics";
import { buildBatchInterpretation } from "../batch-interpretation";
import { buildBatchResultWorkbook } from "../batch-workbook";
import { pythonRound } from "../python-rounding";
import { notebookBatchRecord } from "../notebook-results";
const oracle=loadV20Reference();
describe("v20 independent Python statistics and narrative regression",()=>{
  for(const cohort of oracle.cases) it(cohort.name,()=>{
    const batch=processBatchTable([oracle.header,...cohort.rows]);
    expect(batch.errorCount).toBe(0);
    expect(buildBatchInterpretation(batch)).toEqual(cohort.interpretation.map(s=>({title:s.judul,paragraphs:s.isi.map(([kind,text])=>({kind,text}))})));
    const stats=summarizeBatch(batch);
    for(const family of ["dosis","frekuensi"] as const)for(const [drug,tests] of Object.entries(cohort.statistics[family].per_antibiotik))for(const [key,expected] of Object.entries(tests)){
      const actual=stats.paired.find(t=>t.group===drug.toLowerCase()&&t.metric===(family==="dosis"?"Dosis ":"Frekuensi ")+(key.startsWith("aktual")?"aktual":"manual")&&t.reference===(key.endsWith("RS")?"Pedoman Rumah Sakit":"Literatur Terkini"))!;
      expect(actual.n).toBe(expected.n);
      expect(actual.aboveCount).toBe(expected.n_atas);expect(actual.belowCount).toBe(expected.n_bawah);
      expect(actual.medianDifference).toBeCloseTo(expected.median_selisih,9);
      if(expected.p===null)expect(actual.pValue).toBeNull();else expect(actual.pValue).toBeCloseTo(expected.p,6);
      if(expected.statistik!==null&&expected.statistik!==undefined)expect(actual.statistic).toBeCloseTo(expected.statistik,7);
      if(expected.uji&&expected.p!==null)expect(actual.method).toBe(expected.uji);
    }
  });
  it("exports the complete v20 narrative and numeric statistics",async()=>{
    const batch=processBatchTable([oracle.header,...oracle.inputRows]);const book=new Workbook();
    await book.xlsx.load(Buffer.from(await buildBatchResultWorkbook(batch)) as unknown as ExcelBuffer);
    const sheetInterpretation=book.getWorksheet("Interpretasi & Kesimpulan")!;
    expect(sheetInterpretation.getRow(7).getCell(1).value).toBe("Arti sorotan");
    expect(String(sheetInterpretation.getRow(7).getCell(2).value)).toContain("bermakna secara statistik");
    expect(String(sheetInterpretation.getRow(7).getCell(2).value)).toContain("Berlebih");
    const text:string[]=[];sheetInterpretation.eachRow((row,index)=>{if(index>7&&row.getCell(1).value)text.push(String(row.getCell(1).value));});
    expect(text).toEqual(oracle.interpretation.flatMap(s=>[s.judul,...s.isi.map(p=>p[1])]));
    const sheet=book.getWorksheet("Analisis Statistik")!;
    expect(sheet.getRow(1).getCell(8).value).toBe("Median penyimpangan (pasien di luar rentang)");
    expect(sheet.getRow(2).getCell(8).numFmt).toBe("0.000");
  });
  it("exports the rounded median for small samples and blank for all-in-range",async()=>{
    for(const name of ["small","zero","normal"]){
      const cohort=oracle.cases.find(c=>c.name===name)!;
      const batch=processBatchTable([oracle.header,...cohort.rows]);const book=new Workbook();
      await book.xlsx.load(Buffer.from(await buildBatchResultWorkbook(batch)) as unknown as ExcelBuffer);
      const sheet=book.getWorksheet("Analisis Statistik")!;
      for(const family of ["dosis","frekuensi"] as const)for(const [key,expected] of Object.entries(cohort.statistics[family].per_antibiotik.Gentamisin)){
        const metric=(family==="dosis"?"Dosis ":"Frekuensi ")+(key.startsWith("aktual")?"aktual":"manual");
        const reference=key.endsWith("RS")?"Pedoman Rumah Sakit":"Literatur Terkini";
        const row=sheet.getRows(2,sheet.rowCount-1)!.find(row=>row.getCell(1).value==="Gentamisin"&&row.getCell(2).value===metric&&row.getCell(3).value===reference)!;
        const expectedMedian=expected.n_luar ? pythonRound(expected.median_selisih,3) : null;
        expect(row.getCell(8).value,`${name} ${key}`).toBe(expectedMedian===0?0:expectedMedian);
        if(expected.n<3)expect(row.getCell(13).value).toBeNull();
      }
    }
  });
  it("matches recommendation-only and mixed batches to Python without counting missing actual data",async()=>{
    for(const name of ["recommendation-only","manual-no-actual","mixed-actual"]){
      const cohort=oracle.cases.find(c=>c.name===name)!;
      const batch=processBatchTable([oracle.header,...cohort.rows]);
      expect(batch.successCount).toBe(3);expect(batch.errorCount).toBe(0);
      const book=new Workbook();await book.xlsx.load(Buffer.from(await buildBatchResultWorkbook(batch)) as unknown as ExcelBuffer);
      const sheet=book.getWorksheet("Hasil per Pasien")!;
      for(const [index,row] of batch.rows.entries()){
        if(row.status!=="berhasil")throw new Error("Expected successful recommendation");
        const expected=cohort.records[index],actual=notebookBatchRecord(row);
        for(const [column,key] of oracle.publicHeaders.entries()){
          expect(actual[key],name+key).toEqual(expected[key]);
          expect(sheet.getRow(index+2).getCell(column+1).value,name+key).toEqual(expected[key]);
        }
        if(name!=="mixed-actual"||index<2){
          expect(row.actualEvaluation).toBeNull();
          for(const key of ["_da_perkg","_fa_perhari","_dev_dosis_aktual_RS","_dev_frek_aktual_RS"])expect(actual[key]).toBeNull();
        }
      }
      const stats=summarizeBatch(batch);
      const actualN=name==="mixed-actual"?1:0;
      for(const t of stats.paired.filter(t=>t.group==="Keseluruhan"&&t.metric.endsWith("aktual"))){expect(t.n).toBe(actualN);expect(t.pValue).toBeNull();}
      for(const t of stats.mcnemar.filter(t=>t.group==="Keseluruhan"&&t.metric.endsWith("aktual")))expect(t.n).toBe(actualN);
      for(const c of stats.counts.filter(c=>c.group==="Keseluruhan"&&c.metric.endsWith("aktual")))expect(c.total).toBe(actualN);
      if(name==="manual-no-actual")for(const t of stats.paired.filter(t=>t.group==="Keseluruhan"&&t.metric.endsWith("manual")))expect(t.n).toBe(3);
    }
  });
});
