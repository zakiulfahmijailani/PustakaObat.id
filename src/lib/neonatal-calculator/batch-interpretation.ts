import type { BatchProcessingResult, BatchSuccessRow } from "./batch-engine";
import { summarizeBatch, type ComparisonMetric, type PairedStatistic, type ReferenceName } from "./batch-statistics";
import { notebookBatchRecord } from "./notebook-results";
import { pythonFixed } from "./python-rounding";

export type InterpretationParagraph = {
  kind: "normal" | "poin" | "penting";
  text: string;
};
export type InterpretationSection = { title: string; paragraphs: InterpretationParagraph[] };

const antibiotics = ["Gentamisin", "Amikasin", "Vankomisin"] as const;
const percent = (value: number, total: number) => total ? 100 * value / total : 0;
const fixed = (value: number, digits: number) => pythonFixed(value, digits);
const signed = (value: number) => (value >= 0 ? "+" : "") + fixed(value, 3);

/** Port of notebook v19 cell 14 buat_interpretasi; wording and branches are reference-tested. */
export function buildBatchInterpretation(
  result: BatchProcessingResult,
  statistics = summarizeBatch(result),
): InterpretationSection[] {
  const records = result.rows
    .filter((row): row is BatchSuccessRow => row.status === "berhasil")
    .map(notebookBatchRecord);
  if (records.length === 0) return [{
    title: "Interpretasi",
    paragraphs: [{ kind: "normal", text: "Tidak ada data valid untuk diinterpretasikan." }],
  }];

  const distribution = (key: string, subset = records) => {
    const values = subset.map(record => record[key]).filter(value => value !== "");
    return {
      total: values.length,
      same: values.filter(value => value === "Sesuai").length,
      higher: values.filter(value => value === "Berlebih").length,
      lower: values.filter(value => value === "Kurang").length,
    };
  };
  const testFor = (antibiotic: string, metric: ComparisonMetric, reference: ReferenceName) =>
    statistics.paired.find(test => test.group === antibiotic.toLowerCase()
      && test.metric === metric && test.reference === reference);
  // The notebook does not interpret n<3 or failed tests; all-zero pairs have a special label.
  const usable = (test: PairedStatistic | undefined): test is PairedStatistic & { pValue: number; medianDifference: number } =>
    test !== undefined && test.n >= 3 && test.pValue !== null && test.medianDifference !== null;
  const methodName = (test: PairedStatistic) => test.note === "Seluruh selisih nol"
    ? "(semua selisih = 0)" : test.method === "paired t-test" ? "Paired t-test" : test.method;
  const sections: InterpretationSection[] = [];
  let paragraphs: InterpretationParagraph[] = [{
    kind: "normal",
    text: `Total ${records.length} pasien dianalisis. Ringkasan berikut menilai kesesuaian pemberian NYATA (aktual) terhadap perhitungan aplikasi.`,
  }];
  for (const [kind, key, reference] of [
    ["Dosis", "_ka_rs", "Pedoman RS"], ["Dosis", "_ka_lit", "Literatur"],
    ["Frekuensi", "_kfa_rs", "Pedoman RS"], ["Frekuensi", "_kfa_lit", "Literatur"],
  ]) {
    const { total, same, higher, lower } = distribution(key);
    if (!total) continue;
    const p = percent(same, total);
    const direction = higher === 0 && lower === 0 ? "seluruhnya dalam rentang rekomendasi"
      : higher > lower ? "cenderung BERLEBIH (dosis/frekuensi lebih dari rekomendasi)"
        : lower > higher ? "cenderung KURANG (dosis/frekuensi kurang dari rekomendasi)"
          : "tersebar seimbang antara berlebih dan kurang";
    paragraphs.push({ kind: p < 50 ? "penting" : "poin", text:
      `${kind} aktual vs ${reference}: ${fixed(p, 0)}% Sesuai (${same}/${total}), ${fixed(percent(higher, total), 0)}% Berlebih, ${fixed(percent(lower, total), 0)}% Kurang; ${direction}.` });
  }
  let worst: { antibiotic: string; percentage: number; total: number } | undefined;
  for (const antibiotic of antibiotics) {
    const { total, same } = distribution("_ka_rs", records.filter(record => record.Antibiotik === antibiotic));
    const percentage = percent(same, total);
    if (total && (!worst || percentage < worst.percentage)) worst = { antibiotic, percentage, total };
  }
  if (worst) paragraphs.push({ kind: "penting", text:
    `Kesesuaian dosis aktual (vs RS) terendah pada ${worst.antibiotic} (${fixed(worst.percentage, 0)}% sesuai, n=${worst.total}) -- perlu perhatian khusus pada peresepan antibiotik ini.` });
  sections.push({ title: "1. Ringkasan Kesesuaian Pemberian Aktual", paragraphs });

  paragraphs = [{ kind: "normal", text: "Uji beda menilai apakah nilai AKTUAL menyimpang bermakna dari titik tengah rekomendasi aplikasi. Uji dipilih otomatis (paired t-test bila selisih normal; Wilcoxon bila tidak)." }];
  let significantActual = false;
  for (const [kind, unit] of [["Dosis", "mg/kg"], ["Frekuensi", "dosis/hari"]] as const) {
    for (const antibiotic of antibiotics) {
      for (const [reference, label] of [["Pedoman Rumah Sakit", "rekomendasi RS"], ["Literatur Terkini", "rekomendasi Literatur"]] as const) {
        const test = testFor(antibiotic, `${kind} aktual`, reference);
        if (!usable(test)) continue;
        const subject = `${kind} aktual ${antibiotic} vs ${label}`;
        const median = test.medianDifference;
        if (test.pValue < 0.05) {
          significantActual = true;
          const direction = median > 0 ? "lebih tinggi" : median < 0 ? "lebih rendah" : "setara";
          paragraphs.push({ kind: "penting", text:
            `${subject} BERBEDA SIGNIFIKAN dari ${label} (${methodName(test)}, p=${fixed(test.pValue, 4)}); median selisih ${signed(median)} ${unit} (${direction}).` });
        } else paragraphs.push({ kind: "poin", text:
          `${subject} tidak berbeda signifikan dari ${label} (p=${fixed(test.pValue, 4)}); median selisih ${signed(median)} ${unit}.` });
      }
    }
  }
  if (!significantActual) paragraphs.push({ kind: "poin", text: "Secara umum tidak ditemukan perbedaan signifikan yang menonjol antara pemberian aktual dan rekomendasi (dengan ukuran sampel saat ini)." });
  sections.push({ title: "2. Interpretasi Uji Beda: Pemberian Aktual vs Rekomendasi Aplikasi", paragraphs });

  paragraphs = [{ kind: "normal", text: "Bagian ini menilai seberapa konsisten (andal) perhitungan APLIKASI dibandingkan HITUNG MANUAL tenaga kesehatan. Aplikasi memakai berat badan eksak (tanpa pembulatan); hitung manual umumnya membulatkan berat badan." }];
  for (const [kind, unit] of [["Dosis", "mg/kg"], ["Frekuensi", "dosis/hari"]] as const) {
    const tests = antibiotics.map(antibiotic => ({ antibiotic, test: testFor(antibiotic, `${kind} manual`, "Pedoman Rumah Sakit") }))
      .filter((item): item is { antibiotic: typeof antibiotics[number]; test: PairedStatistic & { pValue: number; medianDifference: number } } => usable(item.test));
    if (tests.length === 0) {
      paragraphs.push({ kind: "poin", text: `${kind}: data hitung manual tidak memadai untuk uji reliabilitas (perlu >=3 pasien per antibiotik).` });
      continue;
    }
    const significant = tests.filter(({ test }) => test.pValue < 0.05);
    if (significant.length === 0) {
      const medians = tests.map(({ test }) => test.medianDifference);
      paragraphs.push({ kind: "penting", text:
        `${kind}: hitung manual TIDAK berbeda signifikan dari perhitungan aplikasi (RS) pada seluruh ${tests.length} antibiotik yang diuji (median selisih ${signed(Math.min(...medians))} s/d ${signed(Math.max(...medians))} ${unit}) -> aplikasi ANDAL & konsisten dengan hitung manual berbasis pedoman.` });
    } else {
      const detail = significant.map(({ antibiotic, test }) => `${antibiotic} (p=${fixed(test.pValue, 4)}, selisih ${signed(test.medianDifference)} ${unit})`).join("; ");
      paragraphs.push({ kind: "penting", text:
        `${kind}: terdapat perbedaan signifikan antara hitung manual dan aplikasi pada ${significant.length} dari ${tests.length} antibiotik: ${detail} -> tinjau penyebab (mis. pembulatan berat/usia atau versi pedoman).` });
    }
  }
  const manual = distribution("_kma_rs");
  if (manual.total) {
    const p = percent(manual.same, manual.total);
    paragraphs.push(p >= 80 ? { kind: "poin", text:
      `Secara kategorikal, ${fixed(p, 0)}% hasil hitung manual berada dalam rentang dosis rekomendasi aplikasi (RS) -> kesepakatan tinggi.` }
      : { kind: "penting", text:
        `Secara kategorikal, hanya ${fixed(p, 0)}% hasil hitung manual yang PERSIS dalam rentang dosis aplikasi (RS). Karena aplikasi TIDAK membulatkan & TIDAK memberi toleransi, selisih pembulatan kecil pada hitung manual dapat terkategori Berlebih/Kurang meski secara statistik selisihnya tidak bermakna. Ini justru menunjukkan aplikasi lebih presisi terhadap berat badan aktual.` });
  }
  sections.push({ title: "3. Reliabilitas Aplikasi vs Hitung Manual", paragraphs });

  paragraphs = [];
  const actual = distribution("_ka_rs");
  if (actual.total) {
    const p = percent(actual.same, actual.total);
    paragraphs.push({ kind: "poin", text: `Kesesuaian dosis aktual terhadap pedoman RS: ${fixed(p, 0)}% sesuai. ${p < 70 ? "Perlu audit/edukasi peresepan." : "Tergolong baik."}` });
  }
  paragraphs.push(
    { kind: "poin", text: "Aplikasi dapat dijadikan alat bantu verifikasi dosis; perhitungannya memakai berat badan eksak tanpa pembulatan. Lihat bagian 3 untuk perbandingan dengan hitung manual." },
    { kind: "penting", text: "TINDAK LANJUT: fokuskan telaah pada pemberian berkategori Berlebih (risiko toksisitas) dan Kurang (risiko subterapeutik), terutama antibiotik indeks terapi sempit ini, dan konfirmasi dengan kadar obat (TDM) bila tersedia." },
  );
  sections.push({ title: "4. Kesimpulan & Tindak Lanjut", paragraphs });
  sections.push({ title: "5. Catatan Metodologis & Keterbatasan", paragraphs: [
    { kind: "poin", text: "Nilai p menunjukkan kemaknaan statistik, BUKAN kemaknaan klinis; interpretasi akhir tetap memerlukan penilaian profesional." },
    { kind: "poin", text: "Uji beda per antibiotik memerlukan minimal 3 pasien; kelompok dengan n<3 tidak diuji." },
    { kind: "poin", text: "Titik tengah rentang dipakai sebagai acuan numerik uji beda. Kesesuaian frekuensi terhadap Pedoman RS memakai rentang interval pedoman (pedoman RS tidak membedakan usia)." },
    { kind: "poin", text: "Alat ini adalah clinical decision support, BUKAN pengganti penilaian apoteker/DPJP. Rekomendasi berbasis pedoman yang diunggah & literatur yang diverifikasi; selalu cek versi terbaru." },
  ] });
  // v19 applies Indonesian decimal punctuation to all narrative paragraphs, including p-values.
  return sections.map(section => ({ ...section, paragraphs: section.paragraphs.map(paragraph => ({
    ...paragraph, text: paragraph.text.replace(/(?<=\d)\.(?=\d)/g, ","),
  })) }));
}
