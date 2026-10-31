import { describe, expect, it } from "vitest";
import { calculateRecommendations } from "../recommendation-engine";
import { patient } from "./fixtures";
import type { Antibiotic, PatientInput } from "../types";

/**
 * Diharapkan!A2:K31 from uji_web_2_pembanding.xlsx (notebook v18).
 * Inputs were RECONSTRUCTED from reference GA, PNA, weight, renal-status label,
 * and "Tujuan uji" notes. These do NOT replace the original upload fixture
 * uji_web_1_unggah_ke_batch.xlsx or end-to-end equality of 19 text fields.
 *
 * Grouped renal flags below are sufficient for dose / interval model branches,
 * but not for matching full clinical warnings or detailed evaluation.
 */
type Row = [string, Antibiotic, number, number, number, number, number, number, number | null, number | null, number, number, "none" | "normal" | "impaired", "" | "hypothermia" | "cox"];
const rows: Row[] = [
  ["T01","gentamisin",27,0,3,0.9,4.5,6.75,24,48,4.5,48,"none",""],
  ["T02","gentamisin",29,6,0,1.2,6,9,24,48,6,48,"none",""],
  ["T03","gentamisin",30,0,0,1.4,7,10.5,24,48,7,36,"none",""],
  ["T04","gentamisin",33,0,8,1.72,8.6,12.9,24,48,8.6,36,"normal",""],
  ["T05","gentamisin",34,6,0,2,10,15,24,48,10,36,"none",""],
  ["T06","gentamisin",35,0,0,2.3,11.5,17.25,24,48,11.5,24,"none",""],
  ["T07","gentamisin",40,0,12,3.45,17.25,25.875,24,48,17.25,24,"none",""],
  ["T08","gentamisin",39,0,2,3.2,16,24,24,48,16,36,"none","hypothermia"],
  ["T09","gentamisin",28,0,2,1,5,7.5,24,48,5,48,"none","hypothermia"],
  ["T10","gentamisin",30,0,5,1.3,6.5,9.75,24,48,6.5,48,"none","cox"],
  ["T11","gentamisin",38,0,5,3,15,22.5,24,48,15,24,"impaired",""],
  ["T12","gentamisin",31,0,8,1.43,7.15,10.725,24,48,7.15,36,"normal",""],
  ["T13","amikasin",26,0,3,0.8,12,12,24,24,11.2,48,"none",""],
  ["T14","amikasin",29,3,3,1.1,16.5,16.5,24,24,15.4,48,"none",""],
  ["T15","amikasin",28,0,10,1.1,16.5,16.5,24,24,13.2,36,"none",""],
  ["T16","amikasin",30,0,4,1.38,20.7,20.7,24,24,16.56,36,"normal",""],
  ["T17","amikasin",33,0,10,1.9,28.5,28.5,24,24,22.8,24,"none",""],
  ["T18","amikasin",36,0,2,2.6,39,39,24,24,31.2,24,"none",""],
  ["T19","amikasin",28,0,6,1.1,16.5,16.5,24,24,15.4,60,"impaired","cox"],
  ["T20","amikasin",39,0,1,3.3,49.5,49.5,24,24,39.6,36,"none","hypothermia"],
  ["T21","amikasin",30,0,4,1.38,20.7,20.7,24,24,16.56,36,"none",""],
  ["T22","vankomisin",26,0,2,0.74,7.4,7.4,null,null,11.1,18,"impaired",""],
  ["T23","vankomisin",26,0,5,0.8,8,12,12,12,12,12,"none",""],
  ["T24","vankomisin",30,0,10,1.45,14.5,21.75,12,12,21.75,12,"normal",""],
  ["T25","vankomisin",30,0,15,1.45,14.5,21.75,8,8,21.75,8,"normal",""],
  ["T26","vankomisin",38,0,5,3,30,45,12,12,45,12,"none",""],
  ["T27","vankomisin",38,0,9,3.1,31,46.5,12,12,46.5,8,"normal",""],
  ["T28","vankomisin",38,0,20,3,30,30,null,null,45,8,"impaired",""],
  ["T29","vankomisin",37,0,10,2.9,29,29,null,null,43.5,8,"impaired",""],
  ["T30","vankomisin",41,0,28,3.8,38,57,8,8,57,6,"none",""],
];
function makeInput(row: Row): PatientInput {
  const [, drug, ga, days, pna, weight, , , , , , , renal, modifier] = row;
  return patient({
    antibiotic: drug,
    gestationalAgeWeeks: ga,
    gestationalAgeDays: days,
    postnatalAgeDays: pna,
    currentWeightKg: weight,
    patientLabel: row[0],
    renalDataAvailable: renal !== "none",
    serumCreatinineMgDl: renal === "none" ? undefined : renal === "impaired" ? (row[0] === "T29" ? 0.6 : 1) : 0.4,
    urineOutputMlKgHour: renal === "none" ? undefined : row[0] === "T29" ? 0.8 : 2,
    therapeuticHypothermia: modifier === "hypothermia",
    coxInhibitorTherapy: modifier === "cox",
  });
}
describe("Notebook v18 reference: 30 reconstructed dose / interval cases", () => {
  it.each(rows)("%s dose and interval match expected reference", (...row) => {
    const [, , , , , , rsMin, rsMax, rsHoursMin, rsHoursMax, litDose, litHours] = row;
    const result = calculateRecommendations(makeInput(row));
    const rs=result.recommendations.institutionalPrimary;
    const lit=result.recommendations.anmf2024;
    expect(rs.dose.minTotalMg).toBeCloseTo(rsMin, 9);
    expect(rs.dose.maxTotalMg).toBeCloseTo(rsMax, 9);
    expect(lit.dose.minTotalMg).toBeCloseTo(litDose, 9);
    expect(lit.dose.maxTotalMg).toBeCloseTo(litDose, 9);
    if(rsHoursMin === null){
      expect(rs.interval.kind).toBe("single-dose-only");
    }else if(rsHoursMin === rsHoursMax){
      expect(rs.interval).toMatchObject({kind:"single",hours:rsHoursMin});
    }else{
      expect(rs.interval).toMatchObject({kind:"continuous-range",minHours:rsHoursMin,maxHours:rsHoursMax});
    }
    expect(lit.interval).toMatchObject({kind:"single",hours:litHours});
  });
});
