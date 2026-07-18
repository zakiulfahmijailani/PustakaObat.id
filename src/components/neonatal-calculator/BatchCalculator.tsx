"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  ANTIBIOTIC_LABELS,
  BATCH_MAX_ROWS,
  processBatchTable,
  type BatchProcessingResult,
} from "@/lib/neonatal-calculator";
import {
  downloadBatchResult,
  downloadBatchTemplate,
  readBatchWorkbook,
} from "@/lib/neonatal-calculator/batch-workbook";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function primaryStatus(row: Extract<BatchProcessingResult["rows"][number], { status: "berhasil" }>) {
  const recommendation = row.calculator.recommendations.institutionalPrimary;
  return row.actualEvaluation.targets.find(
    (target) => target.recommendationId === recommendation.id,
  );
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone = normalized === "sesuai"
    ? "bg-success/10 text-success"
    : normalized.includes("tidak-dapat")
      ? "bg-info/10 text-info"
      : "bg-warning/10 text-warning";
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>{value.replaceAll("-", " ")}</span>;
}

export function BatchCalculator() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [result, setResult] = useState<BatchProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"processing" | "template" | "export" | null>(null);

  const processFile = async (file: File) => {
    setError(null);
    setResult(null);
    setFilename(file.name);
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Gunakan file Excel berformat .xlsx.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Ukuran file maksimal 5 MB.");
      return;
    }

    setBusy("processing");
    try {
      const table = await readBatchWorkbook(file);
      const processed = processBatchTable(table);
      if (processed.candidateRows === 0) {
        throw new Error("Tidak ada baris pasien yang dapat diproses setelah baris CONTOH diabaikan.");
      }
      setResult(processed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "File tidak dapat diproses.");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clearResult = () => {
    setFilename(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const getTemplate = async () => {
    setBusy("template");
    setError(null);
    try {
      await downloadBatchTemplate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Template gagal dibuat.");
    } finally {
      setBusy(null);
    }
  };

  const exportResult = async () => {
    if (!result) return;
    setBusy("export");
    setError(null);
    try {
      await downloadBatchResult(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hasil gagal diekspor.");
    } finally {
      setBusy(null);
    }
  };

  const previewRows = result?.rows.slice(0, 25) ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><FileSpreadsheet size={22} aria-hidden="true" /></div>
              <div>
                <h2 className="text-xl font-semibold text-text">Evaluasi banyak pasien</h2>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">
                  Satu baris Excel menjalankan mesin rekomendasi dan evaluasi yang sama dengan kalkulator individual.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <Button type="button" variant="outline" onClick={getTemplate} disabled={busy !== null} className="min-h-11 justify-center">
                {busy === "template" ? <LoaderCircle className="animate-spin" size={18} /> : <Download size={18} />}
                Unduh template kosong
              </Button>
              <label className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-6 text-center transition-colors ${busy ? "cursor-wait border-border bg-surface-2" : "border-primary/35 bg-primary/5 hover:border-primary"}`}>
                {busy === "processing" ? <LoaderCircle className="animate-spin text-primary" size={28} /> : <Upload className="text-primary" size={28} />}
                <span className="mt-2 text-sm font-semibold text-text">{busy === "processing" ? "Memproses file…" : "Pilih file Excel"}</span>
                <span className="mt-1 text-xs text-text-muted">.xlsx · maksimal 5 MB · maksimal {BATCH_MAX_ROWS.toLocaleString("id-ID")} baris</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  disabled={busy !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void processFile(file);
                  }}
                />
              </label>
              {filename && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-text">{filename}</span>
                  <button type="button" onClick={clearResult} className="rounded-lg p-2 text-text-muted hover:bg-background hover:text-error" aria-label="Hapus hasil batch"><Trash2 size={17} /></button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-info/20 bg-info/5 p-4 text-sm leading-relaxed text-text-muted">
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
            <div><strong className="block text-text">Diproses lokal di browser</strong>File dan hasil tidak dikirim atau disimpan oleh Apoteq. Gunakan kode kasus tanpa nama, nomor rekam medis, NIK, atau identitas langsung.</div>
          </div>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error" role="alert">
              <AlertCircle size={20} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!result ? (
            <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
              <div><FileSpreadsheet className="mx-auto text-text-muted" /><h2 className="mt-3 text-xl font-semibold text-text">Belum ada file diproses</h2><p className="mt-2 max-w-md text-sm text-text-muted">Unduh template, isi satu baris per pasien, lalu unggah kembali untuk mendapatkan rekap evaluasi.</p></div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-surface p-5" aria-live="polite">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Pemrosesan selesai</p><h2 className="mt-1 text-xl font-semibold text-text">Ringkasan batch</h2></div>
                  <Button type="button" onClick={exportResult} disabled={busy !== null} className="min-h-11">
                    {busy === "export" ? <LoaderCircle className="animate-spin" size={18} /> : <Download size={18} />}
                    Unduh hasil Excel
                  </Button>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div className="rounded-xl bg-surface-2 p-3"><dt className="text-xs text-text-muted">Kandidat</dt><dd className="mt-1 text-2xl font-bold text-text">{result.candidateRows}</dd></div>
                  <div className="rounded-xl bg-success/10 p-3"><dt className="text-xs text-success">Berhasil</dt><dd className="mt-1 text-2xl font-bold text-success">{result.successCount}</dd></div>
                  <div className="rounded-xl bg-error/10 p-3"><dt className="text-xs text-error">Gagal</dt><dd className="mt-1 text-2xl font-bold text-error">{result.errorCount}</dd></div>
                  <div className="rounded-xl bg-warning/10 p-3"><dt className="text-xs text-warning">Peringatan</dt><dd className="mt-1 text-2xl font-bold text-warning">{result.warningCount}</dd></div>
                  <div className="rounded-xl bg-info/10 p-3"><dt className="text-xs text-info">Diabaikan</dt><dd className="mt-1 text-2xl font-bold text-info">{result.ignoredRows}</dd></div>
                </dl>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                <div className="border-b border-border px-4 py-3"><h3 className="font-semibold text-text">Pratinjau hasil</h3><p className="text-xs text-text-muted">Menampilkan maksimal 25 baris. File unduhan berisi seluruh hasil dan pesan evaluasi.</p></div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-muted"><tr><th className="px-4 py-3">Baris</th><th className="px-4 py-3">Kode</th><th className="px-4 py-3">Antibiotik</th><th className="px-4 py-3">Dosis aktual</th><th className="px-4 py-3">Interval aktual</th><th className="px-4 py-3">Proses</th></tr></thead>
                    <tbody className="divide-y divide-border">
                      {previewRows.map((row) => {
                        if (row.status === "gagal") return (
                          <tr key={`${row.sourceRow}-${row.patientCode}`} className="align-top">
                            <td className="px-4 py-3 text-text-muted">{row.sourceRow}</td><td className="px-4 py-3 font-medium text-text">{row.patientCode}</td><td className="px-4 py-3 text-text-muted" colSpan={3}>{row.errors.join(" ")}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-error"><AlertCircle size={15} />Gagal</span></td>
                          </tr>
                        );
                        const status = primaryStatus(row);
                        return (
                          <tr key={`${row.sourceRow}-${row.patientCode}`} className="align-top">
                            <td className="px-4 py-3 text-text-muted">{row.sourceRow}</td><td className="px-4 py-3 font-medium text-text">{row.patientCode}</td><td className="px-4 py-3 text-text-muted">{ANTIBIOTIC_LABELS[row.calculator.input.antibiotic]}</td><td className="px-4 py-3"><StatusBadge value={status?.actualDose.status ?? "tidak-dapat-dievaluasi"} /></td><td className="px-4 py-3"><StatusBadge value={status?.actualInterval.status ?? "tidak-dapat-dievaluasi"} /></td><td className="px-4 py-3">{row.warnings.length > 0 ? <span className="inline-flex items-center gap-1 text-warning" title={row.warnings.join(" ")}><AlertCircle size={15} />Peringatan</span> : <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 size={15} />Berhasil</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
