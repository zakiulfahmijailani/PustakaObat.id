import { intervalBounds, numberText } from "./notebook-results";
import type { CalculatorResult, ClinicalWarning } from "./types";

// Text and conditions from frozen v20 cells 5 and 6. The catalogue describes
// existing results; it never adjusts a recommendation dose or interval.
const RENAL_CRITERIA = "Kriteria gangguan ginjal UNC (2023) terpenuhi: kreatinin serum (SCr) ≥1 mg/dL, atau SCr ≥0,5 mg/dL dengan produksi urin <1 mL/kg/jam. Kriteria UNC (pedoman vankomisin) dipakai sebagai penanda untuk ketiga antibiotik (keputusan tim peneliti).";
export const ANMF_RENAL = {
  gentamisin: "ANMF, gangguan ginjal: ukur kadar trough sebelum setiap dosis. Interval di tabel adalah interval rutin; penyesuaiannya ditentukan dari kadar obat.",
  amikasin: "ANMF, gangguan ginjal sedang-berat: perpanjang interval 12-24 jam, ukur kadar trough 1 jam sebelum setiap dosis, dan tunggu hasilnya sebelum memberi dosis. Interval di tabel adalah interval rutin dan belum diperpanjang.",
  vankomisin: "ANMF, gangguan ginjal: bila memungkinkan pertimbangkan antibiotik yang tidak nefrotoksik. Bila vankomisin tetap dipakai, ukur kadar trough sebelum dosis ke-2 dan sesuaikan interval hingga trough 10-20 mg/L. Interval di tabel adalah interval rutin.",
} as const;
const RENAL_ASSUMPTION = "Hasil dihitung dengan ASUMSI fungsi ginjal normal sesuai usia (keputusan tim peneliti, agar kalkulator tetap dapat dipakai dengan data rutin), sehingga kriteria gangguan ginjal tidak dapat dinilai. Evaluasi ulang hasil ini setelah kreatinin serum tersedia.";
const RENAL_HIGH_RISK = "Pasien termasuk kelompok risiko gangguan ginjal tinggi menurut kriteria kehati-hatian tim peneliti (usia gestasi <29 minggu, berat <1,5 kg, hipotermia terapeutik, indometasin/ibuprofen, atau vankomisin; dasar kriteria tercantum pada kotak Rujukan). Asumsi fungsi ginjal normal pada pasien ini lebih mungkin keliru.";
const ORDER = { critical: 0, warning: 1, info: 2 } as const;

