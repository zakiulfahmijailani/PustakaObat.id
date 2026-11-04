import { pythonRound } from "./python-rounding";
import type { DoseRecommendation, IntervalRecommendation, PatientInput } from "./types";

function fixedDose(mgPerKg: number, weightKg: number): DoseRecommendation {
  return {
    minMgPerKg: mgPerKg,
    maxMgPerKg: mgPerKg,
    minTotalMg: pythonRound(mgPerKg * weightKg,4),
    maxTotalMg: pythonRound(mgPerKg * weightKg,4),
  };
}

export function anmfGentamicin(
  input: PatientInput,
  pmaWeeks: number,
): { dose: DoseRecommendation; interval: IntervalRecommendation; notes: string[] } {
  let hours = pmaWeeks < 30 ? 48 : pmaWeeks < 35 ? 36 : 24;
  const notes: string[] = [];
  if (input.therapeuticHypothermia) {
    hours = Math.max(hours, 36);
    notes.push(
      "Hipotermia terapeutik: ANMF memakai interval 36 jam dan pengukuran kadar trough sebelum setiap dosis. "
      + "Kalkulator memakai interval yang lebih panjang antara nomogram dan 36 jam, agar interval bayi sangat prematur tidak diperpendek (keputusan tim peneliti).",
    );
    if (input.coxInhibitorTherapy) {
      notes.push("Hipotermia terapeutik dan indometasin/ibuprofen dicentang bersamaan: ANMF tidak mengatur kombinasi keduanya; kalkulator hanya menerapkan aturan hipotermia.");
    }
  } else if (input.coxInhibitorTherapy) {
    hours += 12;
    notes.push("Indometasin/ibuprofen (penghambat siklooksigenase): ANMF memperpanjang interval 12 jam.");
  }
  notes.push(
    "ANMF: interval di atas adalah interval awal. Interval berikutnya ditentukan dari kadar gentamisin 22 jam setelah dosis ke-2. Target trough <2 mg/L; peak 5–12 mg/L (tidak diperiksa rutin).",
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
  if (pmaWeeks < 30) {
    if (input.postnatalAgeDays <= 7) [mgPerKg, hours] = [14, 48];
    else if (input.postnatalAgeDays <= 28) [mgPerKg, hours] = [12, 36];
    else [mgPerKg, hours] = [12, 24];
  } else if (pmaWeeks < 35) {
    [mgPerKg, hours] = input.postnatalAgeDays <= 7 ? [12, 36] : [12, 24];
  } else {
    [mgPerKg, hours] = [12, 24];
  }
  const notes: string[] = [];
  if (input.therapeuticHypothermia || input.coxInhibitorTherapy) {
    hours += 12;
    notes.push(
      "Hipotermia terapeutik atau indometasin/ibuprofen: ANMF memperpanjang interval 12 jam. "
      + "Bila keduanya dicentang, kalkulator memperpanjang 12 jam satu kali (ANMF tidak mengatur kombinasi keduanya).",
    );
  }
  notes.push("ANMF: pemantauan kadar rutin tidak diperlukan bila terapi ≤48 jam, kecuali fungsi ginjal terganggu. Target peak 20–35 mg/L (hingga 40 mg/L pada infeksi berat atau mengancam jiwa); target trough <5 mg/L.");
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
  const notes = ["ANMF: ukur kadar trough sebelum dosis ke-3; sebelum dosis ke-2 pada bayi dengan usia pascamenstruasi <29 minggu, hipotermia terapeutik, atau gangguan ginjal. Target trough 10–20 mg/L; peak (bila diperiksa) 20–40 mg/L."];
  if (input.severeSepsisOrHighRiskInfection) {
    notes.push("ANMF: pada dugaan sepsis berat (termasuk MRSA), infeksi tulang, meningitis, atau endokarditis, pertimbangkan dosis muatan 20 mg/kg; data pada neonatus terbatas. Dosis muatan tidak dimasukkan ke angka di tabel.");
  }
  if (input.therapeuticHypothermia) {
    notes.push("ANMF: pada hipotermia terapeutik, ukur kadar trough sebelum dosis ke-2 dan tunggu hasilnya sebelum memberi dosis tersebut.");
  }
  return {
    dose: fixedDose(15, input.currentWeightKg),
    interval: { kind: "single", hours, label: `q${hours}h` },
    notes,
  };
}
