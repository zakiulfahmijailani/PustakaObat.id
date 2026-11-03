import { describe, expect, it } from "vitest";
import { Workbook, type Buffer as ExcelBuffer } from "exceljs";
import { loadV20Reference } from "../../../../tests/helpers/neonatal-v20-reference";
import { processBatchTable } from "../batch-engine";
import { summarizeBatch } from "../batch-statistics";
import { buildBatchInterpretation } from "../batch-interpretation";
import { buildBatchResultWorkbook } from "../batch-workbook";
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
    const text:string[]=[];book.getWorksheet("Interpretasi & Kesimpulan")!.eachRow((row,index)=>{if(index>6&&row.getCell(1).value)text.push(String(row.getCell(1).value));});
    expect(text).toEqual(oracle.interpretation.flatMap(s=>[s.judul,...s.isi.map(p=>p[1])]));
    const sheet=book.getWorksheet("Analisis Statistik")!;
    expect(sheet.getRow(1).getCell(8).value).toBe("Median penyimpangan (pasien di luar rentang)");
    expect(sheet.getRow(2).getCell(8).numFmt).toBe("0.000");
  });
});
