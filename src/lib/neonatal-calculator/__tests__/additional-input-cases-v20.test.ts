import { describe, expect, it } from "vitest";
import { loadV20Reference } from "../../../../tests/helpers/neonatal-v20-reference";
import { processBatchTable } from "../batch-engine";
import { buildBatchResultWorkbook } from "../batch-workbook";
import { notebookBatchRecord } from "../notebook-results";

// [4.4] Additional-input acceptance. Always start from the unchanged v20 input
// workbook through the Python oracle; modifications are test-local only.
const reference = loadV20Reference();
const columns = new Map(reference.header.map((column, index) => [String(column), index]));
const codeColumn = columns.get("kode_pasien");
if (codeColumn === undefined) throw new Error("Frozen v20 input has no patient code");
const source = reference.inputRows.find(row => row[codeColumn] === "T04");
if (!source) throw new Error("Frozen v20 input is missing T04");
const frozenT04: unknown[] = source;

function caseRow(code: string, fields: Record<string, unknown> = {}): unknown[] {
  const row = [...frozenT04];
  row[codeColumn!] = code;
  for (const [column, value] of Object.entries(fields)) {
    const position = columns.get(column);
    if (position === undefined) throw new Error("Unknown frozen v20 input field: " + column);
    row[position] = value;
  }
  return row;
}

function process(code: string, fields: Record<string, unknown> = {}) {
  return processBatchTable([reference.header, caseRow(code, fields)]);
}

type AdditionalCase = { name: string; fields: Record<string, unknown> };

const accepted: AdditionalCase[] = [
  { name: "GA minimum 22 minggu", fields: { usia_gestasi_lahir_minggu: 22, usia_gestasi_lahir_hari: 0 } },
  { name: "GA maksimum 43 minggu tanpa tambahan hari", fields: { usia_gestasi_lahir_minggu: 43, usia_gestasi_lahir_hari: 0 } },
  { name: "GA 42 minggu + 6 hari", fields: { usia_gestasi_lahir_minggu: 42, usia_gestasi_lahir_hari: 6 } },
  { name: "PNA minimum 0 hari", fields: { usia_pascalahir_hari: 0 } },
  { name: "PNA maksimum 28 hari", fields: { usia_pascalahir_hari: 28 } },
  { name: "berat minimum 0,3 kg", fields: { berat_badan_kg: 0.3 } },
  { name: "berat maksimum 10 kg", fields: { berat_badan_kg: 10 } },
  { name: "kreatinin terukur 0 dan urin terukur 0", fields: { kreatinin_serum_mg_dl: 0, produksi_urin_ml_kg_jam: 0 } },
  { name: "kreatinin 10 dan urin 10 tepat batas input", fields: { kreatinin_serum_mg_dl: 10, produksi_urin_ml_kg_jam: 10 } },
  { name: "kreatinin diisi tanpa produksi urin", fields: { kreatinin_serum_mg_dl: 0.5, produksi_urin_ml_kg_jam: null } },
];

