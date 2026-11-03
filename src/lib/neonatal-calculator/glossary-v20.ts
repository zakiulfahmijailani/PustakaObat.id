// Frozen v20 cell 6: preserve catalogue order, spelling, and case.
const ABBREVIATIONS = [
  ["JAID/JSC", "Japanese Association for Infectious Diseases / Japanese Society of Chemotherapy", ""],
  ["RSUP", "Rumah Sakit Umum Pusat", ""],
  ["PNPK", "Pedoman Nasional Pelayanan Kedokteran", ""],
  ["ANMF", "Australasian Neonatal Medicines Formulary", "formularium obat neonatus Australia dan Selandia Baru"],
  ["ASHP", "American Society of Health-System Pharmacists", ""],
  ["AHFS", "American Hospital Formulary Service", ""],
  ["ACOG", "American College of Obstetricians and Gynecologists", ""],
  ["IDSA", "Infectious Diseases Society of America", ""],
  ["MRSA", "Staphylococcus aureus yang resisten metisilin", ""],
  ["CoNS", "stafilokokus koagulase-negatif", ""],
  ["DPJP", "dokter penanggung jawab pasien", ""],
  ["SPO", "Standar Prosedur Operasional", ""],
  ["PPK", "Panduan Praktik Klinik", ""],
  ["PMA", "usia pascamenstruasi", "usia gestasi saat lahir + usia pascalahir, dalam minggu"],
  ["SCr", "kreatinin serum", ""],
  ["UOP", "produksi urin", ""],
  ["HIE", "ensefalopati hipoksik-iskemik", ""],
  ["COX", "siklooksigenase", "indometasin dan ibuprofen adalah penghambat COX"],
  ["UNC", "University of North Carolina Medical Center", ""],
  ["WHO", "World Health Organization", "Organisasi Kesehatan Dunia"],
  ["AAP", "American Academy of Pediatrics", ""],
  ["GBS", "Streptokokus grup B", ""],
  ["EOS", "sepsis awitan dini", ""],
  ["FDA", "Food and Drug Administration", "badan pengawas obat Amerika Serikat"],
  ["TDM", "therapeutic drug monitoring", "pemantauan kadar obat dalam darah"],
  ["IV", "intravena", ""],
  ["Kemenkes", "Kementerian Kesehatan", ""],
  ["RI", "Republik Indonesia", ""],
  ["RS", "Rumah Sakit", ""],
  ["GA", "usia gestasi", ""],
  ["PNA", "usia pascalahir", ""],
  ["UG", "usia gestasi", ""],
  ["UPL", "usia pascalahir", ""],
  ["BB", "berat badan", ""],
] as const;

// Frozen v20 cell 14: these five terms are always included after abbreviations.
const TERMS: readonly (readonly [string, string])[] = [
  ["Frekuensi", "Ditulis 'tiap X jam' (interval antardosis)."],
  ["Berlebih / Kurang (dosis)", "Di atas batas atas / di bawah batas bawah rujukan; selisih ditulis dalam mg (atau mg/kg) dan %."],
  ["Berlebih / Kurang (frekuensi)", "Lebih sering (interval lebih pendek) / lebih jarang (interval lebih panjang) dari rujukan; selisih dalam dosis/hari (24 ÷ interval) dan %, beserta selisih interval dalam jam."],
  ["Penyimpangan", "Selisih dari batas rentang rujukan terdekat (0 bila di dalam rentang); positif = di atas batas atas, negatif = di bawah batas bawah."],
  ["n, p, W", "n = jumlah pasien; p = nilai p uji dua sisi (bermakna bila p<0,05); W = statistik uji normalitas Shapiro-Wilk."],
];

/** Read report text before adding the glossary, to avoid matching itself. */
export function buildV20Glossary(reportText: string): [string, string][] {
  const rows: [string, string][] = [];
  for (const [abbreviation, meaning, note] of ABBREVIATIONS) {
    const escaped = abbreviation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match the notebook's ASCII-letter/digit boundaries, including underscores.
    if (new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`).test(reportText)) {
      rows.push([abbreviation, meaning + (note ? ` (${note})` : "")]);
    }
  }
  return [...rows, ...TERMS.map(([term, meaning]): [string,string] => [term,meaning])];
}
