import { INPUT_LIMITS } from "./constants";
import type { Antibiotic } from "./types";

// User-facing guidance follows frozen notebook v20 cell 8 (buat_form_pasien)
// and the clinical combination notes in notebook cell 5.
// This module changes labels/help text only, never a clinical rule.
export type V20ContextFlag = "therapeuticHypothermia" | "coxInhibitorTherapy" | "severeSepsisOrHighRiskInfection";

const labels: Record<V20ContextFlag, string> = {
  therapeuticHypothermia: "Hipotermia terapeutik (pada ensefalopati hipoksik-iskemik)",
  coxInhibitorTherapy: "Sedang mendapat indometasin / ibuprofen (penghambat siklooksigenase)",
  severeSepsisOrHighRiskInfection: "Khusus vankomisin: dugaan sepsis berat (termasuk MRSA), infeksi tulang, meningitis, atau endokarditis",
};

const general = {
  therapeuticHypothermia: "Memperpanjang interval Literatur Terkini gentamisin dan amikasin; menambah catatan pemantauan kadar vankomisin.",
  coxInhibitorTherapy: "Memperpanjang interval Literatur Terkini gentamisin dan amikasin 12 jam.",
  severeSepsisOrHighRiskInfection: "Hanya menambah catatan dosis muatan vankomisin; angka dosis rumatan tidak berubah.",
} as const;

const effects: Record<Antibiotic, Record<V20ContextFlag, string>> = {
  gentamisin: {
    therapeuticHypothermia: "Literatur Terkini (ANMF): interval minimal 36 jam atau mengikuti nomogram bila lebih panjang (ketetapan tim peneliti); pemeriksaan trough sebelum setiap dosis.",
    coxInhibitorTherapy: "Literatur Terkini (ANMF): interval bertambah 12 jam jika hipotermia tidak dicentang. Jika keduanya dicentang, kalkulator memakai aturan hipotermia saja (ketetapan tim peneliti).",
    severeSepsisOrHighRiskInfection: "Khusus vankomisin; pilihan ini tidak memengaruhi perhitungan gentamisin.",
  },
  amikasin: {
    therapeuticHypothermia: "Literatur Terkini (ANMF): interval bertambah 12 jam; bila indometasin/ibuprofen juga dicentang, penambahan dilakukan sekali.",
    coxInhibitorTherapy: "Literatur Terkini (ANMF): interval bertambah 12 jam; bila hipotermia juga dicentang, penambahan dilakukan sekali (ketetapan tim peneliti).",
    severeSepsisOrHighRiskInfection: "Khusus vankomisin; pilihan ini tidak memengaruhi perhitungan amikasin.",
  },
  vankomisin: {
    therapeuticHypothermia: "Literatur Terkini (ANMF): menambah catatan pemantauan trough sebelum dosis ke-2; tidak mengubah angka dosis atau interval.",
    coxInhibitorTherapy: "Dalam kalkulator v20, pilihan ini tidak mengubah dosis atau interval vankomisin.",
    severeSepsisOrHighRiskInfection: "ANMF: hanya menambah catatan pertimbangan dosis muatan 20 mg/kg; tidak mengubah angka dosis rumatan pada tabel.",
  },
};

export function getV20ContextCheckboxes(antibiotic: Antibiotic | "") {
  const detail = antibiotic ? effects[antibiotic] : general;
  return (Object.keys(labels) as V20ContextFlag[]).map(key => ({
    key,
    label: labels[key],
    effect: detail[key],
  }));
}

export const V20_RENAL_DATA_HELP =
  "Jika tidak dicentang, fungsi ginjal diasumsikan normal sesuai usia (ketetapan tim peneliti). " +
  "Jika dicentang, kreatinin serum wajib diisi; produksi urin opsional.";

export const V20_MANUAL_COMPARISON_HELP =
  "Jika dicentang, isi hasil hitung manual sebagai pembanding. Untuk satu nilai, isi batas bawah dan batas atas sama. " +
  "Jika tidak dicentang, kolom hitung manual tidak ditampilkan.";

const idNumber = (n: number) => String(n).replace(".", ",");

/** Limits are typo-prevention/input guardrails, NOT clinical eligibility thresholds. */
export function getV20InputReasonablenessNote(): string {
  const l = INPUT_LIMITS;
  return "Batas isian (usia gestasi " + l.gestationalAgeWeeks.min + "–" + l.gestationalAgeWeeks.max +
    " minggu, usia pascalahir " + l.postnatalAgeDays.min + "–" + l.postnatalAgeDays.max +
    " hari, berat " + idNumber(l.currentWeightKg.min) + "–" + idNumber(l.currentWeightKg.max) +
    " kg, kreatinin serum " + l.serumCreatinineMgDl.min + "–" + l.serumCreatinineMgDl.max +
    " mg/dL, produksi urin " + l.urineOutputMlKgHour.min + "–" + l.urineOutputMlKgHour.max +
    " mL/kg/jam) adalah batas kewajaran isian untuk mencegah salah ketik, bukan batas klinis.";
}
