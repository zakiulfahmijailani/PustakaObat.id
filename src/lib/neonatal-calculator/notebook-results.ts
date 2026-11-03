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
export function rangeDeviation(min: number|null, max: number|null, lower: number|null, upper: number|null): number|null {
  if (min === null || max === null || lower === null || upper === null) return null;
  if (max > upper + NOTEBOOK_EPSILON) return max - upper;
  if (min < lower - NOTEBOOK_EPSILON) return min - lower;
  return 0;
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
/** v20's exported spreadsheet is Indonesian-facing, including decimal commas. */
function v20NumberText(value: number): string { return numberText(value).replace(".", ","); }
function v20RangeText(lower: number|null, upper: number|null): string {
  return lower === null || upper === null ? "-" : `${lower === upper ? v20NumberText(lower) : v20NumberText(lower)+"-"+v20NumberText(upper)} mg`;
}
function v20IntervalText(lower: number|null, upper: number|null): string {
  return lower === null ? "Dosis tunggal (bukan rutin)" : intervalText(lower, upper);
}
function v20WeeksDays(weeks: number): string {
  let wholeWeeks = Math.floor(weeks + NOTEBOOK_EPSILON);
  let days = Math.round((weeks - wholeWeeks) * 7);
  if (days === 7) { wholeWeeks += 1; days = 0; }
  return days ? `${wholeWeeks} minggu ${days} hari` : `${wholeWeeks} minggu`;
}
function v20RenalText(row: BatchSuccessRow): string {
  const p = row.calculator.input;
  if (!p.renalDataAvailable) return "Tidak diisi (diasumsikan normal sesuai usia)";
  const scr = v20NumberText(p.serumCreatinineMgDl!);
  const urine = p.urineOutputMlKgHour === undefined ? "tidak diisi" : `${v20NumberText(p.urineOutputMlKgHour)} mL/kg/jam`;
  const outcome = row.calculator.renalStatus === "renal-impairment-criteria-met" ? "memenuhi" : "tidak memenuhi";
  return `SCr ${scr} mg/dL; produksi urin ${urine}: ${outcome} kriteria gangguan ginjal UNC`;
}
function v20ManualText(min: number|null, max: number|null, lower: number|null, upper: number|null, frequency = false): string {
  if (min === null || max === null || lower === null || upper === null) return "-";
  if (lower === upper) return categoryText(frequency ? frequencyResult(min,max,lower,upper) : categorizeRange(min,max,lower,upper));
  const all = frequency ? frequencyResult(min,max,lower,upper) : categorizeRange(min,max,lower,upper);
  const bound = (value: number, reference: number, actualHours?: number, referenceHours?: number) => {
    if (Math.abs(value - reference) <= NOTEBOOK_EPSILON) return "sama";
    const sign = value > reference ? "+" : "-";
    let detail = `${sign}${v20NumberText(Math.abs(value - reference))} ${frequency ? "dosis/hari" : "mg"}; ${sign}${percentText(reference ? (value - reference) / reference * 100 : 0)}`;
    if (actualHours !== undefined && referenceHours !== undefined && actualHours !== referenceHours) detail += `; interval ${v20NumberText(Math.abs(actualHours - referenceHours))} jam ${actualHours < referenceHours ? "lebih pendek" : "lebih panjang"}`;
    return `${value > reference ? "lebih besar" : "lebih kecil"} (${detail})`;
  };
  const prefix = all.category ? `${all.category}: ` : "";
  return frequency
    ? `${prefix}paling jarang ${bound(min,lower,max,upper)} | paling sering ${bound(max,upper,min,lower)}`
    : `${prefix}batas bawah ${bound(min,lower)} | batas atas ${bound(max,upper)}`;
}
function v20ManualFrequencyText(min: number|null, max: number|null, lower: number|null, upper: number|null): string {
  if (min === null || max === null || lower === null || upper === null) return "-";
  if (min === max || lower === upper) return categoryText(frequencyResult(min, max, lower, upper));
  const category = frequencyResult(min, max, lower, upper).category;
  const bound = (value: number, reference: number, actualHours: number, referenceHours: number) => {
    if (Math.abs(value - reference) <= NOTEBOOK_EPSILON) return "sama";
    const sign = value > reference ? "+" : "-";
    let detail = `${sign}${v20NumberText(Math.abs(value - reference))} dosis/hari; ${sign}${percentText((value - reference) / reference * 100)}`;
    if (actualHours !== referenceHours) detail += `; interval ${v20NumberText(Math.abs(actualHours - referenceHours))} jam ${actualHours < referenceHours ? "lebih pendek" : "lebih panjang"}`;
    return `${value > reference ? "lebih besar" : "lebih kecil"} (${detail})`;
  };
  return `${category}: paling jarang ${bound(24/max,24/upper,max,upper)} | paling sering ${bound(24/min,24/lower,min,lower)}`;
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
    "Usia Gestasi saat Lahir":v20WeeksDays(p.gestationalAgeWeeks+(p.gestationalAgeDays??0)/7),"Usia Pascalahir (hari)":p.postnatalAgeDays,"Usia Pascamenstruasi (PMA)":v20WeeksDays(row.calculator.pmaWeeks),"Berat Badan (kg)":p.currentWeightKg,
    "Fungsi Ginjal":v20RenalText(row),
    "Dosis Pedoman RS (mg)":v20RangeText(rs.dose.minTotalMg,rs.dose.maxTotalMg),"Frekuensi Pedoman RS":v20IntervalText(ri,rj),"Dosis Literatur Terkini (mg)":v20RangeText(lit.dose.minTotalMg,lit.dose.maxTotalMg),"Frekuensi Literatur Terkini":v20IntervalText(li,lj),
    "Dosis Hitung Manual (mg)":v20RangeText(dmin,dmax),"Frekuensi Hitung Manual":imin===null?"-":v20IntervalText(imin,imax),"Dosis Aktual (mg)":v20NumberText(da)+" mg","Dosis Aktual (mg/kg per pemberian)":v20NumberText(da/p.currentWeightKg)+" mg/kg","Frekuensi Aktual":ia===null?"-":`tiap ${ia} jam`,
    "Dosis Aktual terhadap Pedoman RS":categoryText(ra),"Frekuensi Aktual terhadap Pedoman RS":categoryText(rf),"Dosis Aktual terhadap Literatur Terkini":categoryText(la),"Frekuensi Aktual terhadap Literatur Terkini":categoryText(lf),
    "Dosis Manual terhadap Pedoman RS":v20ManualText(dmin,dmax,rs.dose.minTotalMg,rs.dose.maxTotalMg),"Frekuensi Manual terhadap Pedoman RS":v20ManualFrequencyText(imin,imax,ri,rj),"Dosis Manual terhadap Literatur Terkini":v20ManualText(dmin,dmax,lit.dose.minTotalMg,lit.dose.maxTotalMg),"Frekuensi Manual terhadap Literatur Terkini":v20ManualFrequencyText(imin,imax,li,lj),
    _da_perkg:da/p.currentWeightKg,_rs_mid_perkg:(rs.dose.minMgPerKg!+rs.dose.maxMgPerKg!)/2,_lit_mid_perkg:(lit.dose.minMgPerKg!+lit.dose.maxMgPerKg!)/2,
    _fa_perhari:ia?24/ia:null,_rs_freq_mid:ri&&rj?(24/ri+24/rj)/2:null,_lit_freq_mid:li&&lj?(24/li+24/lj)/2:null,
    _dm_mid_perkg:dmin!==null&&dmax!==null?(dmin+dmax)/2/p.currentWeightKg:null,_fm_mid_perhari:imin&&imax?(24/imin+24/imax)/2:null,
    _dev_dosis_aktual_RS:rangeDeviation(da/p.currentWeightKg,da/p.currentWeightKg,rs.dose.minMgPerKg??null,rs.dose.maxMgPerKg??null),_dev_dosis_aktual_Literatur:rangeDeviation(da/p.currentWeightKg,da/p.currentWeightKg,lit.dose.minMgPerKg??null,lit.dose.maxMgPerKg??null),
    _dev_frek_aktual_RS:rangeDeviation(ia?24/ia:null,ia?24/ia:null,rj?24/rj:null,ri?24/ri:null),_dev_frek_aktual_Literatur:rangeDeviation(ia?24/ia:null,ia?24/ia:null,lj?24/lj:null,li?24/li:null),
    _dev_dosis_manual_RS:rangeDeviation(dmin===null?null:dmin/p.currentWeightKg,dmax===null?null:dmax/p.currentWeightKg,rs.dose.minMgPerKg??null,rs.dose.maxMgPerKg??null),_dev_dosis_manual_Literatur:rangeDeviation(dmin===null?null:dmin/p.currentWeightKg,dmax===null?null:dmax/p.currentWeightKg,lit.dose.minMgPerKg??null,lit.dose.maxMgPerKg??null),
    _dev_frek_manual_RS:rangeDeviation(imax?24/imax:null,imin?24/imin:null,rj?24/rj:null,ri?24/ri:null),_dev_frek_manual_Literatur:rangeDeviation(imax?24/imax:null,imin?24/imin:null,lj?24/lj:null,li?24/li:null),
    _ka_rs:ra.category,_ka_lit:la.category,_kfa_rs:rf.category,_kfa_lit:lf.category,
    _kma_rs:categorizeRange(dmin,dmax,rs.dose.minTotalMg,rs.dose.maxTotalMg).category,_kma_lit:categorizeRange(dmin,dmax,lit.dose.minTotalMg,lit.dose.maxTotalMg).category,
    _kmf_rs:frequencyResult(imin,imax,ri,rj).category,_kmf_lit:frequencyResult(imin,imax,li,lj).category,
  };
}
