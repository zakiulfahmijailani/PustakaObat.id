"use client";

import { Fragment, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Filter,
  LoaderCircle,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  ANTIBIOTIC_LABELS,
  BATCH_MAX_ROWS,
  processBatchTable,
  type Antibiotic,
  type BatchProcessingResult,
} from "@/lib/neonatal-calculator";
import {
  downloadBatchResult,
  downloadBatchTemplate,
  readBatchWorkbook,
} from "@/lib/neonatal-calculator/batch-workbook";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
type ResultFilter = "action" | "all" | "warning" | "error" | "appropriate";

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

function needsAction(row: BatchProcessingResult["rows"][number]) {
  if (row.status === "gagal" || row.warnings.length > 0) return true;
  const status = primaryStatus(row);
  return status?.actualDose.status !== "sesuai" || status?.actualInterval.status !== "sesuai";
}

export function BatchCalculator() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [result, setResult] = useState<BatchProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"processing" | "template" | "export" | null>(null);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [resultFilter, setResultFilter] = useState<ResultFilter>("action");
  const [antibioticFilter, setAntibioticFilter] = useState<Antibiotic | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

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
      setProcessingStage("Membaca workbook");
      const table = await readBatchWorkbook(file);
      setProcessingStage("Memvalidasi kolom dan baris");
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      setProcessingStage("Mengevaluasi regimen pasien");
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const processed = processBatchTable(table);
      if (processed.candidateRows === 0) {
        throw new Error("Tidak ada baris pasien yang dapat diproses setelah baris CONTOH diabaikan.");
      }
      setProcessingStage("Menyiapkan ringkasan");
      setResult(processed);
      setResultFilter("action");
      setAntibioticFilter("all");
      setSearchQuery("");
      setExpandedRow(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "File tidak dapat diproses.");
    } finally {
      setBusy(null);
      setProcessingStage(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clearResult = () => {
    setFilename(null);
    setResult(null);
    setError(null);
    setProcessingStage(null);
    setExpandedRow(null);
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

  const filteredRows = result?.rows.filter((row) => {
    const queryMatches = !searchQuery.trim() || row.patientCode.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const antibioticMatches = antibioticFilter === "all" || (row.status === "berhasil" && row.calculator.input.antibiotic === antibioticFilter);
    const status = row.status === "berhasil" ? primaryStatus(row) : null;
    const statusMatches = resultFilter === "all"
      || (resultFilter === "action" && needsAction(row))
      || (resultFilter === "warning" && row.status === "berhasil" && row.warnings.length > 0)
      || (resultFilter === "error" && row.status === "gagal")
      || (resultFilter === "appropriate" && row.status === "berhasil" && row.warnings.length === 0 && status?.actualDose.status === "sesuai" && status?.actualInterval.status === "sesuai");
    return queryMatches && antibioticMatches && statusMatches;
  }) ?? [];
  const previewRows = filteredRows.slice(0, 25);
  const actionCount = result?.rows.filter(needsAction).length ?? 0;
  const antibioticCounts = (Object.keys(ANTIBIOTIC_LABELS) as Antibiotic[]).map((antibiotic) => ({
    antibiotic,
    count: result?.rows.filter((row) => row.status === "berhasil" && row.calculator.input.antibiotic === antibiotic).length ?? 0,
  }));

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)]">
        <div className="min-w-0 space-y-4">
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
              <Button type="button" variant="outline" onClick={getTemplate} disabled={busy !== null} className="min-h-11 w-full min-w-0 whitespace-normal justify-center">
                {busy === "template" ? <LoaderCircle className="animate-spin" size={18} /> : <Download size={18} />}
                Unduh template kosong
              </Button>
              <label
                className={`flex min-h-32 w-full min-w-0 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-6 text-center transition-colors ${busy ? "cursor-wait border-border bg-surface-2" : "border-primary/35 bg-primary/5 hover:border-primary"}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files?.[0];
                  if (file && busy === null) void processFile(file);
                }}
              >
                {busy === "processing" ? <LoaderCircle className="animate-spin text-primary" size={28} /> : <Upload className="text-primary" size={28} />}
                <span className="mt-2 text-sm font-semibold text-text">{busy === "processing" ? "Memproses file…" : "Pilih atau tarik file Excel ke sini"}</span>
                <span className="mt-1 max-w-full text-xs leading-relaxed text-text-muted">.xlsx · maksimal 5 MB · maksimal {BATCH_MAX_ROWS.toLocaleString("id-ID")} baris</span>
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
              {busy === "processing" && processingStage && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm" role="status" aria-live="polite">
                  <div className="flex items-center gap-2 font-semibold text-primary"><LoaderCircle className="animate-spin" size={17} />{processingStage}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/10"><div className="h-full w-2/3 animate-pulse rounded-full bg-primary" /></div>
                  <p className="mt-2 text-xs text-text-muted">Jangan tutup tab hingga ringkasan selesai disiapkan.</p>
                </div>
              )}
              {filename && (
                <div className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
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

        <div className="min-w-0 space-y-4">
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
                <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  <div className="rounded-xl bg-surface-2 p-3"><dt className="text-xs text-text-muted">Kandidat</dt><dd className="mt-1 text-2xl font-bold text-text">{result.candidateRows}</dd></div>
                  <div className="rounded-xl bg-success/10 p-3"><dt className="text-xs text-success">Diproses</dt><dd className="mt-1 text-2xl font-bold text-success">{result.successCount}</dd></div>
                  <div className="rounded-xl bg-error/10 p-3"><dt className="text-xs text-error">Gagal</dt><dd className="mt-1 text-2xl font-bold text-error">{result.errorCount}</dd></div>
                  <div className="rounded-xl bg-warning/10 p-3"><dt className="text-xs text-warning">Peringatan</dt><dd className="mt-1 text-2xl font-bold text-warning">{result.warningCount}</dd></div>
                  <div className="rounded-xl bg-info/10 p-3"><dt className="text-xs text-info">Diabaikan</dt><dd className="mt-1 text-2xl font-bold text-info">{result.ignoredRows}</dd></div>
                  <div className="rounded-xl border border-warning/30 bg-warning/10 p-3"><dt className="text-xs text-warning">Perlu tindakan</dt><dd className="mt-1 text-2xl font-bold text-warning">{actionCount}</dd></div>
                </dl>
                <div className="mt-5 border-t border-border pt-4" aria-label="Distribusi kasus berdasarkan antibiotik">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Distribusi antibiotik</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {antibioticCounts.map(({ antibiotic, count }) => {
                      const percentage = result.successCount ? Math.round((count / result.successCount) * 100) : 0;
                      return <div key={antibiotic}><div className="flex justify-between gap-3 text-sm"><span className="font-medium text-text">{ANTIBIOTIC_LABELS[antibiotic]}</span><span className="text-text-muted">{count} · {percentage}%</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} /></div></div>;
                    })}
                  </div>
                </div>
              </div>

              <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface">
                <div className="border-b border-border px-4 py-3"><h3 className="font-semibold text-text">Pratinjau hasil</h3><p className="text-sm text-text-muted">Menampilkan maksimal 25 baris. File unduhan berisi seluruh hasil dan pesan evaluasi.</p></div>
                <div className="grid gap-3 border-b border-border bg-surface-2/40 p-4 md:grid-cols-[1fr_auto_auto]">
                  <label className="relative block">
                    <span className="sr-only">Cari kode pasien</span>
                    <Search className="pointer-events-none absolute left-3 top-3.5 text-text-muted" size={17} />
                    <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} type="search" placeholder="Cari kode pasien" className="min-h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm">
                    <Filter size={16} className="text-primary" aria-hidden="true" /><span className="sr-only">Filter status</span>
                    <select value={resultFilter} onChange={(event) => setResultFilter(event.target.value as ResultFilter)} className="bg-transparent font-medium text-text outline-none">
                      <option value="action">Perlu tindakan ({actionCount})</option>
                      <option value="warning">Peringatan</option>
                      <option value="error">Gagal diproses</option>
                      <option value="appropriate">Dosis & interval sesuai</option>
                      <option value="all">Semua hasil</option>
                    </select>
                  </label>
                  <label className="flex min-h-11 items-center rounded-xl border border-border bg-surface px-3 text-sm">
                    <span className="sr-only">Filter antibiotik</span>
                    <select value={antibioticFilter} onChange={(event) => setAntibioticFilter(event.target.value as Antibiotic | "all")} className="bg-transparent font-medium text-text outline-none">
                      <option value="all">Semua antibiotik</option>
                      {(Object.keys(ANTIBIOTIC_LABELS) as Antibiotic[]).map((antibiotic) => <option key={antibiotic} value={antibiotic}>{ANTIBIOTIC_LABELS[antibiotic]}</option>)}
                    </select>
                  </label>
                  <p className="text-sm text-text-muted md:col-span-3" aria-live="polite">Menampilkan {previewRows.length} dari {filteredRows.length} hasil yang cocok.</p>
                </div>
                <div className="max-w-full overflow-x-auto overscroll-x-contain">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-muted"><tr><th className="px-4 py-3">Baris</th><th className="px-4 py-3">Kode</th><th className="px-4 py-3">Antibiotik</th><th className="px-4 py-3">Dosis aktual</th><th className="px-4 py-3">Interval aktual</th><th className="px-4 py-3">Proses</th></tr></thead>
                    <tbody className="divide-y divide-border">
                      {previewRows.map((row) => {
                        const open = expandedRow === row.sourceRow;
                        if (row.status === "gagal") return (
                          <Fragment key={`${row.sourceRow}-${row.patientCode}`}>
                            <tr className="align-top hover:bg-error/[0.03]">
                              <td className="px-4 py-3 text-text-muted">{row.sourceRow}</td>
                              <td className="px-4 py-3 font-medium text-text">{row.patientCode || "Tanpa kode"}</td>
                              <td className="px-4 py-3 text-text-muted">—</td>
                              <td className="px-4 py-3 text-text-muted">—</td>
                              <td className="px-4 py-3 text-text-muted">—</td>
                              <td className="px-4 py-2"><button type="button" onClick={() => setExpandedRow(open ? null : row.sourceRow)} aria-expanded={open} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-error hover:bg-error/10"><AlertCircle size={15} />Gagal<ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} /></button></td>
                            </tr>
                            {open && <tr className="bg-error/[0.035]"><td colSpan={6} className="px-4 py-4"><div className="rounded-xl border border-error/20 bg-surface p-4"><p className="font-semibold text-error">Perbaiki data pada baris {row.sourceRow}</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-muted">{row.errors.map((item) => <li key={item}>{item}</li>)}</ul></div></td></tr>}
                          </Fragment>
                        );
                        const status = primaryStatus(row);
                        return (
                          <Fragment key={`${row.sourceRow}-${row.patientCode}`}>
                            <tr className="align-top hover:bg-primary/[0.025]">
                              <td className="px-4 py-3 text-text-muted">{row.sourceRow}</td>
                              <td className="px-4 py-3 font-medium text-text">{row.patientCode}</td>
                              <td className="px-4 py-3 text-text-muted">{ANTIBIOTIC_LABELS[row.calculator.input.antibiotic]}</td>
                              <td className="px-4 py-3"><StatusBadge value={status?.actualDose.status ?? "tidak-dapat-dievaluasi"} /></td>
                              <td className="px-4 py-3"><StatusBadge value={status?.actualInterval.status ?? "tidak-dapat-dievaluasi"} /></td>
                              <td className="px-4 py-2"><button type="button" onClick={() => setExpandedRow(open ? null : row.sourceRow)} aria-expanded={open} className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold ${row.warnings.length > 0 ? "text-warning hover:bg-warning/10" : "text-primary hover:bg-primary/10"}`}>{row.warnings.length > 0 ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}{row.warnings.length > 0 ? "Peringatan" : "Lihat detail"}<ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} /></button></td>
                            </tr>
                            {open && (
                              <tr className="bg-primary/[0.025]"><td colSpan={6} className="px-4 py-4">
                                <div className="grid gap-4 rounded-xl border border-border bg-surface p-4 lg:grid-cols-3">
                                  <div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Data pasien</p><dl className="mt-2 space-y-1 text-sm"><div className="flex justify-between gap-3"><dt>GA / PNA</dt><dd className="font-medium text-text">{row.calculator.input.gestationalAgeWeeks} minggu / {row.calculator.input.postnatalAgeDays} hari</dd></div><div className="flex justify-between gap-3"><dt>Berat</dt><dd className="font-medium text-text">{row.calculator.input.currentWeightKg} kg</dd></div></dl></div>
                                  <div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Penilaian regimen aktual</p><p className="mt-2 text-sm text-text"><strong>Dosis:</strong> {status?.actualDose.message ?? "Tidak dapat dievaluasi."}</p><p className="mt-1 text-sm text-text"><strong>Interval:</strong> {status?.actualInterval.message ?? "Tidak dapat dievaluasi."}</p></div>
                                  <div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Catatan tindak lanjut</p>{row.warnings.length > 0 ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-warning">{row.warnings.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-success">Tidak ada peringatan tambahan pada baris ini.</p>}</div>
                                </div>
                              </td></tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {previewRows.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center"><Filter className="mx-auto text-text-muted" aria-hidden="true" /><p className="mt-3 font-semibold text-text">Tidak ada hasil yang cocok</p><p className="mt-1 text-sm text-text-muted">Ubah filter atau kata pencarian untuk melihat baris lainnya.</p></td></tr>}
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
