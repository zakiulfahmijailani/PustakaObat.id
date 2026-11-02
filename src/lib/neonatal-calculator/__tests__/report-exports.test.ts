import { describe, expect, it } from "vitest";
import { calculateRecommendations } from "../recommendation-engine";
import { evaluateRegimen } from "../evaluation-engine";
import { patient } from "./fixtures";
import { BATCH_COLUMNS, processBatchTable } from "../batch-engine";
import { buildBatchSummaryPdf, buildEvaluationPdf, buildRecommendationPdf } from "../pdf-reports";
import { summarizeBatch, shapiroWilk } from "../batch-statistics";

describe("PDF laporan neonatal", () => {
  const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  const plainText = (bytes: Uint8Array) => [...decode(bytes).matchAll(/\((.*)\) Tj/g)]
    .map(match => match[1].replace(/\\([\\()])/g, "$1")).join(" ");
  it("menghasilkan berkas PDF rekomendasi nyata", () => {
    const bytes = buildRecommendationPdf(calculateRecommendations(patient()));
    expect(decode(bytes).startsWith("%PDF-1.4")).toBe(true);
    expect(decode(bytes)).toContain("xref");
    expect(decode(bytes)).toContain("Literatur Terkini");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
  it("menghasilkan evaluasi dengan dan tanpa bagian manual", () => {
    const result = calculateRecommendations(patient());
    const evaluation = evaluateRegimen(result, {
      manualDoseMinMg: 7.5, manualDoseMaxMg: 11.25,
      manualIntervalMinHours: 24, manualIntervalMaxHours: 48,
      actualDoseMg: 8, actualIntervalHours: 24,
    });
    expect(decode(buildEvaluationPdf(result,evaluation,false))).not.toContain("Manual dosis:");
    expect(decode(buildEvaluationPdf(result,evaluation,true))).toContain("Manual dosis:");
  });
  it("menempatkan dosis, frekuensi, dan hasil evaluasi pada kolom rujukan yang benar", () => {
    const result = calculateRecommendations(patient({
      antibiotic: "amikasin", gestationalAgeWeeks: 30, postnatalAgeDays: 4, currentWeightKg: 1.38,
    }));
    const evaluation = evaluateRegimen(result, {
      actualDoseMg: 21, actualIntervalHours: 24, manualDoseMinMg: 21, manualDoseMaxMg: 21,
      manualIntervalMinHours: 24, manualIntervalMaxHours: 24,
    });
    const text = decode(buildEvaluationPdf(result, evaluation, true));
    const cells = [...text.matchAll(/([\d.]+) ([\d.]+) Td\n\((.*)\) Tj/g)];
    const column = (left: number, right: number) => cells.filter(match => Number(match[1]) >= left && Number(match[1]) < right)
      .map(match => match[3].replace(/\\([\\()])/g, "$1")).join(" ");
    const rs = column(166, 353), literature = column(361, 548);
    expect(rs).toContain("20,7 mg");
    expect(rs).toContain("tiap 24 jam");
    expect(rs).toContain("Berlebih (+0,3 mg; +1,4%)");
    expect(literature).toContain("16,56 mg");
    expect(literature).toContain("tiap 36 jam");
    expect(literature).toContain("Berlebih (+4,44 mg; +26,8%)");
    for (const target of evaluation.targets.filter(target => [result.recommendations.institutionalPrimary.id, result.recommendations.anmf2024.id].includes(target.recommendationId))) {
      const actualColumn = target.recommendationId === result.recommendations.institutionalPrimary.id ? rs : literature;
      expect(actualColumn).toContain(target.actualInterval.message);
      expect(actualColumn).toContain(target.manualDose.summary);
      expect(actualColumn).toContain(target.manualInterval.summary);
    }
  });

  it("menyertakan ringkasan aktual sebelum peringatan pasien pada PDF evaluasi saja", () => {
    const result = calculateRecommendations(patient({ antibiotic: "amikasin", gestationalAgeWeeks: 30, postnatalAgeDays: 4, currentWeightKg: 1.38, renalDataAvailable: false, serumCreatinineMgDl: undefined, urineOutputMlKgHour: undefined }));
    const evaluation = evaluateRegimen(result, {
      actualDoseMg: 21, actualIntervalHours: 24, manualDoseMinMg: 1, manualDoseMaxMg: 1,
      manualIntervalMinHours: 72, manualIntervalMaxHours: 72,
    });
    const text = plainText(buildEvaluationPdf(result, evaluation, true));
    expect(text).toContain("PERINGATAN: Pemberian aktual BERLEBIH dibanding rujukan");
    expect(text).toContain("Dosis aktual vs Pedoman RS: Berlebih (+0,3 mg; +1,4%)");
    expect(text).toContain("Frekuensi aktual vs Literatur Terkini: Berlebih (+0,333 dosis/hari; +50,0%");
    expect(text.indexOf("Pemberian aktual BERLEBIH")).toBeLessThan(text.indexOf("Data fungsi ginjal tidak diisi"));
    expect(plainText(buildRecommendationPdf(result))).not.toContain("Pemberian aktual BERLEBIH");
  });

  it("mengulang judul kolom saat isi tabel panjang berlanjut dan mempertahankan setiap kata", () => {
    const result = calculateRecommendations(patient());
    const markers = Array.from({ length: 500 }, (_, index) => `CATATAN${String(index).padStart(3, "0")}`);
    result.recommendations.anmf2024.notes.push(markers.join(" ") + " " + "Z".repeat(400));
    const text = decode(buildRecommendationPdf(result));
    expect(text).toContain("Rekomendasi dosis \\(lanjutan\\)");
    expect((text.match(/\(Pedoman Rumah Sakit\) Tj/g) ?? []).length).toBeGreaterThan(1);
    for (const marker of markers) expect(text).toContain(marker);
    expect((text.match(/Z/g) ?? []).length).toBeGreaterThanOrEqual(400);
  });
  it("menghasilkan ringkasan batch PDF", () => {
    const batch=processBatchTable([BATCH_COLUMNS,[
      "P-01","Gentamisin",32,0,5,1.5,0.4,2,"Tidak","Tidak","Tidak",
      7.5,11.25,24,48,8,24
    ]]);
    const bytes=buildBatchSummaryPdf(batch);
    expect(decode(bytes)).toContain("Ringkasan Evaluasi Batch");
    expect(bytes[0]).toBe(37);
  });

  it("menjelaskan singkatan yang dipakai dan menghapus label evaluasi ganda tanpa mengubah hasil", () => {
    const result = calculateRecommendations(patient({ antibiotic: "amikasin", gestationalAgeWeeks: 30, postnatalAgeDays: 4, currentWeightKg: 1.38 }));
    const evaluation = evaluateRegimen(result, {
      actualDoseMg: 21, actualIntervalHours: 24, manualDoseMinMg: 21, manualDoseMaxMg: 21,
      manualIntervalMinHours: 24, manualIntervalMaxHours: 24,
    });
    const before = JSON.stringify({ result, evaluation });
    for (const bytes of [buildRecommendationPdf(result), buildEvaluationPdf(result, evaluation, true)]) {
      const text = plainText(bytes);
      expect(text).toContain("Keterangan singkatan");
      expect(text).toContain("PMA = usia pascamenstruasi");
      expect(text).toContain("GA = usia gestasi; PNA = usia pascalahir");
      expect(text).toContain("ANMF = Australasian Neonatal Medicines Formulary");
      expect(text).toContain("q24h = tiap 24 jam");
      expect(text).toContain("RS = Rumah Sakit; RSUP = Rumah Sakit Umum Pusat");
      expect(text).toContain("interval antardosis");
      expect(text).not.toMatch(/berlebih -|sesuai -|lebih-pendek|tidak-dapat-dievaluasi/);
      expect(text).not.toContain("COX =");
    }
    const text = plainText(buildEvaluationPdf(result, evaluation, true));
    expect(text).toContain("Berlebih (+0,3 mg; +1,4%)");
    expect(text).toContain("Berlebih (+4,44 mg; +26,8%)");
    expect(text).toContain("+0,333 dosis/hari; +50,0%");
    expect(JSON.stringify({ result, evaluation })).toBe(before);
  });

  it("menjelaskan kondisi tanpa interval rutin dan mengganti ringkasan manual kosong dengan istilah yang jelas", () => {
    const result = calculateRecommendations(patient({ antibiotic: "vankomisin", serumCreatinineMgDl: 1.2 }));
    const evaluation = evaluateRegimen(result, {
      actualDoseMg: 15, actualIntervalHours: null, manualDoseMinMg: 15, manualDoseMaxMg: 15,
      manualIntervalMinHours: null, manualIntervalMaxHours: null,
    });
    const text = plainText(buildEvaluationPdf(result, evaluation, true));
    expect(text).toContain("Tidak dapat dievaluasi. Interval aktual tidak diisi.");
    expect(text).toContain("Manual interval: Tidak dapat dievaluasi Tidak dapat dievaluasi");
    expect(text).not.toContain("tidak-dapat-dievaluasi");
    expect(text).toContain("UNC = University of North Carolina Medical Center");
    expect(text).not.toContain("GA =");
  });

  it("mempertahankan arti status opsi interval yang tidak cocok meskipun ringkasan frekuensi menyebut Sesuai", () => {
    const result = calculateRecommendations(patient());
    result.recommendations.institutionalPrimary.interval = { kind: "discrete", allowedHours: [24, 48], label: "24 atau 48 jam" };
    const evaluation = evaluateRegimen(result, {
      actualDoseMg: 8, actualIntervalHours: 36, manualDoseMinMg: 8, manualDoseMaxMg: 8,
      manualIntervalMinHours: 36, manualIntervalMaxHours: 36,
    });
    expect(evaluation.targets[0].actualInterval.status).toBe("opsi-diskrit-tidak-cocok");
    expect(evaluation.targets[0].actualInterval.message).toBe("Sesuai");
    const text = plainText(buildEvaluationPdf(result, evaluation, true));
    expect(text).toContain("Tidak sesuai opsi interval. Interval aktual: tiap 36 jam; opsi rujukan: tiap 24 jam atau tiap 48 jam.");
    expect(text).not.toContain("opsi-diskrit-tidak-cocok");
    expect(text).toContain("Minimum:");
    expect(text).toContain("Maksimum:");
  });

  it("mengapitalisasi kategori dan antibiotik pada PDF batch tanpa mengubah jumlah atau statistik", () => {
    const row = ["P-01","Gentamisin",32,0,5,1.5,0.4,2,"Tidak","Tidak","Tidak",7.5,11.25,24,48,8,24];
    const batch = processBatchTable([BATCH_COLUMNS, ...[1, 2, 3].map(n => [`P-${n}`, ...row.slice(1)])]);
    const text = plainText(buildBatchSummaryPdf(batch));
    expect(text).toContain("Pedoman Rumah Sakit / Sesuai: 3/3 (100.0%)");
    expect(text).toContain("Gentamisin / Dosis aktual");
    expect(text).not.toContain("gentamisin /");
    expect(text).toContain("Keterangan singkatan");
  });

  it("menampilkan kotak berlabel sesuai tingkat peringatan, berurutan, tanpa pesan ganda", () => {
    const result = calculateRecommendations(patient({
      antibiotic: "amikasin", gestationalAgeWeeks: 30, postnatalAgeDays: 4, currentWeightKg: 1.38,
      renalDataAvailable: false, serumCreatinineMgDl: undefined, urineOutputMlKgHour: undefined,
    }));
    result.recommendations.anmf2024.warnings.push(result.globalWarnings[0]);
    result.globalWarnings.push({ code: "INFO_RENDER", severity: "info", title: "Informasi tambahan", message: "Periksa simbol ≥ 0,5 dan ≤ 1,0." });
    const evaluation = evaluateRegimen(result, {
      manualDoseMinMg: 21, manualDoseMaxMg: 21, manualIntervalMinHours: 24, manualIntervalMaxHours: 24,
      actualDoseMg: 21, actualIntervalHours: 24,
    });
    for (const bytes of [buildRecommendationPdf(result), buildEvaluationPdf(result, evaluation, false)]) {
      const text = decode(bytes);
      expect(text).toContain(" re B");
      expect(text).toContain("PERINGATAN: Data fungsi ginjal");
      expect(text).toContain("PERHATIAN: Interval Pedoman RS");
      expect(text).toContain("INFORMASI: Informasi tambahan.");
      expect(text).toContain("Periksa simbol >= 0,5 dan <= 1,0.");
      expect(text.indexOf("PERINGATAN: Data fungsi ginjal")).toBeLessThan(text.indexOf("PERHATIAN: Interval Pedoman RS"));
      expect(text.indexOf("PERHATIAN: Interval Pedoman RS")).toBeLessThan(text.indexOf("INFORMASI: Informasi tambahan."));
      expect(text.match(/Data fungsi ginjal tidak diisi pada pasien berisiko tinggi/g)).toHaveLength(1);
    }
  });

  it("mempertahankan seluruh pesan panjang dan menandai kelanjutan pada halaman berikutnya", () => {
    const result = calculateRecommendations(patient());
    const markers = Array.from({ length: 600 }, (_, index) => `MARCADOR${String(index).padStart(3, "0")}`);
    result.globalWarnings = [{ code: "LONG_RENDER", severity: "critical", title: "Pesan panjang", message: markers.join(" ") + " " + "Z".repeat(400) }];
    const text = decode(buildRecommendationPdf(result));
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    expect(text).toContain("lanjutan");
    for (const marker of markers) expect(text).toContain(marker);
    expect((text.match(/Z/g) ?? []).length).toBeGreaterThanOrEqual(400);
  });
});

describe("statistik batch eksploratif", () => {
  it("tidak menguji Shapiro–Wilk untuk kurang dari tiga pasang atau data konstan", () => {
    expect(shapiroWilk([1,2])).toBeNull();
    expect(shapiroWilk([1,1,1])).toBeNull();
  });
  it("membuat kelompok ringkasan untuk setiap antibiotik", () => {
    const result=processBatchTable([BATCH_COLUMNS,["P-01","Gentamisin",32,0,5,1.5,0.4,2,"Tidak","Tidak","Tidak",7.5,11.25,24,48,8,24]]);
    const summary=summarizeBatch(result);
    expect(summary.counts.some(row=>row.group==="Keseluruhan")).toBe(true);
    expect(summary.counts.some(row=>row.group==="gentamisin")).toBe(true);
    expect(summary.paired.some(row=>row.n===1 && row.method==="Tidak diuji")).toBe(true);
  });
});
