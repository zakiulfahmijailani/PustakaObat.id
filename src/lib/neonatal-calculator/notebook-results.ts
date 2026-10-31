import type { BatchSuccessRow } from "./batch-engine";
import type { IntervalRecommendation } from "./types";
import { notebookNumber, pythonFixed, pythonRound } from "./python-rounding";

export type Category = "Sesuai" | "Berlebih" | "Kurang" | "";
export const NOTEBOOK_EPSILON = 1e-6;
export const numberText = notebookNumber;
const percentText = (value: number) => pythonFixed(Math.abs(value),Math.abs(value)<0.1?2:1).replace(".",",") + "%";
export function differenceText(value: number, reference: number, unit: string): string {
  const sign = value > reference ? "+" : "-";
  return `${sign}${numberText(pythonRound(Math.abs(value - reference),3))} ${unit}; ${sign}${percentText(reference ? (value-reference)/reference*100 : 0)}`;
}
export function categorizeRange(min: number | null, max: number | null, lower: number | null, upper: number | null, unit = "mg"): {category: Category; detail: string; percent: number | null} {
  if (min === null || max === null || lower === null || upper === null) return {category:"",detail:"",percent:null};
  if (max > upper + NOTEBOOK_EPSILON) return {category:"Berlebih",detail:differenceText(max,upper,unit),percent:upper ? (max-upper)/upper*100 : 0};
  if (min < lower - NOTEBOOK_EPSILON) return {category:"Kurang",detail:differenceText(min,lower,unit),percent:lower ? (min-lower)/lower*100 : 0};
  return {category:"Sesuai",detail:"",percent:0};
}
export function intervalBounds(interval: IntervalRecommendation): [number|null, number|null] {
  if (interval.kind === "single-dose-only") return [null,null];
  if (interval.kind === "single") return [interval.hours,interval.hours];
  if (interval.kind === "continuous-range") return [interval.minHours,interval.maxHours];
  return [Math.min(...interval.allowedHours),Math.max(...interval.allowedHours)];
}
export function intervalText(lower: number|null, upper: number|null): string {
  return lower === null ? "Dosis tunggal" : lower === upper ? `tiap ${lower} jam` : `tiap ${lower}-${upper} jam`;
}
export function rangeText(lower: number|null, upper: number|null): string {
  return lower === null || upper === null ? "-" : `${lower === upper ? numberText(lower) : numberText(lower)+"-"+numberText(upper)} mg`;
}
export function categoryText(result: ReturnType<typeof categorizeRange>): string {
  return result.category ? result.category + (result.detail ? ` (${result.detail})` : "") : "-";
}
function intervalDifference(category: Category, actualMin: number, actualMax: number, lower: number, upper: number): string {
  return category === "Berlebih" ? `interval ${numberText(lower-actualMin)} jam lebih pendek dari interval ${lower} jam` : category === "Kurang" ? `interval ${numberText(actualMax-upper)} jam lebih panjang dari interval ${upper} jam` : "";
}
export function frequencyResult(actualMin: number|null, actualMax: number|null, lower: number|null, upper: number|null) {
  const result = categorizeRange(actualMax ? 24/actualMax : null,actualMin ? 24/actualMin : null,upper ? 24/upper : null,lower ? 24/lower : null,"dosis/hari");
  if (result.detail && actualMin !== null && actualMax !== null && lower !== null && upper !== null) result.detail += "; " + intervalDifference(result.category,actualMin,actualMax,lower,upper);
  return result;
}
export function manualText(min: number|null, max: number|null, lower: number|null, upper: number|null, frequency = false): string {
  if (min === null || max === null || lower === null || upper === null) return "-";
  if (lower === upper) return categoryText(frequency ? frequencyResult(min,max,lower,upper) : categorizeRange(min,max,lower,upper));
  const bound = (value: number, reference: number, actualHours?: number, referenceHours?: number) => {
    if (Math.abs(value-reference) <= NOTEBOOK_EPSILON) return "sama";
    let detail = differenceText(value,reference,frequency ? "dosis/hari" : "mg");
    if (actualHours !== undefined && referenceHours !== undefined && actualHours !== referenceHours) detail += `; interval ${numberText(Math.abs(actualHours-referenceHours))} jam ${actualHours < referenceHours ? "lebih pendek" : "lebih panjang"}`;
    return `${value > reference ? "lebih besar" : "lebih kecil"} (${detail})`;
  };
  return frequency ? `Min: ${bound(24/max,24/upper,max,upper)} | Maks: ${bound(24/min,24/lower,min,lower)}` : `Min: ${bound(min,lower)} | Maks: ${bound(max,upper)}`;
}