/** Preserve first occurrence, distinguishing severity and full displayed text. */
export function deduplicateClinicalWarnings(warnings: readonly ClinicalWarning[]): ClinicalWarning[] {
  const seen = new Set<string>();
  return warnings.filter(warning => {
    const key = JSON.stringify([warning.severity, warning.title ?? "", warning.message]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getV20ClinicalWarnings(result: CalculatorResult): ClinicalWarning[] {
  const p = result.input;
  const warnings: ClinicalWarning[] = [];
  const impaired = result.renalStatus === "renal-impairment-criteria-met";
  const ga = p.gestationalAgeWeeks + (p.gestationalAgeDays ?? 0) / 7;
  const add = (code: string, severity: ClinicalWarning["severity"], title: string, message: string) => warnings.push({code, severity, title, message});
  if (impaired) {
    const detail = p.antibiotic === "vankomisin"
      ? "Pedoman RS (UNC 2023): dosis TUNGGAL 10 mg/kg tanpa interval rutin; dosis berikutnya ditentukan dari kadar vankomisin. " + ANMF_RENAL.vankomisin
      : ANMF_RENAL[p.antibiotic] + " Kalkulator tidak menghitung penyesuaian ini secara otomatis; tentukan bersama DPJP berdasarkan kadar obat.";
    add("RENAL_REVIEW", "critical", "Kemungkinan gangguan fungsi ginjal", RENAL_CRITERIA + " " + detail);
  }
  if (!p.renalDataAvailable) {
    const highRisk = ga < 29 || p.currentWeightKg < 1.5 || p.therapeuticHypothermia || p.coxInhibitorTherapy || p.antibiotic === "vankomisin";
    add("RENAL_DATA_UNAVAILABLE", highRisk ? "critical" : "warning", highRisk ? "Data fungsi ginjal tidak diisi pada pasien berisiko tinggi" : "Data fungsi ginjal tidak diisi", RENAL_ASSUMPTION + (highRisk ? " " + RENAL_HIGH_RISK : ""));
  }
  if (result.pmaWeeks > 50) {
    add("PMA_OUTSIDE_TYPICAL_NEONATAL_RANGE", "critical", "Di luar rentang neonatus", `PMA saat ini (${result.pmaWeeks} minggu) berada di luar rentang yang dicakup nomogram neonatus. Pertimbangkan pedoman dosis pediatrik.`);
  }
  if (p.serumCreatinineMgDl !== undefined && p.urineOutputMlKgHour === undefined && p.serumCreatinineMgDl >= 0.5 && p.serumCreatinineMgDl < 1) {
    add("RENAL_URINE_OUTPUT_UNAVAILABLE", "warning", "Produksi urin tidak diisi", `Kreatinin serum ${numberText(p.serumCreatinineMgDl)} mg/dL berada pada rentang 0,5 sampai <1 mg/dL. Menurut kriteria UNC (2023), nilai ini menandakan gangguan ginjal bila produksi urin <1 mL/kg/jam. Karena produksi urin tidak diisi, kriteria tersebut tidak dapat dinilai; isi produksi urin bila tersedia.`);
  }
  if (impaired && p.postnatalAgeDays <= 3) {
    add("MATERNAL_CREATININE", "warning", "Kreatinin serum pada 72 jam pertama kehidupan", "Pada 72 jam pertama kehidupan, kreatinin serum bayi masih mencerminkan kadar kreatinin ibu (Evans dkk., 2023), sehingga nilai tinggi belum tentu menandakan gangguan ginjal bayi. Nilai tren kreatinin serum dan produksi urin bersama DPJP.");
  }
  if (p.therapeuticHypothermia && ga < 35) {
    add("HYPOTHERMIA_GESTATION", "warning", "Periksa isian hipotermia terapeutik", "Uji klinis yang menjadi dasar hipotermia terapeutik melibatkan bayi dengan usia gestasi ≥35-36 minggu (AAP Committee on Fetus and Newborn; Papile dkk., 2014). Pasien ini lahir pada usia gestasi <35 minggu; pastikan isian ini benar.");
  }
  const [rsMin, rsMax] = intervalBounds(result.recommendations.institutionalPrimary.interval);
  const [litMin] = intervalBounds(result.recommendations.anmf2024.interval);
  if (rsMin !== null && rsMax !== null && litMin !== null) {
    if (litMin > rsMax) {
      add("INTERVAL_REFERENCE_DIFFERENCE", "warning", "Interval Pedoman RS lebih pendek dari literatur", `Batas atas interval Pedoman RS (tiap ${rsMax} jam) lebih pendek dibanding ANMF (tiap ${litMin} jam) untuk profil pasien ini. Pertimbangkan risiko akumulasi obat dan toksisitas; diskusikan dengan DPJP/Tim Farmasi Klinis.`);
    } else if (litMin < rsMin) {
      add("INTERVAL_REFERENCE_DIFFERENCE", "warning", "Interval Pedoman RS lebih panjang dari literatur", `Batas bawah interval Pedoman RS (tiap ${rsMin} jam) lebih panjang dibanding ANMF (tiap ${litMin} jam). Pastikan kadar obat tidak di bawah kadar terapi.`);
    }
  }
  return deduplicateClinicalWarnings(warnings).sort((a,b) => ORDER[a.severity] - ORDER[b.severity]);
}
