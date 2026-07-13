import type { Antibiotic } from "./types";

export const CALCULATOR_RULE_VERSION = "2026.07.13-production-2";

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

export const QUALITATIVE_REFERENCE_NOTES: Record<Antibiotic, readonly string[]> = {
  gentamisin: [
    "WHO 2024: ampisilin/penisilin + gentamisin merupakan regimen empiris lini pertama untuk sepsis bayi 0–59 hari; rujukan dosis 5–7,5 mg/kg/kali dan durasi minimal 10 hari, tanpa nomogram interval berbasis usia gestasi.",
    "Swiss Society of Neonatology 2024: amoksisilin + aminoglikosida tetap pilihan pertama; fokus pada keputusan memulai/menghentikan terapi, bukan rincian dosis.",
    "JAID/JSC 2021: pedoman umum sepsis dan infeksi aliran darah terkait kateter; tidak memuat tabel dosis gentamisin neonatal rinci.",
    "ACOG 2020/AAP: ACOG membahas profilaksis intrapartum ibu; AAP merekomendasikan ampisilin + gentamisin secara empiris tanpa merinci dosis neonatal.",
  ],
  amikasin: [
    "WHO 2024: amikasin bukan regimen inti; dapat menjadi alternatif di wilayah dengan resistensi gentamisin tinggi.",
    "Swiss Society of Neonatology 2024: tidak merinci amikasin; fokus pada keputusan memulai/menghentikan terapi empiris.",
    "JAID/JSC 2021: tidak memuat tabel dosis amikasin neonatal rinci.",
    "ACOG 2020/AAP: tidak membahas dosis amikasin neonatal secara langsung; ACOG berfokus pada profilaksis GBS pada ibu.",
  ],
  vankomisin: [
    "WHO 2024: vankomisin bukan regimen inti sepsis neonatal; penggunaannya selektif untuk kecurigaan MRSA/CoNS di fasilitas rujukan.",
    "Swiss Society of Neonatology 2024: tidak merinci vankomisin; fokus pada patogen utama early-onset sepsis.",
    "JAID/JSC 2021: vankomisin dapat dikombinasikan pada kecurigaan pneumokokus resisten beta-laktam atau MRSA, tanpa tabel dosis neonatal spesifik.",
    "ACOG 2020/AAP: vankomisin dibahas sebagai profilaksis intrapartum ibu pada kondisi tertentu, bukan sebagai dosis neonatal; penggunaan neonatal umumnya terkait sepsis awitan lambat atau dugaan MRSA.",
  ],
};
