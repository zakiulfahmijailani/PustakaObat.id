import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadV20Reference, referenceRoot } from "../../../../tests/helpers/neonatal-v20-reference";
import { processBatchTable } from "../batch-engine";
import { intervalBounds, notebookBatchRecord, rangeDeviation } from "../notebook-results";
import { calculateRecommendations } from "../recommendation-engine";

const oracle = loadV20Reference();

describe("frozen v20 reference integrity and unchanged dosing", () => {
  it("pins the original notebook, two XLSX files, and review document bytes", () => {
    const hashes = {
      notebook: "d78513e5ab8cd728dc230ad7f662d06378040707e2ab08daffcaf6d237917651",
      input: "05a52548cad9d20fdaee1ee8b1c7540b6a513785c5250bd570522ebe9864f860",
      comparator: "f0dab30f11fbfb16b2e5949456576effed52a8de630296269cf856e1d0243f31",
      review: "f5c1f3a6e7c83d3e4b7d6be307d1930d4e6ec3dd7a90859be5b347f4fca5c782",
    };
    expect(Object.keys(oracle.source.files).sort()).toEqual(Object.keys(hashes).sort());
    for (const [role, expected] of Object.entries(hashes)) {
      const entry = oracle.source.files[role];
      const bytes = readFileSync(join(referenceRoot, entry.path));
      expect(bytes.byteLength).toBe(entry.bytes);
      expect(createHash("sha256").update(bytes).digest("hex"), role).toBe(expected);
      expect(entry.actualSha256, role).toBe(expected);
      expect(entry.sha256, role).toBe(expected);
    }
    expect(oracle.source.manifestSha256).toBe(createHash("sha256").update(readFileSync(join(referenceRoot, "manifest.json"))).digest("hex"));
  });

  it("executes all 113 original notebook checks under the v20 rule version", () => {
    expect(oracle.source.ruleVersion).toBe("2026.11.03");
    expect(oracle.source.executedCells).toEqual([3, 5, 6, 8, 10, 14, 18]);
    expect(oracle.source.runtime.scipy).toBe("1.17.1");
    expect(oracle.notebookChecks).toHaveLength(113);
    expect(oracle.notebookChecks.filter(check => check.Status !== "LULUS")).toEqual([]);
  });

  it("reconciles all 720 expected Excel cells with executed Python, excluding the test-purpose annotation", () => {
    expect(oracle.inputRows).toHaveLength(34);
    expect(oracle.batchRecords).toHaveLength(30);
    expect(oracle.publicHeaders).toHaveLength(24);
    expect(oracle.comparator.comparedCells).toBe(720);
    expect(oracle.comparator.differences).toEqual([]);
    expect(oracle.comparator.headers.filter(key => !oracle.publicHeaders.includes(key))).toEqual(["Tujuan uji"]);
    expect(oracle.comparator.checkedHeaders).toHaveLength(22);
    expect(new Set(oracle.comparator.checkedHeaders).size).toBe(22);
    expect(oracle.comparator.checkedHeaders).toEqual(oracle.publicHeaders.filter(key => !["Kode Pasien", "Berat Badan (kg)"].includes(key)));
    expect(oracle.comparator.checkedHeaders).not.toContain("Berat Badan (kg)");
    expect(oracle.comparator.pastedWebRows).toBe(0);
    for (const row of oracle.comparator.rows) {
      const expected = Object.fromEntries(oracle.comparator.headers.map((header, index) => [header, row[index]]));
      const actual = oracle.batchRecords.find(record => record["Kode Pasien"] === expected["Kode Pasien"]);
      expect(actual).toBeDefined();
      for (const header of oracle.publicHeaders) expect(actual![header], String(expected["Kode Pasien"]) + ": " + header).toEqual(expected[header]);
    }
  });

  it("uses the original XLSX input to reproduce valid and rejected patient IDs in the application", () => {
    const result = processBatchTable([oracle.header, ...oracle.inputRows]);
    expect(result.rows.filter(row => row.status === "berhasil").map(row => row.patientCode)).toEqual(oracle.batchRecords.map(row => row["Kode Pasien"]));
    expect(result.rows.filter(row => row.status === "gagal").map(row => row.patientCode)).toEqual(oracle.comparator.rejectedCodes);
    expect(oracle.comparator.rejectedCodes).toEqual(["T31", "T32", "T33", "T34"]);
    expect(oracle.batchWarnings).toHaveLength(4);
  });

  it("preserves v20 dose and interval values for 30 supplied patients and 1,242 boundary/renal profiles", () => {
    expect(oracle.batchRecommendations).toHaveLength(30);
    expect(oracle.recommendations).toHaveLength(1242);
    const failures: unknown[] = [];
    for (const { input, expected } of [...oracle.batchRecommendations, ...oracle.recommendations]) {
      const result = calculateRecommendations(input);
      for (const [actual, dose, interval] of [
        [result.recommendations.institutionalPrimary, expected.rsDose, expected.rsInterval],
        [result.recommendations.anmf2024, expected.litDose, expected.litInterval],
      ] as const) {
        if (!Number.isFinite(actual.dose.minTotalMg) || !Number.isFinite(actual.dose.maxTotalMg)
            || Math.abs(actual.dose.minTotalMg! - dose[0]) > 1e-8 || Math.abs(actual.dose.maxTotalMg! - dose[1]) > 1e-8
            || JSON.stringify(intervalBounds(actual.interval)) !== JSON.stringify(interval)) {
          failures.push({ input, reference: actual.id, dose: actual.dose, interval: intervalBounds(actual.interval), expected: { dose, interval } });
        }
      }
    }
    expect(failures.length, JSON.stringify(failures.slice(0, 5))).toBe(0);
  });

  it("matches all eight v20 deviation fields for each supplied patient", () => {
    const result = processBatchTable([oracle.header, ...oracle.inputRows]);
    for (const row of result.rows) {
      if (row.status !== "berhasil") continue;
      const actual = notebookBatchRecord(row);
      const expected = oracle.batchRecords.find(record => record["Kode Pasien"] === row.patientCode)!;
      const keys = Object.keys(expected).filter(key => key.startsWith("_dev_"));
      expect(keys).toHaveLength(8);
      for (const key of keys) {
        const a = actual[key], b = expected[key];
        if (typeof b === "number") {
          expect(typeof a, `${row.patientCode} ${key}`).toBe("number");
          expect(a as number, `${row.patientCode} ${key}`).toBeCloseTo(b, 10);
        } else expect(a, `${row.patientCode} ${key}`).toBeNull();
      }
    }
  });

  it("respects v20 tolerance, missing values, and excess-first priority", () => {
    expect(rangeDeviation(null, 2, 1, 2)).toBeNull();
    expect(rangeDeviation(1, 2, 1, 2)).toBe(0);
    expect(rangeDeviation(1 - 0.5e-6, 2 + 0.5e-6, 1, 2)).toBe(0);
    expect(rangeDeviation(1 - 2e-6, 1, 1, 2)).toBeCloseTo(-2e-6, 12);
    expect(rangeDeviation(2, 2 + 2e-6, 1, 2)).toBeCloseTo(2e-6, 12);
    expect(rangeDeviation(0.5, 2.25, 1, 2)).toBeCloseTo(0.25, 12);
  });
});
