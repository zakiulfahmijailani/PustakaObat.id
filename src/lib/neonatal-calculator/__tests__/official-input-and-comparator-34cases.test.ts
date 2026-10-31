import { describe, expect, it } from "vitest";
import { BATCH_COLUMNS, processBatchTable } from "../batch-engine";

// Exact input rows transcribed from the user-provided uji_web_1_unggah_ke_batch.xlsx.
// Original layout uses usia_gestasi_lahir_hari in the LAST column.
const header = ["kode_pasien","antibiotik","usia_gestasi_lahir_minggu","usia_pascalahir_hari","berat_badan_kg","kreatinin_serum_mg_dl","produksi_urin_ml_kg_jam","hipotermia_terapeutik","terapi_cox_inhibitor","sepsis_berat","dosis_manual_min_mg","dosis_manual_max_mg","frekuensi_manual_min_jam","frekuensi_manual_max_jam","dosis_aktual_mg","frekuensi_aktual_jam","usia_gestasi_lahir_hari"];
const input: unknown[][] = [
["T01","Gentamisin",27,3,0.9,null,null,"Tidak","Tidak","Tidak",null,null,null,null,4.5,48,null],
["T02","Gentamisin",29,0,1.2,null,null,"Tidak","Tidak","Tidak",null,null,null,null,6,24,6],
["T03","Gentamisin",30,0,1.4,null,null,"Tidak","Tidak","Tidak",null,null,null,null,7,36,null],
["T04","Gentamisin",33,8,1.72,0.6,2.8,"Tidak","Tidak","Tidak",8.6,12.9,24,48,8.6,36,null],
["T05","Gentamisin",34,0,2,null,null,"Tidak","Tidak","Tidak",null,null,null,null,10,24,6],
["T06","Gentamisin",35,0,2.3,null,null,"Tidak","Tidak","Tidak",null,null,null,null,11.5,24,null],
["T07","Gentamisin",40,12,3.45,null,null,"Tidak","Tidak","Tidak",null,null,null,null,20,24,null],
["T08","Gentamisin",39,2,3.2,null,null,"Ya","Tidak","Tidak",null,null,null,null,16,24,null],
["T09","Gentamisin",28,2,1,null,null,"Ya","Tidak","Tidak",null,null,null,null,5,48,null],
["T10","Gentamisin",30,5,1.3,null,null,"Tidak","Ya","Tidak",null,null,null,null,6.5,36,null],
["T11","Gentamisin",38,5,3,1.2,2,"Tidak","Tidak","Tidak",null,null,null,null,14,24,null],
["T12","Gentamisin",31,8,1.43,0.7,2.6,"Tidak","Tidak","Tidak",7,10.8,24,36,10.8,24,null],
["T13","Amikasin",26,3,0.8,null,null,"Tidak","Tidak","Tidak",null,null,null,null,11.2,48,null],
["T14","Amikasin",29,3,1.1,null,null,"Tidak","Tidak","Tidak",null,null,null,null,16.5,24,3],
["T15","Amikasin",28,10,1.1,null,null,"Tidak","Tidak","Tidak",null,null,null,null,13.2,36,null],
["T16","Amikasin",30,4,1.38,0.8,2.4,"Tidak","Tidak","Tidak",20,21,24,36,21,24,null],
["T17","Amikasin",33,10,1.9,null,null,"Tidak","Tidak","Tidak",null,null,null,null,28.5,24,null],
["T18","Amikasin",36,2,2.6,null,null,"Tidak","Tidak","Tidak",null,null,null,null,39,24,null],
["T19","Amikasin",28,6,1.1,1,1.4,"Tidak","Ya","Tidak",16.5,16.5,24,24,16.5,24,null],
["T20","Amikasin",39,1,3.3,null,null,"Ya","Tidak","Tidak",null,null,null,null,49.5,24,null],
["T21","Amikasin",30,4,1.38,null,null,"Tidak","Tidak","Tidak",null,null,null,null,20.5,24,null],
["T22","Vankomisin",26,2,0.74,1.1,1.8,"Tidak","Tidak","Ya",null,null,null,null,7.4,12,null],
["T23","Vankomisin",26,5,0.8,null,null,"Tidak","Tidak","Tidak",null,null,null,null,12,12,null],
["T24","Vankomisin",30,10,1.45,0.5,2,"Tidak","Tidak","Tidak",null,null,null,null,21.75,12,null],
["T25","Vankomisin",30,15,1.45,0.5,2,"Tidak","Tidak","Tidak",14.5,21.75,8,8,20,8,null],
["T26","Vankomisin",38,5,3,null,null,"Tidak","Tidak","Tidak",null,null,null,null,45,12,null],
["T27","Vankomisin",38,9,3.1,0.4,2,"Tidak","Tidak","Tidak",null,null,null,null,46.5,8,null],
["T28","Vankomisin",38,20,3,1.5,null,"Tidak","Tidak","Tidak",null,null,null,null,30,12,null],
["T29","Vankomisin",37,10,2.9,0.6,0.8,"Tidak","Tidak","Tidak",null,null,null,null,29,12,null],
["T30","Vankomisin",41,28,3.8,null,null,"Tidak","Tidak","Tidak",null,null,null,null,57,6,null],
["T31","Gentamisin",34,29,2.1,null,null,"Tidak","Tidak","Tidak",null,null,null,null,10,24,null],
["T32","Gentamisin",33,8,1720,null,null,"Tidak","Tidak","Tidak",null,null,null,null,8.6,36,null],
["T33","Amikasin",32,3,1.6,null,null,"Tidak","Tidak","Tidak",null,null,null,null,24,24,7],
["T34","Gentamycin",33,8,1.7,null,null,"Tidak","Tidak","Tidak",null,null,null,null,8.5,36,null],
];
// Original expected values from uji_web_2_pembanding.xlsx, sheet "Diharapkan".
// Dose strings and frequencies are reference expected output; comparison categories
// are checked separately, preserving the exact original clinical-input fixture.
const expected: [string,string,string,string,string][] = [
["T01","4,5-6,75 mg","tiap 24-48 jam","4,5 mg","tiap 48 jam"],
["T02","6-9 mg","tiap 24-48 jam","6 mg","tiap 48 jam"],
["T03","7-10,5 mg","tiap 24-48 jam","7 mg","tiap 36 jam"],
["T04","8,6-12,9 mg","tiap 24-48 jam","8,6 mg","tiap 36 jam"],
["T05","10-15 mg","tiap 24-48 jam","10 mg","tiap 36 jam"],
["T06","11,5-17,25 mg","tiap 24-48 jam","11,5 mg","tiap 24 jam"],
["T07","17,25-25,875 mg","tiap 24-48 jam","17,25 mg","tiap 24 jam"],
["T08","16-24 mg","tiap 24-48 jam","16 mg","tiap 36 jam"],
["T09","5-7,5 mg","tiap 24-48 jam","5 mg","tiap 48 jam"],
["T10","6,5-9,75 mg","tiap 24-48 jam","6,5 mg","tiap 48 jam"],
["T11","15-22,5 mg","tiap 24-48 jam","15 mg","tiap 24 jam"],
["T12","7,15-10,725 mg","tiap 24-48 jam","7,15 mg","tiap 36 jam"],
["T13","12 mg","tiap 24 jam","11,2 mg","tiap 48 jam"],
["T14","16,5 mg","tiap 24 jam","15,4 mg","tiap 48 jam"],
["T15","16,5 mg","tiap 24 jam","13,2 mg","tiap 36 jam"],
["T16","20,7 mg","tiap 24 jam","16,56 mg","tiap 36 jam"],
["T17","28,5 mg","tiap 24 jam","22,8 mg","tiap 24 jam"],
["T18","39 mg","tiap 24 jam","31,2 mg","tiap 24 jam"],
["T19","16,5 mg","tiap 24 jam","15,4 mg","tiap 60 jam"],
["T20","49,5 mg","tiap 24 jam","39,6 mg","tiap 36 jam"],
["T21","20,7 mg","tiap 24 jam","16,56 mg","tiap 36 jam"],
["T22","7,4 mg","Dosis tunggal","11,1 mg","tiap 18 jam"],
["T23","8-12 mg","tiap 12 jam","12 mg","tiap 12 jam"],
["T24","14,5-21,75 mg","tiap 12 jam","21,75 mg","tiap 12 jam"],
["T25","14,5-21,75 mg","tiap 8 jam","21,75 mg","tiap 8 jam"],
["T26","30-45 mg","tiap 12 jam","45 mg","tiap 12 jam"],
["T27","31-46,5 mg","tiap 12 jam","46,5 mg","tiap 8 jam"],
["T28","30 mg","Dosis tunggal","45 mg","tiap 8 jam"],
["T29","29 mg","Dosis tunggal","43,5 mg","tiap 8 jam"],
["T30","38-57 mg","tiap 8 jam","57 mg","tiap 6 jam"],
];
function renderDose(dose:{minTotalMg:number|null;maxTotalMg:number|null}) {
  const f=(v:number)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:3}).format(v);
  return dose.minTotalMg===dose.maxTotalMg ? f(dose.minTotalMg??0)+" mg" : f(dose.minTotalMg??0)+"-"+f(dose.maxTotalMg??0)+" mg";
}
function renderInterval(i:{kind:string;[k:string]:unknown}) {
  if(i.kind==="single-dose-only")return "Dosis tunggal";
  if(i.kind==="single")return "tiap "+i.hours+" jam";
  if(i.kind==="continuous-range")return "tiap "+i.minHours+"-"+i.maxHours+" jam";
  return "unknown";
}
describe("OFFICIAL original 34-case batch input and notebook expected numeric regimen",()=>{
  const processed=processBatchTable([header,...input]);
  it("30 calculated and 4 rejected, with correct IDs",()=>{
    expect(BATCH_COLUMNS).toContain("usia_gestasi_lahir_hari");
    expect(processed.successCount).toBe(30);
    expect(processed.errorCount).toBe(4);
    expect(processed.rows.filter(r=>r.status==="berhasil").map(r=>r.patientCode)).toEqual(expected.map(r=>r[0]));
    expect(processed.rows.filter(r=>r.status==="gagal").map(r=>r.patientCode)).toEqual(["T31","T32","T33","T34"]);
  });
  it.each(expected)("notebook reference %s for two doses + intervals", (code,rsDose,rsFreq,litDose,litFreq)=>{
    const row=processed.rows.find(r=>r.patientCode===code);
    expect(row?.status).toBe("berhasil");
    if(!row||row.status!=="berhasil")return;
    expect(renderDose(row.calculator.recommendations.institutionalPrimary.dose)).toBe(rsDose);
    expect(renderInterval(row.calculator.recommendations.institutionalPrimary.interval)).toBe(rsFreq);
    expect(renderDose(row.calculator.recommendations.anmf2024.dose)).toBe(litDose);
    expect(renderInterval(row.calculator.recommendations.anmf2024.interval)).toBe(litFreq);
  });
});
