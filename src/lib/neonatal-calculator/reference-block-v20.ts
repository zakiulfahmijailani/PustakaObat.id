import type { Antibiotic } from "./types";

/**
 * User-facing Rujukan box from the frozen notebook v20:
 * cell 5 SUMBER_* and cell 6 _blok_rujukan / RUJUKAN_TAMBAHAN_PERINGATAN.
 * Text only; this module never changes doses, intervals or renal decisions.
 */
export type V20ReferenceEntry = {
  label: "Pedoman Rumah Sakit" | "Literatur Terkini" | "Peringatan tambahan" | "Ketetapan tim peneliti (bukan dari pedoman)";
  text: string;
};

const PPK = "Panduan Praktik Klinik (PPK) Sepsis Neonatal RSUP Dr. M. Djamil Padang (2017)";
const PNPK = "PNPK Tata Laksana Sepsis pada Anak, Kemenkes RI (2021)";
const UNC = "UNC Medical Center, Vancomycin Dosing & Monitoring Guide: Neonatal & Pediatric (2023)";
const ANMF = {
  gentamisin: "Gentamicin v4.0 (24 April 2024)",
  amikasin: "Amikacin v3.0 (20 April 2024; errata 2 Mei 2024)",
  vankomisin: "Vancomycin - Intermittent v3.0 (errata 21 November 2024)",
} as const;

const ADDITIONAL_WARNINGS = [
  "Evans RE, Peterson J, Kim JJ, Mahaveer A. How to know when little kidneys are in trouble: a review of current tools for diagnosing AKI in neonates. Front Pediatr. 2023;11:1270200.",
  "Papile LA, Baley JE, Benitz W, et al.; AAP Committee on Fetus and Newborn. Hypothermia and neonatal encephalopathy. Pediatrics. 2014;133(6):1146-1150.",
] as const;

const RESEARCH_DECISIONS =
  "kriteria kesesuaian; asumsi fungsi ginjal normal bila kreatinin serum tidak diisi; " +
  "kriteria gangguan ginjal UNC dipakai juga untuk gentamisin dan amikasin; " +
  "kriteria risiko gangguan ginjal tinggi (dasar: ANMF meminta pemantauan kadar lebih awal pada bayi <29 minggu, " +
  "hipotermia terapeutik, dan gangguan ginjal, serta memperpanjang interval aminoglikosida " +
  "pada terapi indometasin/ibuprofen; vankomisin bersifat nefrotoksik; " +
  "berat <1,5 kg = berat lahir sangat rendah menurut WHO).";

export function getV20ReferenceEntries(antibiotic: Antibiotic): V20ReferenceEntry[] {
  const hospital = antibiotic === "vankomisin" ? UNC : PPK + "; " + PNPK;
  return [
    {
      label: "Pedoman Rumah Sakit",
      text: hospital + ". Kriteria kesesuaian ditetapkan tim peneliti berdasarkan rujukan tersebut.",
    },
    {
      label: "Literatur Terkini",
      text: "Australasian Neonatal Medicines Formulary, " + ANMF[antibiotic] + ".",
    },
    {
      label: "Peringatan tambahan",
      text: ADDITIONAL_WARNINGS.join(" "),
    },
    {
      label: "Ketetapan tim peneliti (bukan dari pedoman)",
      text: RESEARCH_DECISIONS,
    },
  ];
}