const rejected: (AdditionalCase & { message: string })[] = [
  { name: "GA kurang dari 22 minggu", fields: { usia_gestasi_lahir_minggu: 21 }, message: "Usia gestasi saat lahir — minggu harus 22–43 minggu." },
  { name: "GA total melebihi 43 minggu", fields: { usia_gestasi_lahir_minggu: 43, usia_gestasi_lahir_hari: 1 }, message: "Usia gestasi saat lahir — tambahan hari harus 0–6 hari dan usia gestasi total maksimal 43 minggu." },
  { name: "tambahan GA melebihi enam hari", fields: { usia_gestasi_lahir_hari: 7 }, message: "Usia gestasi saat lahir — tambahan hari harus 0–6 hari dan usia gestasi total maksimal 43 minggu." },
  { name: "PNA 29 hari di luar cakupan", fields: { usia_pascalahir_hari: 29 }, message: "Usia pascalahir di luar cakupan kalkulator (0–28 hari). Gunakan pedoman dosis bayi di atas 28 hari." },
  { name: "berat di bawah 0,3 kg", fields: { berat_badan_kg: 0.299 }, message: "Berat badan harus 0,3–10 kg." },
  { name: "berat 1720 diduga tertulis gram", fields: { berat_badan_kg: 1720 }, message: "Berat badan harus 0,3–10 kg. Tampaknya berat diisi dalam gram; isi dalam kilogram (mis. 1720 g = 1,72 kg)." },
  { name: "berat lebih dari tiga desimal", fields: { berat_badan_kg: 1.2345 }, message: "Berat badan maksimal tiga angka desimal." },
  { name: "berat bukan angka", fields: { berat_badan_kg: "satu koma tujuh" }, message: "Berat badan saat ini (kg) harus berupa angka." },
  { name: "kreatinin 70 mungkin satuan µmol/L", fields: { kreatinin_serum_mg_dl: 70 }, message: "Kreatinin serum di luar rentang 0–10 mg/dL. Tampaknya kreatinin diisi dalam µmol/L; bagi dengan 88,4 untuk mendapatkan mg/dL." },
  { name: "produksi urin negatif", fields: { produksi_urin_ml_kg_jam: -0.1 }, message: "Produksi urin harus 0–10 mL/kg/jam." },
  { name: "produksi urin ada tetapi kreatinin tidak ada", fields: { kreatinin_serum_mg_dl: null, produksi_urin_ml_kg_jam: 2 }, message: "Kreatinin serum wajib diisi jika produksi urin dicantumkan." },
  { name: "kotak centang terapi diisi tidak baku", fields: { terapi_cox_inhibitor: "mungkin" }, message: "Terapi indometasin/ibuprofen harus Ya atau Tidak." },
  { name: "frekuensi aktual bukan angka", fields: { frekuensi_aktual_jam: "dua puluh empat" }, message: "Frekuensi aktual (interval dalam jam) harus berupa angka." },
  { name: "hanya dosis aktual diisi", fields: { frekuensi_aktual_jam: null }, message: "Dosis aktual dan frekuensi aktual harus diisi bersama." },
  { name: "hanya tiga dari empat angka manual diisi", fields: { dosis_manual_max_mg: null }, message: "Hitung manual harus diisi lengkap (dosis batas bawah dan atas, frekuensi paling sering dan paling jarang) atau dikosongkan semua." },
];

