import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { PatientInput } from "../../src/lib/neonatal-calculator/types";

export const referenceRoot = fileURLToPath(new URL("../fixtures/neonatal/v20/", import.meta.url));
const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

export type V20PairedTest = {
  n: number; n_atas: number; n_bawah: number; n_luar: number;
  cukup: boolean; p: number | null; median_selisih: number;
  uji?: string; statistik?: number | null; w_normalitas?: number | null;
  p_normalitas?: number | null; pesan?: string;
};
export type V20Profile = {
  input: PatientInput;
  expected: { rsDose: number[]; litDose: number[]; rsInterval: (number | null)[]; litInterval: (number | null)[];
    warningDetails: { severity: "critical" | "warning" | "info"; title: string; message: string }[] };
};
export type V20McNemarTest = {
  n: number; b_RS_only: number; c_Lit_only: number; n_keduanya: number;
  n_tidak_keduanya: number; p: number | null;
};
export type V20Oracle = {
  source: {
    ruleVersion: string; manifestSha256: string; executedCells: number[];
    runtime: Record<string, string>;
    files: Record<string, { path: string; originalFilename: string; bytes: number; sha256: string; actualSha256: string }>;
  };
  notebookChecks: { Uji: string; Status: string; Detail: string }[];
  header: string[]; inputRows: unknown[][]; publicHeaders: string[];
  batchRecords: Record<string, unknown>[]; batchWarnings: string[];
  recommendations: V20Profile[]; batchRecommendations: V20Profile[];
  renalExport: { rows: unknown[][]; records: Record<string, unknown>[] };
  manualExport: { rows: unknown[][]; records: Record<string, unknown>[] };
  singleDoseExport: { rows: unknown[][]; records: Record<string, unknown>[] };
  glossary: { headers: string[]; originalRows: [string,string][]; abbreviations: [string,string,string][];
    terms: [string,string][]; cases: {name: string; text: string; rows: [string,string][]}[] };
  statistics: Record<"dosis" | "frekuensi", {
    per_antibiotik: Record<string, Record<string, V20PairedTest>>;
    mcnemar_aktual: V20McNemarTest; mcnemar_manual: V20McNemarTest;
    mcnemar_per_antibiotik: Record<string, { aktual: V20McNemarTest; manual: V20McNemarTest }>;
  }>;
  interpretation: { judul: string; isi: ["normal" | "poin" | "penting", string][] }[];
  cases: { name: string; rows: unknown[][]; statistics: V20Oracle["statistics"]; interpretation: V20Oracle["interpretation"]; records: Record<string,unknown>[] }[];
  comparator: {
    headers: string[]; rows: unknown[][]; checkedHeaders: string[]; rejectedCodes: string[];
    pastedWebRows: number; comparedCells: number; differences: unknown[];
  };
};

let cached: V20Oracle | undefined;

export function loadV20Reference(): V20Oracle {
  cached ??= JSON.parse(execFileSync(process.env.PYTHON || "python", ["scripts/neonatal-v20-oracle.py"], {
    cwd: projectRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 180_000,
  })) as V20Oracle;
  return cached;
}
