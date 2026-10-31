import type { BatchProcessingResult } from "./batch-engine";
import { summarizeBatch } from "./batch-statistics";
import { ANTIBIOTIC_LABELS, CALCULATOR_RULE_VERSION, CLINICAL_DISCLAIMER, formatNumber } from ".";
import type { CalculatorResult, RegimenEvaluationResult, Recommendation } from "./types";

type ReportLine = { text: string; color?: "red"|"orange"|"blue"|"green"; heading?: boolean };
const clean = (value: unknown): string => String(value ?? "")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^\x20-\x7E]/g, ch => ch === "–" || ch === "—" ? "-" : " ")
  .replace(/\s+/g," ").trim();
function escapePdf(value:string): string { return clean(value).replaceAll("\\","\\\\").replaceAll("(","\\(").replaceAll(")","\\)"); }
function pdfDocument(title:string,lines:ReportLine[]):Uint8Array {
  // Small, offline PDF writer. Every file is a real PDF, not an HTML print fallback.
  const pageWidth=595,pageHeight=842,margin=47;
  const pages:ReportLine[][]=[];let current:ReportLine[]=[];let cursor=0;
  const wrapped=(line:ReportLine):ReportLine[]=>{
    const max=line.heading?65:93, words=clean(line.text).split(" ");let result:string[]=[];let part="";
    for(const word of words){if(part.length+word.length+1>max && part){result.push(part);part="";}part=part?part+" "+word:word;}
    if(part)result.push(part);return result.map((text,i)=>({...line,text,heading:line.heading&&i===0}));
  };
  for(const line of lines){
    const chunks=wrapped(line);
    for(const chunk of chunks){
      const height=chunk.heading?24:16;
      if(cursor+height>pageHeight-2*margin-35){pages.push(current);current=[];cursor=0;}
      current.push(chunk);cursor+=height;
    }
  }
  if(current.length||!pages.length)pages.push(current);
  const encoder=new TextEncoder(),objects:string[]=[];
  const add=(s:string)=>{objects.push(s);return objects.length;};
  const catalog=add(""),pageTree=add(""),font=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const kids:number[]=[];
  const colors={red:"0.72 0.1 0.1",orange:"0.57 0.32 0.02",blue:"0.08 0.32 0.67",green:"0.05 0.43 0.27"};
  for(let p=0;p<pages.length;p++){
    let y=pageHeight-margin;
    const items=[
      "q", "0.05 0.43 0.39 rg", "0 "+(pageHeight-12)+" "+pageWidth+" 12 re f","Q",
      "BT","/F1 15 Tf","0.08 0.2 0.25 rg",margin+" "+y+" Td","("+escapePdf(title)+") Tj","ET"
    ];
    y-=34;
    for(const line of pages[p]){
      const fontSize=line.heading?12:9.5;
      const color=line.color?colors[line.color]:"0.12 0.18 0.2";
      items.push("BT","/F1 "+fontSize+" Tf",color+" rg",margin+" "+y+" Td","("+escapePdf(line.text)+") Tj","ET");
      y-=line.heading?24:16;
    }
    items.push("BT","/F1 8 Tf","0.4 0.4 0.4 rg",margin+" 27 Td","("+escapePdf("PustakaObat.id - Draft; verifikasi klinis wajib - Halaman "+(p+1)+"/"+pages.length)+") Tj","ET");
    const stream=items.join("\n")+"\n";
    const length=encoder.encode(stream).length;
    const streamRef=add("<< /Length "+length+" >>\nstream\n"+stream+"endstream");
    const page=add("<< /Type /Page /Parent "+pageTree+" 0 R /MediaBox [0 0 "+pageWidth+" "+pageHeight+"] /Resources << /Font << /F1 "+font+" 0 R >> >> /Contents "+streamRef+" 0 R >>");
    kids.push(page);
  }
  objects[catalog-1]="<< /Type /Catalog /Pages "+pageTree+" 0 R >>";
  objects[pageTree-1]="<< /Type /Pages /Kids ["+kids.map(i=>i+" 0 R").join(" ")+"] /Count "+kids.length+" >>";
  let doc="%PDF-1.4\n", offsets=[0];
  for(let i=0;i<objects.length;i++){offsets.push(encoder.encode(doc).length);doc+=(i+1)+" 0 obj\n"+objects[i]+"\nendobj\n";}
  const start=encoder.encode(doc).length;
  doc+="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";
  for(const off of offsets.slice(1))doc+=String(off).padStart(10,"0")+" 00000 n \n";
  doc+="trailer\n<< /Size "+(objects.length+1)+" /Root "+catalog+" 0 R >>\nstartxref\n"+start+"\n%%EOF";
  return encoder.encode(doc);
}
function recLine(label:string,rec:Recommendation):ReportLine[]{
  const dose=rec.dose.minTotalMg===rec.dose.maxTotalMg?formatNumber(rec.dose.minTotalMg??0):formatNumber(rec.dose.minTotalMg??0)+"-"+formatNumber(rec.dose.maxTotalMg??0);
  const hours=rec.interval.kind==="single"?"tiap "+rec.interval.hours+" jam":rec.interval.kind==="continuous-range"?"tiap "+rec.interval.minHours+"-"+rec.interval.maxHours+" jam":rec.interval.kind==="single-dose-only"?"Dosis tunggal (bukan rutin)":rec.interval.allowedHours.map(n=>"tiap "+n+" jam").join(" atau ");
  return [{text:label,heading:true},{text:"Dosis per pemberian: "+dose+" mg; Frekuensi: "+hours},{text:rec.provenanceDetail},...rec.notes.map(text=>({text}))];
}
function patientLines(calculated:CalculatorResult):ReportLine[]{
  const p=calculated.input;
  return [
    {text:"Kode pasien: "+(p.patientLabel??"Tanpa kode")},
    {text:"Antibiotik: "+ANTIBIOTIC_LABELS[p.antibiotic]+"; Usia gestasi: "+p.gestationalAgeWeeks+" minggu "+(p.gestationalAgeDays??0)+" hari"},
    {text:"Usia pascalahir: "+p.postnatalAgeDays+" hari; PMA: "+formatNumber(calculated.pmaWeeks)+" minggu; Berat: "+formatNumber(p.currentWeightKg)+" kg"},
    {text:"Data ginjal: "+(p.renalDataAvailable?"Data diberikan":"Tidak tersedia - tidak diasumsikan normal")},
    ...calculated.globalWarnings.map(w=>({text:w.message,color:w.severity==="critical"?"red" as const:w.severity==="warning"?"orange" as const:"blue" as const})),
    ...calculated.recommendations.institutionalPrimary.warnings.map(w=>({text:w.message,color:"red" as const})),
    ...calculated.recommendations.anmf2024.warnings.map(w=>({text:w.message,color:"red" as const}))
  ];
}
const footer:ReportLine[]=[{text:"Versi aturan: "+CALCULATOR_RULE_VERSION},{text:CLINICAL_DISCLAIMER},{text:"PERINGATAN: Belum diverifikasi secara klinis dan belum sesuai untuk keputusan terapi tanpa pemeriksaan profesional.",color:"red"}];
export function buildRecommendationPdf(calculated:CalculatorResult):Uint8Array{
  return pdfDocument("Rekomendasi Dosis Antibiotik Neonatus",[
    ...patientLines(calculated),
    ...recLine("Pedoman Rumah Sakit",calculated.recommendations.institutionalPrimary),
    ...recLine("Literatur Terkini - ANMF 2024",calculated.recommendations.anmf2024),
    ...footer
  ]);
}
export function buildEvaluationPdf(calculated:CalculatorResult,evaluation:RegimenEvaluationResult,manualEnabled:boolean):Uint8Array{
  const refs=[calculated.recommendations.institutionalPrimary,calculated.recommendations.anmf2024];
  const lines:ReportLine[]=[...patientLines(calculated),
    {text:"Dosis aktual: "+formatNumber(evaluation.input.actualDoseMg)+" mg; Interval aktual: "+String(evaluation.input.actualIntervalHours??"Tidak tersedia")+" jam",heading:true}];
  for(const rec of refs){
    lines.push(...recLine(rec.label,rec));
    const target=evaluation.targets.find(t=>t.recommendationId===rec.id);
    if(target){
      lines.push({text:"Dosis aktual: "+target.actualDose.status+" - "+target.actualDose.message,color:target.actualDose.status==="berlebih"?"red":target.actualDose.status==="kurang"?"orange":"green"});
      lines.push({text:"Frekuensi aktual: "+target.actualInterval.status+" - "+target.actualInterval.message});
      if(manualEnabled){
        lines.push({text:"Manual dosis: "+(target.manualDose.lowerBound?.message??"Tidak tersedia")+"; "+(target.manualDose.upperBound?.message??"")});
        lines.push({text:"Manual interval: "+(target.manualInterval.lowerBound?.message??"Tidak tersedia")+"; "+(target.manualInterval.upperBound?.message??"")});
      }
    }
  }
  return pdfDocument("Evaluasi Pemberian Antibiotik Neonatus",[...lines,...footer]);
}
export function buildBatchSummaryPdf(result:BatchProcessingResult):Uint8Array{
  const summary=summarizeBatch(result), lines:ReportLine[]=[
    {text:"Kandidat: "+result.candidateRows+"; Berhasil: "+result.successCount+"; Gagal: "+result.errorCount+"; Contoh dilewati: "+result.ignoredRows,heading:true},
    {text:"Distribusi Kesesuaian",heading:true},
    ...summary.counts.filter(x=>x.group==="Keseluruhan"&&x.count>0).map(x=>({text:x.metric+" / "+x.reference+" / "+x.category+": "+x.count+"/"+x.total+" ("+x.percent.toFixed(1)+"%)"})),
    {text:"Uji statistik berpasangan - hasil eksploratif",heading:true},
    ...summary.paired.filter(x=>x.group==="Keseluruhan").map(x=>({text:x.metric+" / "+x.reference+": "+x.method+", n="+x.n+", p="+(x.pValue===null?"tidak diuji":x.pValue.toFixed(4))})),
    {text:"Uji McNemar: kesesuaian kedua pedoman",heading:true},
    ...summary.mcnemar.filter(x=>x.group==="Keseluruhan").map(x=>({text:x.metric+": "+x.method+", n="+x.n+", p="+(x.pValue===null?"tidak diuji":x.pValue.toFixed(4))})),
    {text:"Kesimpulan: hasil statistik memerlukan verifikasi terhadap notebook acuan dan penafsiran oleh peneliti.",color:"orange"},
    ...footer
  ];
  return pdfDocument("Ringkasan Evaluasi Batch Neonatus",lines);
}
export function downloadPdf(bytes:Uint8Array,filename:string):void {
  const copy=new Uint8Array(bytes.byteLength);copy.set(bytes);
  const blob=new Blob([copy.buffer],{type:"application/pdf"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