describe("[4.4] penerimaan isian tambahan dari kasus Excel v20 yang dibekukan", () => {
  it.each(accepted)("menerima batas dan kombinasi valid: $name", ({name, fields}) => {
    const result = process("VALID-" + name, fields);
    expect(result, name).toMatchObject({ candidateRows: 1, successCount: 1, errorCount: 0 });
    const row = result.rows[0];
    expect(row.status, name).toBe("berhasil");
    if (row.status !== "berhasil") return;
    expect(row.calculator.input.patientLabel).toBe("VALID-" + name);
    for (const [field, value] of Object.entries(fields)) {
      const column = columns.get(field)!;
      expect(caseRow("VERIFY", fields)[column], field).toBe(value);
    }
  });

  it.each(rejected)("menolak isian tidak valid dengan alasan: $name", ({name, fields, message}) => {
    const input = caseRow("INVALID-" + name, fields);
    const result = processBatchTable([reference.header, input]);
    expect(result, name).toMatchObject({ candidateRows: 1, successCount: 0, errorCount: 1 });
    const row = result.rows[0];
    expect(row.status, name).toBe("gagal");
    if (row.status !== "gagal") return;
    expect(row.sourceRow).toBe(2);
    expect(row.errors, name).toContain(message);
    for (const [field, value] of Object.entries(fields)) {
      expect(input[columns.get(field)!], field).toBe(value); // do not silently coerce source data
    }
  });

  it("membedakan isian opsional kosong dari hasil pengukuran kreatinin dan urin nol", () => {
    const noOptional = process("EXTRA-EMPTY", {
      kreatinin_serum_mg_dl: null,
      produksi_urin_ml_kg_jam: null,
      dosis_manual_min_mg: null,
      dosis_manual_max_mg: null,
      frekuensi_manual_min_jam: null,
      frekuensi_manual_max_jam: null,
      dosis_aktual_mg: null,
      frekuensi_aktual_jam: null,
    });
    expect(noOptional).toMatchObject({successCount: 1, errorCount: 0});
    const empty = noOptional.rows[0];
    expect(empty.status).toBe("berhasil");
    if (empty.status !== "berhasil") return;
    expect(empty.calculator.renalStatus).toBe("data-unavailable");
    expect(empty.actualEvaluation).toBeNull();
    expect(empty.manualEvaluation).toBeNull();
    expect(empty.manualInput).toBeNull();
    expect(notebookBatchRecord(empty)["Fungsi Ginjal"]).toBe("Tidak diisi (diasumsikan normal sesuai usia)");

    const measured = process("EXTRA-ZERO", { kreatinin_serum_mg_dl: 0, produksi_urin_ml_kg_jam: 0 });
    expect(measured).toMatchObject({successCount: 1, errorCount: 0});
    const result = measured.rows[0];
    expect(result.status).toBe("berhasil");
    if (result.status !== "berhasil") return;
    expect(result.calculator.input.renalDataAvailable).toBe(true);
    expect(result.calculator.input.serumCreatinineMgDl).toBe(0);
    expect(result.calculator.input.urineOutputMlKgHour).toBe(0);
    expect(String(notebookBatchRecord(result)["Fungsi Ginjal"])).toContain("SCr 0 mg/dL; produksi urin 0 mL/kg/jam");
  });

  it("tetap menerima isian manual lengkap jika dosis dan frekuensi aktual kosong", () => {
    const result = process("EXTRA-MANUAL", { dosis_aktual_mg: null, frekuensi_aktual_jam: null });
    expect(result).toMatchObject({ successCount: 1, errorCount: 0 });
    const row = result.rows[0];
    expect(row.status).toBe("berhasil");
    if (row.status !== "berhasil") return;
    expect(row.manualInput).not.toBeNull();
    expect(row.actualEvaluation).toBeNull();
    expect(row.manualEvaluation).toBeNull();
  });

  it.each(["Gentamisin", "Amikasin", "Vankomisin"])("membaca tiga kotak centang konteks klinis pada %s", antibiotic => {
    const result = process("EXTRA-FLAGS-" + antibiotic, {
      antibiotik: antibiotic,
      hipotermia_terapeutik: "Ya",
      terapi_cox_inhibitor: "Ya",
      sepsis_berat: "Ya",
    });
    expect(result).toMatchObject({successCount: 1, errorCount: 0});
    const row = result.rows[0];
    expect(row.status).toBe("berhasil");
    if (row.status !== "berhasil") return;
    expect(row.calculator.input).toMatchObject({
      antibiotic: antibiotic.toLowerCase(),
      therapeuticHypothermia: true,
      coxInhibitorTherapy: true,
      severeSepsisOrHighRiskInfection: true,
    });
  });

  it("melaporkan beberapa kesalahan sekaligus dan sekali saja di XLSX nyata", async () => {
    const fields = {
      usia_gestasi_lahir_minggu: 44,
      usia_gestasi_lahir_hari: 7,
      usia_pascalahir_hari: 29,
      berat_badan_kg: 1720,
      kreatinin_serum_mg_dl: 70,
      terapi_cox_inhibitor: "tidak tahu",
    };
    const result = process("EXTRA-MULTI", fields);
    expect(result).toMatchObject({successCount: 0, errorCount: 1});
    const failed = result.rows[0];
    expect(failed.status).toBe("gagal");
    if (failed.status !== "gagal") return;
    expect(failed.errors).toHaveLength(6);
    expect(failed.errors).toContain("Usia gestasi saat lahir — minggu harus 22–43 minggu.");
    expect(failed.errors).toContain("Usia pascalahir di luar cakupan kalkulator (0–28 hari). Gunakan pedoman dosis bayi di atas 28 hari.");
    expect(failed.errors).toContain("Terapi indometasin/ibuprofen harus Ya atau Tidak.");

    const ExcelJS = await import("exceljs");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(new Uint8Array(await buildBatchResultWorkbook(result)) as unknown as import("exceljs").Buffer);
    expect(book.getWorksheet("Hasil per Pasien")!.rowCount).toBe(1);
    const warningSheet = book.getWorksheet("Peringatan")!;
    const matching = (warningSheet.getRows(2, Math.max(1, warningSheet.rowCount - 1)) ?? [])
      .filter(row => row.getCell(2).value === "EXTRA-MULTI");
    expect(matching).toHaveLength(1);
    expect(matching[0].getCell(1).value).toBe(2);
    expect(matching[0].getCell(3).value).toBe("PERINGATAN");
    const note = String(matching[0].getCell(4).value);
    expect(note.match(/Baris dilewati:/g)).toHaveLength(1);
    for (const reason of failed.errors) expect(note).toContain(reason);
  });

  it("tetap menghasilkan evaluasi aktual saat manual tidak sah, dengan peringatan khusus", () => {
    const result = process("EXTRA-MANUAL-WARN", {
      dosis_manual_min_mg: 30,
      dosis_manual_max_mg: 20,
    });
    expect(result).toMatchObject({successCount: 1, errorCount: 0, warningCount: 1});
    const row = result.rows[0];
    expect(row.status).toBe("berhasil");
    if (row.status !== "berhasil") return;
    expect(row.manualInput).toBeNull();
    expect(row.manualEvaluation).toBeNull();
    expect(row.actualEvaluation).not.toBeNull();
    expect(row.warnings).toContain("Dosis manual batas bawah (mg) tidak boleh melebihi batas atas (mg).");
  });
});