/** The same 24 public fields and numeric research variables as notebook cell 14. */
export function notebookBatchRecord(row: BatchSuccessRow): Record<string, string|number|null> {
  const p=row.calculator.input, rs=row.calculator.recommendations.institutionalPrimary, lit=row.calculator.recommendations.anmf2024;
  const [ri,rj]=intervalBounds(rs.interval), [li,lj]=intervalBounds(lit.interval);
  const da=row.actualEvaluation.actualDoseMg, ia=row.actualEvaluation.actualIntervalHours;
  const m=row.manualEvaluation?.input, dmin=m?.manualDoseMinMg??null, dmax=m?.manualDoseMaxMg??null, imin=m?.manualIntervalMinHours??null, imax=m?.manualIntervalMaxHours??null;
  const ra=categorizeRange(da,da,rs.dose.minTotalMg,rs.dose.maxTotalMg), la=categorizeRange(da,da,lit.dose.minTotalMg,lit.dose.maxTotalMg);
  const rf=frequencyResult(ia,ia,ri,rj), lf=frequencyResult(ia,ia,li,lj);
  return {
    "Kode Pasien":row.patientCode,"Antibiotik":p.antibiotic[0].toUpperCase()+p.antibiotic.slice(1),
    "Usia Gestasi (mgg)":p.gestationalAgeWeeks+(p.gestationalAgeDays??0)/7,"Usia Pascalahir (hari)":p.postnatalAgeDays,"PMA (mgg)":Math.round(row.calculator.pmaWeeks*10)/10,"Berat (kg)":p.currentWeightKg,
    "Fungsi Ginjal":!p.renalDataAvailable?"Tidak tersedia (diasumsikan normal)":row.calculator.renalStatus==="renal-impairment-criteria-met"?"Terganggu":"Normal",
    "Dosis RS (mg)":rangeText(rs.dose.minTotalMg,rs.dose.maxTotalMg),"Frek RS":intervalText(ri,rj),"Dosis Literatur (mg)":rangeText(lit.dose.minTotalMg,lit.dose.maxTotalMg),"Frek Literatur":intervalText(li,lj),
    "Dosis Manual (mg)":rangeText(dmin,dmax),"Frek Manual":imin===null?"-":intervalText(imin,imax),"Dosis Aktual (mg)":numberText(da)+" mg","Dosis Aktual (mg/kg/dosis)":numberText(da/p.currentWeightKg)+" mg/kg","Frek Aktual":ia===null?"-":`tiap ${ia} jam`,
    "Aktual vs RS (dosis)":categoryText(ra),"Aktual vs RS (frek)":categoryText(rf),"Aktual vs Literatur (dosis)":categoryText(la),"Aktual vs Literatur (frek)":categoryText(lf),
    "Manual vs RS (dosis)":manualText(dmin,dmax,rs.dose.minTotalMg,rs.dose.maxTotalMg),"Manual vs RS (frek)":manualText(imin,imax,ri,rj,true),"Manual vs Literatur (dosis)":manualText(dmin,dmax,lit.dose.minTotalMg,lit.dose.maxTotalMg),"Manual vs Literatur (frek)":manualText(imin,imax,li,lj,true),
    _da_perkg:da/p.currentWeightKg,_rs_mid_perkg:(rs.dose.minMgPerKg!+rs.dose.maxMgPerKg!)/2,_lit_mid_perkg:(lit.dose.minMgPerKg!+lit.dose.maxMgPerKg!)/2,
    _fa_perhari:ia?24/ia:null,_rs_freq_mid:ri&&rj?(24/ri+24/rj)/2:null,_lit_freq_mid:li&&lj?(24/li+24/lj)/2:null,
    _dm_mid_perkg:dmin!==null&&dmax!==null?(dmin+dmax)/2/p.currentWeightKg:null,_fm_mid_perhari:imin&&imax?(24/imin+24/imax)/2:null,
    _ka_rs:ra.category,_ka_lit:la.category,_kfa_rs:rf.category,_kfa_lit:lf.category,
    _kma_rs:categorizeRange(dmin,dmax,rs.dose.minTotalMg,rs.dose.maxTotalMg).category,_kma_lit:categorizeRange(dmin,dmax,lit.dose.minTotalMg,lit.dose.maxTotalMg).category,
    _kmf_rs:frequencyResult(imin,imax,ri,rj).category,_kmf_lit:frequencyResult(imin,imax,li,lj).category,
  };
}
