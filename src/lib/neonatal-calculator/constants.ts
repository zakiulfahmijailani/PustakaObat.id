import type { Antibiotic } from "./types";

export const CALCULATOR_RULE_VERSION = "2026.07.13-production-1";

export const CLINICAL_DISCLAIMER =
  "Alat ini merupakan clinical decision support dan bukan pengganti penilaian klinis apoteker, dokter penanggung jawab pasien (DPJP), maupun therapeutic drug monitoring. Selalu verifikasi dengan SPO/formularium rumah sakit versi terbaru, kondisi klinis pasien, fungsi ginjal, dan hasil kadar obat bila tersedia.";

export const INPUT_LIMITS = {
  gestationalAgeWeeks: { min: 22, max: 43 },
  postnatalAgeDays: { min: 0, max: 365 },
  currentWeightKg: { exclusiveMin: 0.3, max: 10 },
  serumCreatinineMgDl: { min: 0, max: 10 },
  urineOutputMlKgHour: { min: 0, max: 10 },
  patientLabelMaxLength: 60,
} as const;

export const RENAL_THRESHOLDS = {
  serumCreatinineHighMgDl: 1,
  serumCreatinineWithLowUrineOutputMgDl: 0.5,
  lowUrineOutputMlKgHour: 1,
} as const;

export const ANTIBIOTIC_LABELS: Record<Antibiotic, string> = {
  gentamisin: "Gentamisin",
  amikasin: "Amikasin",
  vankomisin: "Vankomisin",
};

export const QUALITATIVE_REFERENCE_NOTES = [
  "WHO 2024: konteks pemilihan dan tata laksana antibiotik pada infeksi bakteri serius bayi; bukan nomogram dosis neonatal rinci untuk kalkulator ini.",
  "Swiss Society of Neonatology 2024: pendekatan berbasis probabilitas pada risiko early-onset sepsis; tidak digunakan sebagai aturan hitung dosis.",
  "JAID/JSC 2021: konteks strategi tata laksana sepsis dan infeksi terkait kateter; tidak digunakan sebagai tabel dosis neonatal.",
  "ACOG/AAP: konteks pencegahan dan tata laksana early-onset sepsis; tidak digabungkan ke nomogram dosis.",
] as const;
