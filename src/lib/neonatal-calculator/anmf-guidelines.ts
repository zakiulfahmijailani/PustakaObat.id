import type { DoseRecommendation, IntervalRecommendation, PatientInput } from "./types";

function fixedDose(mgPerKg: number, weightKg: number): DoseRecommendation {
  return {
    minMgPerKg: mgPerKg,
    maxMgPerKg: mgPerKg,
    minTotalMg: mgPerKg * weightKg,
    maxTotalMg: mgPerKg * weightKg,
  };
}

export function anmfGentamicin(
  input: PatientInput,
  pmaWeeks: number,
): { dose: DoseRecommendation; interval: IntervalRecommendation; notes: string[] } {
  let hours = pmaWeeks < 30 ? 48 : pmaWeeks < 35 ? 36 : 24;
  const notes: string[] = [];
  if (input.therapeuticHypothermia) {
    hours = 36;
    notes.push("Hipotermia terapeutik: periksa kadar trough sebelum setiap dosis.");
  } else if (input.coxInhibitorTherapy) {
    hours += 12;
    notes.push("Terapi indometasin/ibuprofen: interval awal diperpanjang 12 jam.");
  }
  notes.push(
    "Interval ini merupakan interval awal; sesuaikan menggunakan kadar gentamisin 22 jam setelah dosis ke-2. Target trough <2 mg/L dan peak 5–12 mg/L.",
  );
  return {
    dose: fixedDose(5, input.currentWeightKg),
    interval: { kind: "single", hours, label: `q${hours}h` },
    notes,
  };
}

export function anmfAmikacin(
  input: PatientInput,
  pmaWeeks: number,
): { dose: DoseRecommendation; interval: IntervalRecommendation; notes: string[] } {
  let mgPerKg: number;
  let hours: number;
  if (pmaWeeks < 29) {
    if (input.postnatalAgeDays <= 7) [mgPerKg, hours] = [14, 48];
    else if (input.postnatalAgeDays <= 28) [mgPerKg, hours] = [12, 36];
    else [mgPerKg, hours] = [12, 24];
  } else if (pmaWeeks < 34) {
    [mgPerKg, hours] = input.postnatalAgeDays <= 7 ? [12, 36] : [12, 24];
  } else {
    [mgPerKg, hours] = [12, 24];
  }
  const notes: string[] = [];
  if (input.therapeuticHypothermia || input.coxInhibitorTherapy) {
    hours += 12;
    notes.push("Hipotermia terapeutik dan/atau terapi COX inhibitor: interval diperpanjang 12 jam.");
  }
  notes.push("Target peak 20–35 mg/L, hingga 40 mg/L pada infeksi berat; target trough <5 mg/L.");
  return {
    dose: fixedDose(mgPerKg, input.currentWeightKg),
    interval: { kind: "single", hours, label: `q${hours}h` },
    notes,
  };
}

export function anmfVancomycin(
  input: PatientInput,
  pmaWeeks: number,
): { dose: DoseRecommendation; interval: IntervalRecommendation; notes: string[] } {
  let hours: number;
  if (pmaWeeks < 30) hours = input.postnatalAgeDays <= 2 ? 18 : 12;
  else if (pmaWeeks < 37) hours = input.postnatalAgeDays <= 14 ? 12 : 8;
  else if (pmaWeeks < 45) hours = input.postnatalAgeDays <= 7 ? 12 : 8;
  else hours = 6;
  const notes = ["Target trough 10–20 mg/L; peak bila diperiksa 20–40 mg/L."];
  if (input.severeSepsisOrHighRiskInfection) {
    notes.push("Pertimbangkan loading dose 20 mg/kg; bukti pada neonatus terbatas. Ini bukan penambahan otomatis pada dosis rumatan.");
  }
  if (input.therapeuticHypothermia) {
    notes.push("Periksa trough sebelum dosis ke-2 dan tunggu hasil sebelum dosis berikutnya.");
  }
  return {
    dose: fixedDose(15, input.currentWeightKg),
    interval: { kind: "single", hours, label: `q${hours}h` },
    notes,
  };
}
