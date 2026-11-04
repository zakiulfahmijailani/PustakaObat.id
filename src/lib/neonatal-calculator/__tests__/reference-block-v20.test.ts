import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReferenceBlock } from "../../../components/neonatal-calculator/ReferenceBlock";
import { getV20ReferenceEntries } from "../reference-block-v20";
import type { Antibiotic } from "../types";

const antibiotics: Antibiotic[] = ["gentamisin", "amikasin", "vankomisin"];

describe("kotak Rujukan v20 dari notebook cell 6 _blok_rujukan", () => {
  it.each(antibiotics)("memakai empat kelompok sumber untuk %s", antibiotic => {
    const entries = getV20ReferenceEntries(antibiotic);
    expect(entries.map(entry => entry.label)).toEqual([
      "Pedoman Rumah Sakit", "Literatur Terkini", "Peringatan tambahan",
      "Ketetapan tim peneliti (bukan dari pedoman)",
    ]);
    const main = entries[0].text;
    if (antibiotic === "vankomisin") {
      expect(main).toContain("UNC Medical Center, Vancomycin Dosing & Monitoring Guide: Neonatal & Pediatric (2023)");
      expect(main).not.toContain("Panduan Praktik Klinik");
      expect(main).not.toContain("PNPK Tata Laksana");
    } else {
      expect(main).toContain("Panduan Praktik Klinik (PPK) Sepsis Neonatal RSUP Dr. M. Djamil Padang (2017)");
      expect(main).toContain("PNPK Tata Laksana Sepsis pada Anak, Kemenkes RI (2021)");
    }
    expect(main).toContain("Kriteria kesesuaian ditetapkan tim peneliti");
    expect(entries[2].text).toContain("Evans RE, Peterson J, Kim JJ, Mahaveer A.");
    expect(entries[2].text).toContain("Papile LA, Baley JE, Benitz W");
    expect(entries[3].text).toContain("asumsi fungsi ginjal normal");
    expect(entries[3].text).toContain("kriteria gangguan ginjal UNC dipakai juga untuk gentamisin dan amikasin");
    expect(entries[3].text).toContain("berat <1,5 kg = berat lahir sangat rendah menurut WHO");
  });

  it.each([
    ["gentamisin", "Gentamicin v4.0 (24 April 2024)"],
    ["amikasin", "Amikacin v3.0 (20 April 2024; errata 2 Mei 2024)"],
    ["vankomisin", "Vancomycin - Intermittent v3.0 (errata 21 November 2024)"],
  ] as const)("memakai monograf ANMF yang tepat untuk %s", (antibiotic, monograph) => {
    const entries = getV20ReferenceEntries(antibiotic);
    expect(entries[1].text).toBe("Australasian Neonatal Medicines Formulary, " + monograph + ".");
  });

  it.each(antibiotics)("merender kotak Rujukan untuk layar dan pohon cetak %s", antibiotic => {
    const markup = renderToStaticMarkup(createElement(ReferenceBlock, { antibiotic }));
    expect(markup).toContain('aria-label="Rujukan"');
    expect(markup).toContain("print:break-inside-auto");
    expect(markup).toContain("<h3");
    for (const entry of getV20ReferenceEntries(antibiotic)) {
      expect(markup).toContain(entry.label);
      expect(markup).toContain(entry.text.slice(0, 28).replaceAll("&", "&amp;"));
    }
  });
});
