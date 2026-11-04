import { describe, expect, it } from "vitest";
import { INPUT_LIMITS } from "../constants";
import {
  getV20ContextCheckboxes,
  getV20InputReasonablenessNote,
  V20_MANUAL_COMPARISON_HELP,
  V20_RENAL_DATA_HELP,
} from "../form-guidance-v20";

describe("label dan batas kewajaran form pasien sesuai notebook v20 cell 8", () => {
  const flags = ["therapeuticHypothermia", "coxInhibitorTherapy", "severeSepsisOrHighRiskInfection"];
  it.each(["", "gentamisin", "amikasin", "vankomisin"] as const)(
    "menjelaskan tiga pilihan klinis lengkap sesuai antibiotik %s", antibiotic => {
      const labels = getV20ContextCheckboxes(antibiotic);
      expect(labels.map(x => x.key)).toEqual(flags);
      labels.forEach(x => {
        expect(x.label.length).toBeGreaterThan(25);
        expect(x.effect.length).toBeGreaterThan(40);
      });
      expect(labels[0].label).toContain("ensefalopati hipoksik-iskemik");
      expect(labels[1].label).toContain("penghambat siklooksigenase");
      expect(labels[2].label).toContain("Khusus vankomisin");
    },
  );

  it("menyatakan efek yang berbeda tanpa mengatribusikan keputusan tim sebagai pedoman", () => {
    const gent = getV20ContextCheckboxes("gentamisin");
    expect(gent[0].effect).toContain("minimal 36 jam");
    expect(gent[0].effect).toContain("ketetapan tim peneliti");
    expect(gent[1].effect).toContain("aturan hipotermia saja");
    expect(gent[2].effect).toContain("tidak memengaruhi perhitungan gentamisin");

    const amik = getV20ContextCheckboxes("amikasin");
    expect(amik[0].effect).toContain("bertambah 12 jam");
    expect(amik[1].effect).toContain("penambahan dilakukan sekali");
    expect(amik[2].effect).toContain("tidak memengaruhi perhitungan amikasin");

    const vanc = getV20ContextCheckboxes("vankomisin");
    expect(vanc[0].effect).toContain("trough sebelum dosis ke-2");
    expect(vanc[1].effect).toContain("tidak mengubah dosis atau interval");
    expect(vanc[2].effect).toContain("dosis muatan 20 mg/kg");
    expect(vanc[2].effect).toContain("tidak mengubah angka dosis rumatan");
  });

  it("menjelaskan asumsi ginjal, kewajiban kreatinin, dan pilihan manual", () => {
    expect(V20_RENAL_DATA_HELP).toContain("diasumsikan normal sesuai usia");
    expect(V20_RENAL_DATA_HELP).toContain("kreatinin serum wajib diisi");
    expect(V20_MANUAL_COMPARISON_HELP).toContain("batas bawah dan batas atas sama");
    expect(V20_MANUAL_COMPARISON_HELP).toContain("tidak ditampilkan");
  });

  it("membedakan batas kewajaran isian dari batas klinis memakai konstanta validasi", () => {
    const note = getV20InputReasonablenessNote();
    expect(note).toContain("batas kewajaran isian untuk mencegah salah ketik, bukan batas klinis");
    expect(note).toContain(`usia gestasi ${INPUT_LIMITS.gestationalAgeWeeks.min}–${INPUT_LIMITS.gestationalAgeWeeks.max} minggu`);
    expect(note).toContain("usia pascalahir 0–28 hari");
    expect(note).toContain("berat 0,3–10 kg");
    expect(note).toContain("kreatinin serum 0–10 mg/dL");
    expect(note).toContain("produksi urin 0–10 mL/kg/jam");
  });
});
