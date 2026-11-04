import { describe, expect, it } from "vitest";
import { calculateRecommendations } from "../recommendation-engine";
import { ANMF_RENAL } from "../warning-catalog-v20";
import { patient } from "./fixtures";

const antibiotics = ["gentamisin", "amikasin", "vankomisin"] as const;

describe("atribusi catatan klinis v20 (notebook cells 5-6)", () => {
  it.each(antibiotics)("membedakan sumber institusi dan ANMF pada kondisi normal: %s", antibiotic => {
    const r = calculateRecommendations(patient({
      antibiotic, renalDataAvailable: true, serumCreatinineMgDl: 0.4, urineOutputMlKgHour: 2,
    }));
    const institutional = r.recommendations.institutionalPrimary.notes.join(" ");
    const literature = r.recommendations.anmf2024.notes.join(" ");
    if (antibiotic === "vankomisin") {
      expect(institutional).toContain("Kriteria ini ditetapkan tim peneliti berdasarkan UNC (2023)");
      expect(institutional).toContain("UNC (2023): target kadar trough");
    } else {
      expect(institutional).toContain("PPK RSUP Dr. M. Djamil");
      expect(institutional).toContain("PNPK (");
      expect(institutional).toContain("ANMF 2024");
    }
    expect(literature).toContain("ANMF:");
    expect(literature).not.toContain(ANMF_RENAL[antibiotic]);
  });

  it.each(antibiotics)("menyertakan catatan ANMF ginjal tanpa mengubah angka Literatur Terkini: %s", antibiotic => {
    const baseline = calculateRecommendations(patient({
      antibiotic, renalDataAvailable: true, serumCreatinineMgDl: 0.4, urineOutputMlKgHour: 2,
    }));
    const renal = calculateRecommendations(patient({
      antibiotic, renalDataAvailable: true, serumCreatinineMgDl: 1.2, urineOutputMlKgHour: 0.4,
    }));
    expect(renal.recommendations.anmf2024.notes).toContain(ANMF_RENAL[antibiotic]);
    expect(renal.recommendations.anmf2024.dose).toEqual(baseline.recommendations.anmf2024.dose);
    expect(renal.recommendations.anmf2024.interval).toEqual(baseline.recommendations.anmf2024.interval);
    if (antibiotic === "vankomisin") {
      expect(renal.recommendations.institutionalPrimary.notes.join(" ")).toContain("UNC (2023): berikan dosis TUNGGAL");
      expect(renal.recommendations.institutionalPrimary.notes.join(" ")).toContain("UNC (2023): tahan dosis berikutnya");
    }
  });

  it("menyebut keputusan peneliti dan dasar ANMF untuk gentamisin hipotermia serta kombinasi COX", () => {
    const result = calculateRecommendations(patient({
      antibiotic: "gentamisin", therapeuticHypothermia: true, coxInhibitorTherapy: true,
    }));
    const notes = result.recommendations.anmf2024.notes.join(" ");
    expect(notes).toContain("keputusan tim peneliti");
    expect(notes).toContain("ANMF tidak mengatur kombinasi keduanya");
    expect(notes).toContain("hanya menerapkan aturan hipotermia");
  });

  it("menjelaskan atribusi ANMF dan satu kali tambahan 12 jam pada amikasin kombinasi", () => {
    const result = calculateRecommendations(patient({
      antibiotic: "amikasin", therapeuticHypothermia: true, coxInhibitorTherapy: true,
    }));
    const notes = result.recommendations.anmf2024.notes.join(" ");
    expect(notes).toContain("ANMF memperpanjang interval 12 jam");
    expect(notes).toContain("kalkulator memperpanjang 12 jam satu kali");
    expect(notes).toContain("ANMF tidak mengatur kombinasi keduanya");
  });

  it("memisahkan ANMF dosis muatan dari dosis rumatan vankomisin", () => {
    const result = calculateRecommendations(patient({
      antibiotic: "vankomisin", therapeuticHypothermia: true, severeSepsisOrHighRiskInfection: true,
    }));
    const notes = result.recommendations.anmf2024.notes.join(" ");
    expect(notes).toContain("ANMF: pada dugaan sepsis berat");
    expect(notes).toContain("dosis muatan 20 mg/kg");
    expect(notes).toContain("Dosis muatan tidak dimasukkan ke angka di tabel");
    expect(notes).toContain("ANMF: pada hipotermia terapeutik");
  });
});
