"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  FileWarning,
  Info,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  ANTIBIOTIC_LABELS,
  CALCULATOR_RULE_VERSION,
  CLINICAL_DISCLAIMER,
  calculateRecommendations,
  evaluateRegimen,
  formatInterval,
  formatNumber,
  validatePatientInput,
  validateRegimenEvaluationInput,
  type Antibiotic,
  type CalculatorResult,
  type ClinicalWarning,
  type DirectionComparison,
  type PatientInput,
  type Recommendation,
  type RecommendationEvaluation,
  type RegimenEvaluationInput,
  type RegimenEvaluationResult,
  type ValidationIssue,
} from "@/lib/neonatal-calculator";

type Tab = "recommendation" | "evaluation";
type PatientForm = {
  patientLabel: string;
  antibiotic: Antibiotic;
  gestationalAgeWeeks: string;
  postnatalAgeDays: string;
  currentWeightKg: string;
  renalDataAvailable: boolean;
  serumCreatinineMgDl: string;
  urineOutputMlKgHour: string;
  therapeuticHypothermia: boolean;
  coxInhibitorTherapy: boolean;
  severeSepsisOrHighRiskInfection: boolean;
};
type EvaluationForm = Record<keyof RegimenEvaluationInput, string>;

const initialPatientForm: PatientForm = {
  patientLabel: "",
  antibiotic: "gentamisin",
  gestationalAgeWeeks: "",
  postnatalAgeDays: "",
  currentWeightKg: "",
  renalDataAvailable: false,
  serumCreatinineMgDl: "",
  urineOutputMlKgHour: "",
  therapeuticHypothermia: false,
  coxInhibitorTherapy: false,
  severeSepsisOrHighRiskInfection: false,
};

const initialEvaluationForm: EvaluationForm = {
  manualDoseMinMg: "",
  manualDoseMaxMg: "",
  manualIntervalMinHours: "",
  manualIntervalMaxHours: "",
  actualDoseMg: "",
  actualIntervalHours: "",
};

function issuesByField(issues: ValidationIssue[]): Record<string, string> {
  return Object.fromEntries(issues.map((issue) => [issue.field, issue.message]));
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  helper,
  required = false,
  ...inputProps
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helper?: string;
  required?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange">) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-text">
        {label} {required && <span className="text-error" aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
        className={`min-h-11 w-full rounded-xl border bg-background px-3 py-2.5 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${error ? "border-error" : "border-border focus-visible:border-primary"}`}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-error" role="alert">{error}</p>
      ) : helper ? (
        <p id={`${id}-helper`} className="text-xs leading-relaxed text-text-muted">{helper}</p>
      ) : null}
    </div>
  );
}

function Warning({ warning }: { warning: ClinicalWarning }) {
  const tone =
    warning.severity === "critical"
      ? "border-error/30 bg-error/10 text-error"
      : warning.severity === "warning"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-info/30 bg-info/10 text-info";
  return (
    <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm leading-relaxed ${tone}`}>
      <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{warning.message}</span>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const dose = recommendation.dose;
  const totalDose =
    dose.minTotalMg === null
      ? "Tidak tersedia"
      : dose.minTotalMg === dose.maxTotalMg
        ? `${formatNumber(dose.minTotalMg)} mg`
        : `${formatNumber(dose.minTotalMg)}–${formatNumber(dose.maxTotalMg ?? dose.minTotalMg)} mg`;
  const perKg =
    dose.minMgPerKg === null
      ? "Tidak tersedia"
      : dose.minMgPerKg === dose.maxMgPerKg
        ? `${formatNumber(dose.minMgPerKg)} mg/kg/dosis`
        : `${formatNumber(dose.minMgPerKg)}–${formatNumber(dose.maxMgPerKg ?? dose.minMgPerKg)} mg/kg/dosis`;
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm print-break-inside-avoid">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{recommendation.provenanceLabel}</p>
      <h3 className="mt-1 text-xl font-semibold text-text">{recommendation.label}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div className="rounded-xl bg-primary/8 p-3">
          <p className="text-xs text-text-muted">Dosis per pemberian</p>
          <p className="mt-1 text-xl font-bold text-primary">{totalDose}</p>
          <p className="mt-1 text-xs text-text-muted">{perKg}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-text-muted">Interval</p>
          <p className="mt-1 text-lg font-bold text-text">{formatInterval(recommendation.interval)}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">{recommendation.interval.label}</p>
        </div>
      </div>
      {recommendation.notes.length > 0 && (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-text-muted">
          {recommendation.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}
      {recommendation.warnings.length > 0 && (
        <div className="mt-4 space-y-2">{recommendation.warnings.map((warning) => <Warning key={warning.code} warning={warning} />)}</div>
      )}
      <details className="mt-4 border-t border-border pt-3 text-sm">
        <summary className="min-h-11 cursor-pointer py-3 font-medium text-primary">Provenans aturan</summary>
        <p className="pb-2 leading-relaxed text-text-muted">{recommendation.provenanceDetail}</p>
      </details>
    </article>
  );
}

function Direction({ comparison }: { comparison: DirectionComparison | null }) {
  return comparison ? <span>{comparison.message}</span> : <span>Tidak berlaku.</span>;
}

function formatEvaluationInterval(hours: number | null): string {
  return hours === null ? "Tidak berlaku" : `q${hours}h`;
}

function formatEvaluationIntervalRange(minHours: number | null, maxHours: number | null): string {
  if (minHours === null || maxHours === null) return "Tidak berlaku";
  return minHours === maxHours ? `q${minHours}h` : `q${minHours}h–q${maxHours}h`;
}

function EvaluationCard({ target }: { target: RecommendationEvaluation }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5 print-break-inside-avoid">
      <h3 className="text-lg font-semibold text-text">{target.recommendationLabel}</h3>
      <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="font-semibold text-text">Dosis aktual</dt>
          <dd className="mt-1 text-text-muted"><strong className="capitalize text-text">{target.actualDose.status.replaceAll("-", " ")}</strong> — {target.actualDose.message}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="font-semibold text-text">Interval aktual</dt>
          <dd className="mt-1 text-text-muted"><strong className="capitalize text-text">{target.actualInterval.status.replaceAll("-", " ")}</strong> — {target.actualInterval.message}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="font-semibold text-text">Rentang manual vs dosis</dt>
          <dd className="mt-1 space-y-1 text-text-muted"><div>Batas bawah: <Direction comparison={target.manualDose.lowerBound} /></div>{!target.manualDose.fixedRecommendation && <div>Batas atas: <Direction comparison={target.manualDose.upperBound} /></div>}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="font-semibold text-text">Rentang manual vs interval</dt>
          <dd className="mt-1 space-y-1 text-text-muted"><div>Batas bawah: <Direction comparison={target.manualInterval.lowerBound} /></div>{!target.manualInterval.fixedRecommendation && <div>Batas atas: <Direction comparison={target.manualInterval.upperBound} /></div>}</dd>
        </div>
      </dl>
    </article>
  );
}

export function NeonatalCalculator() {
  const [tab, setTab] = useState<Tab>("recommendation");
  const [patientForm, setPatientForm] = useState(initialPatientForm);
  const [patientErrors, setPatientErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [evaluationForm, setEvaluationForm] = useState(initialEvaluationForm);
  const [evaluationErrors, setEvaluationErrors] = useState<Record<string, string>>({});
  const [evaluation, setEvaluation] = useState<RegimenEvaluationResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const recommendationTabRef = useRef<HTMLButtonElement>(null);
  const evaluationTabRef = useRef<HTMLButtonElement>(null);

  const selectTab = (nextTab: Tab, focus = false) => {
    setTab(nextTab);
    if (focus) {
      const target =
        nextTab === "recommendation" ? recommendationTabRef : evaluationTabRef;
      window.requestAnimationFrame(() => target.current?.focus());
    }
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      selectTab(tab === "recommendation" ? "evaluation" : "recommendation", true);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectTab("recommendation", true);
    } else if (event.key === "End") {
      event.preventDefault();
      selectTab("evaluation", true);
    }
  };

  const updatePatient = <K extends keyof PatientForm>(key: K, value: PatientForm[K]) => {
    setPatientForm((current) => ({ ...current, [key]: value }));
    setResult(null);
    setEvaluation(null);
    setPatientErrors((current) => ({ ...current, [key]: "" }));
  };

  const calculate = () => {
    const candidate: PatientInput = {
      patientLabel: patientForm.patientLabel || undefined,
      antibiotic: patientForm.antibiotic,
      gestationalAgeWeeks:
        patientForm.gestationalAgeWeeks === "" ? Number.NaN : Number(patientForm.gestationalAgeWeeks),
      postnatalAgeDays:
        patientForm.postnatalAgeDays === "" ? Number.NaN : Number(patientForm.postnatalAgeDays),
      currentWeightKg:
        patientForm.currentWeightKg === "" ? Number.NaN : Number(patientForm.currentWeightKg),
      renalDataAvailable: patientForm.renalDataAvailable,
      serumCreatinineMgDl:
        patientForm.renalDataAvailable && patientForm.serumCreatinineMgDl !== ""
          ? Number(patientForm.serumCreatinineMgDl)
          : undefined,
      urineOutputMlKgHour:
        patientForm.renalDataAvailable && patientForm.urineOutputMlKgHour !== ""
          ? Number(patientForm.urineOutputMlKgHour)
          : undefined,
      therapeuticHypothermia: patientForm.therapeuticHypothermia,
      coxInhibitorTherapy: patientForm.coxInhibitorTherapy,
      severeSepsisOrHighRiskInfection: patientForm.severeSepsisOrHighRiskInfection,
    };
    const validated = validatePatientInput(candidate);
    if (!validated.success) {
      setPatientErrors(issuesByField(validated.issues));
      setResult(null);
      return;
    }
    setPatientErrors({});
    setResult(calculateRecommendations(validated.data));
    setEvaluation(null);
  };

  const runEvaluation = () => {
    if (!result) return;
    const intervalsRequired = Object.values(result.recommendations).some(
      (recommendation) =>
        recommendation.eligibleForRegimenEvaluation &&
        recommendation.interval.kind !== "single-dose-only" &&
        recommendation.interval.kind !== "continuous-range",
    );
    const candidate: RegimenEvaluationInput = {
      manualDoseMinMg: Number(evaluationForm.manualDoseMinMg),
      manualDoseMaxMg: Number(evaluationForm.manualDoseMaxMg),
      actualDoseMg: Number(evaluationForm.actualDoseMg),
      manualIntervalMinHours: evaluationForm.manualIntervalMinHours === "" ? null : Number(evaluationForm.manualIntervalMinHours),
      manualIntervalMaxHours: evaluationForm.manualIntervalMaxHours === "" ? null : Number(evaluationForm.manualIntervalMaxHours),
      actualIntervalHours: evaluationForm.actualIntervalHours === "" ? null : Number(evaluationForm.actualIntervalHours),
    };
    const validated = validateRegimenEvaluationInput(candidate, intervalsRequired);
    if (!validated.success) {
      setEvaluationErrors(issuesByField(validated.issues));
      setEvaluation(null);
      return;
    }
    setEvaluationErrors({});
    setEvaluation(evaluateRegimen(result, validated.data));
  };

  const printReport = () => {
    setGeneratedAt(new Date().toLocaleString("id-ID"));
    window.requestAnimationFrame(() => window.print());
  };

  const renalStatusLabel =
    result?.renalStatus === "data-unavailable"
      ? "Data fungsi ginjal tidak tersedia"
      : result?.renalStatus === "renal-impairment-criteria-met"
        ? result.input.antibiotic === "vankomisin"
          ? "Kriteria gangguan ginjal UNC untuk vankomisin terpenuhi"
          : "Sinyal kaji ulang fungsi ginjal (kriteria UNC vankomisin; bukan aturan penyesuaian aminoglikosida)"
        : result?.input.antibiotic === "vankomisin"
          ? "Kriteria gangguan ginjal UNC untuk vankomisin tidak terpenuhi dari data yang diberikan"
          : "Tidak ada sinyal berdasarkan kriteria kaji ulang UNC dari data yang diberikan; bukan konfirmasi fungsi ginjal normal";
  const activeIntervalsRequired = result
    ? Object.values(result.recommendations).some(
        (recommendation) =>
          recommendation.eligibleForRegimenEvaluation &&
          recommendation.interval.kind !== "single-dose-only" &&
          recommendation.interval.kind !== "continuous-range",
      )
    : true;

  return (
    <div className="container max-w-7xl pb-16 print-container">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Calculator size={24} aria-hidden="true" /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Neonatal antibiotic CDS</p>
            <h1 className="text-3xl font-semibold text-text md:text-4xl">Kalkulator Antibiotik Neonatus</h1>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-muted">Rekomendasi deterministik dan lokal untuk gentamisin, amikasin, serta vankomisin. Tidak ada data yang disimpan otomatis atau dikirim ke layanan eksternal.</p>
      </header>

      <div className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-warning/40 bg-warning/10 p-4 text-sm leading-relaxed text-text" role="note">
        <ShieldAlert size={22} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
        <div><strong className="block text-warning">Batasan keselamatan klinis</strong>{CLINICAL_DISCLAIMER}</div>
      </div>

      <div className="mb-6 flex gap-2 rounded-2xl border border-border bg-surface p-1.5 print-hide" role="tablist" aria-label="Mode kalkulator">
        <button ref={recommendationTabRef} id="recommendation-tab" type="button" role="tab" tabIndex={tab === "recommendation" ? 0 : -1} aria-selected={tab === "recommendation"} aria-controls="recommendation-panel" onKeyDown={handleTabKeyDown} onClick={() => selectTab("recommendation")} className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === "recommendation" ? "bg-primary text-white" : "text-text-muted hover:bg-surface-2"}`}>Rekomendasi Dosis</button>
        <button ref={evaluationTabRef} id="evaluation-tab" type="button" role="tab" tabIndex={tab === "evaluation" ? 0 : -1} aria-selected={tab === "evaluation"} aria-controls="evaluation-panel" onKeyDown={handleTabKeyDown} onClick={() => selectTab("evaluation")} className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === "evaluation" ? "bg-primary text-white" : "text-text-muted hover:bg-surface-2"}`}>Evaluasi Pemberian</button>
      </div>

      <section id="recommendation-panel" role="tabpanel" aria-labelledby="recommendation-tab" hidden={tab !== "recommendation"} className="print-always">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
          <div className="rounded-2xl border border-border bg-surface p-5 print-hide">
            <h2 className="text-xl font-semibold text-text">Data kasus</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">Semua field klinis hanya berada dalam memori tab ini.</p>
            <div className="mt-5 grid gap-4">
              <Field id="patient-label" label="Label kasus / kode pasien (opsional)" value={patientForm.patientLabel} onChange={(value) => updatePatient("patientLabel", value)} maxLength={60} error={patientErrors.patientLabel} helper="Label kasus non-identifying; jangan masukkan nama, nomor rekam medis, NIK, tanggal lahir, atau identitas pasien." />
              <div>
                <label htmlFor="antibiotic" className="block text-sm font-medium text-text">Antibiotik <span className="text-error">*</span></label>
                <select id="antibiotic" value={patientForm.antibiotic} onChange={(event) => updatePatient("antibiotic", event.target.value as Antibiotic)} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  {Object.entries(ANTIBIOTIC_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="ga" label="Usia gestasi lahir (minggu)" type="number" min="22" max="43" step="0.1" required value={patientForm.gestationalAgeWeeks} onChange={(value) => updatePatient("gestationalAgeWeeks", value)} error={patientErrors.gestationalAgeWeeks} />
                <Field id="pna" label="Usia pascalahir (hari)" type="number" min="0" max="365" step="1" required value={patientForm.postnatalAgeDays} onChange={(value) => updatePatient("postnatalAgeDays", value)} error={patientErrors.postnatalAgeDays} />
                <Field id="weight" label="Berat badan saat ini (kg)" type="number" min="0.301" max="10" step="0.001" required value={patientForm.currentWeightKg} onChange={(value) => updatePatient("currentWeightKg", value)} error={patientErrors.currentWeightKg} />
              </div>
              <fieldset className="rounded-xl border border-border p-4">
                <legend className="px-1 text-sm font-semibold text-text">Fungsi ginjal</legend>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-text"><input type="checkbox" className="h-5 w-5 accent-primary" checked={patientForm.renalDataAvailable} onChange={(event) => { const available = event.target.checked; setPatientForm((current) => ({ ...current, renalDataAvailable: available, serumCreatinineMgDl: available ? current.serumCreatinineMgDl : "", urineOutputMlKgHour: available ? current.urineOutputMlKgHour : "" })); setResult(null); setEvaluation(null); }} />Data fungsi ginjal tersedia</label>
                {!patientForm.renalDataAvailable && <p className="mt-2 text-xs leading-relaxed text-warning">Fungsi ginjal normal tidak akan diasumsikan bila data tidak tersedia.</p>}
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field id="scr" label="SCr (mg/dL)" type="number" min="0" max="10" step="0.01" required={patientForm.renalDataAvailable} disabled={!patientForm.renalDataAvailable} value={patientForm.serumCreatinineMgDl} onChange={(value) => updatePatient("serumCreatinineMgDl", value)} error={patientErrors.serumCreatinineMgDl} />
                  <Field id="uop" label="UOP (mL/kg/jam)" type="number" min="0" max="10" step="0.01" disabled={!patientForm.renalDataAvailable} value={patientForm.urineOutputMlKgHour} onChange={(value) => updatePatient("urineOutputMlKgHour", value)} error={patientErrors.urineOutputMlKgHour} helper="Opsional, tetapi sangat dianjurkan." />
                </div>
              </fieldset>
              <fieldset className="space-y-2 rounded-xl border border-border p-4">
                <legend className="px-1 text-sm font-semibold text-text">Konteks klinis</legend>
                {([
                  ["therapeuticHypothermia", "Hipotermia terapeutik / HIE"],
                  ["coxInhibitorTherapy", "Terapi indometasin atau ibuprofen (COX inhibitor)"],
                  ["severeSepsisOrHighRiskInfection", "Sepsis berat / kecurigaan MRSA / meningitis / endokarditis"],
                ] as const).map(([key, label]) => <label key={key} className={`flex min-h-11 cursor-pointer items-center gap-3 text-sm ${key === "severeSepsisOrHighRiskInfection" && patientForm.antibiotic !== "vankomisin" ? "text-text-muted" : "text-text"}`}><input type="checkbox" checked={patientForm[key]} onChange={(event) => updatePatient(key, event.target.checked)} className="h-5 w-5 accent-primary" />{label}</label>)}
              </fieldset>
              <Button type="button" onClick={calculate} className="min-h-12 rounded-xl"><Calculator size={18} />Hitung rekomendasi</Button>
            </div>
          </div>

          <div>
            {!result ? (
              <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-8 text-center print-hide"><div><FileWarning className="mx-auto text-text-muted" aria-hidden="true" /><h2 className="mt-3 text-xl font-semibold text-text">Belum ada hasil aktif</h2><p className="mt-2 max-w-md text-sm text-text-muted">Isi data kasus dan hitung rekomendasi. Data ginjal yang tidak tersedia akan ditandai, bukan dianggap normal.</p></div></div>
            ) : (
              <div className="space-y-5" aria-live="polite">
                <div className="rounded-2xl border border-border bg-surface p-4 print-break-inside-avoid">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Ringkasan input</p><h2 className="text-xl font-semibold text-text">{ANTIBIOTIC_LABELS[result.input.antibiotic]}{result.input.patientLabel ? ` — ${result.input.patientLabel}` : ""}</h2></div><Button type="button" variant="outline" onClick={printReport} className="print-hide"><Printer size={17} />Cetak / Simpan sebagai PDF</Button></div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3"><div><dt className="text-text-muted">GA lahir / PNA / PMA</dt><dd className="font-semibold text-text">{formatNumber(result.input.gestationalAgeWeeks)} minggu / {result.input.postnatalAgeDays} hari / {result.pmaWeeks.toFixed(1)} minggu</dd></div><div><dt className="text-text-muted">Berat</dt><dd className="font-semibold text-text">{formatNumber(result.input.currentWeightKg)} kg</dd></div><div><dt className="text-text-muted">Status data ginjal</dt><dd className="font-semibold text-text">{renalStatusLabel}</dd></div><div><dt className="text-text-muted">SCr / UOP</dt><dd className="font-semibold text-text">{result.input.serumCreatinineMgDl === undefined ? "Tidak tersedia" : `${formatNumber(result.input.serumCreatinineMgDl)} mg/dL`} / {result.input.urineOutputMlKgHour === undefined ? "Tidak tersedia" : `${formatNumber(result.input.urineOutputMlKgHour)} mL/kg/jam`}</dd></div><div className="sm:col-span-2"><dt className="text-text-muted">Konteks klinis</dt><dd className="font-semibold text-text">{[result.input.therapeuticHypothermia && "Hipotermia terapeutik/HIE", result.input.coxInhibitorTherapy && "COX inhibitor", result.input.severeSepsisOrHighRiskInfection && "Sepsis berat/infeksi risiko tinggi"].filter(Boolean).join("; ") || "Tidak ada modifier yang dipilih"}</dd></div></dl>
                  {generatedAt && <p className="mt-3 hidden text-xs text-text-muted print:block">Dibuat lokal: {generatedAt} · Versi aturan: {result.calculatorRuleVersion}</p>}
                </div>
                {result.globalWarnings.map((warning) => <Warning key={warning.code} warning={warning} />)}
                <div className="grid gap-4 xl:grid-cols-3">
                  <RecommendationCard recommendation={result.recommendations.institutionalPrimary} />
                  <RecommendationCard recommendation={result.recommendations.institutionalAgeComparator} />
                  <RecommendationCard recommendation={result.recommendations.anmf2024} />
                </div>
                <details className="rounded-2xl border border-border bg-surface p-4">
                  <summary className="min-h-11 cursor-pointer py-2 font-semibold text-text">Catatan Referensi Tambahan</summary>
                  <p className="mb-3 text-sm text-warning">Catatan kualitatif saja; tidak digunakan sebagai nomogram dosis.</p>
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-text-muted">{result.qualitativeReferenceNotes.map((note) => <li key={note}>{note}</li>)}</ul>
                </details>
                <details className="rounded-2xl border border-border bg-surface p-4">
                  <summary className="min-h-11 cursor-pointer py-2 font-semibold text-text">Sumber dan batas aturan produksi</summary>
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-text-muted"><li>SPO Sepsis Neonatal RSUP Dr. M. Djamil Padang (2017) dan PNPK Kemenkes RI (2021).</li><li>UNC Medical Center Vancomycin Dosing & Monitoring Guide (2023).</li><li>ANMF Gentamicin v4.0, Amikacin v3.0, dan Vancomycin Intermittent v3.0/errata (2024).</li><li>Formulasi berasal dari materi rujukan notebook dan wajib diverifikasi terhadap pedoman institusi terbaru.</li></ul>
                </details>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="evaluation-panel" role="tabpanel" aria-labelledby="evaluation-tab" hidden={tab !== "evaluation"} className="print-evaluation">
        {!result ? (
          <div className="rounded-2xl border border-warning/30 bg-warning/10 p-6 text-sm text-text"><strong>Hitung rekomendasi terlebih dahulu.</strong> Tab evaluasi menggunakan data pasien dan antibiotik dari hasil aktif.</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
            <div className="rounded-2xl border border-border bg-surface p-5 print-hide">
              <h2 className="text-xl font-semibold text-text">Regimen yang dievaluasi</h2>
              <dl className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
                <div>
                  <dt className="text-text-muted">Antibiotik yang dievaluasi</dt>
                  <dd className="font-semibold text-text">{ANTIBIOTIC_LABELS[result.input.antibiotic]}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">Antibiotik dan data pasien digunakan dari hasil rekomendasi aktif. Ubah keduanya pada tab Rekomendasi Dosis lalu hitung ulang bila diperlukan.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {([
                  ["manualDoseMinMg", "Dosis manual minimum (mg)", "0.001"],
                  ["manualDoseMaxMg", "Dosis manual maksimum (mg)", "0.001"],
                  ["manualIntervalMinHours", "Interval manual minimum / paling sering (jam)", "1"],
                  ["manualIntervalMaxHours", "Interval manual maksimum / paling jarang (jam)", "1"],
                  ["actualDoseMg", "Dosis aktual diberikan (mg)", "0.001"],
                  ["actualIntervalHours", "Interval aktual diberikan (jam)", "1"],
                ] as const).map(([key, label, step]) => { const intervalField = key.toLowerCase().includes("interval"); return <Field key={key} id={key} label={label} type="number" min="0.001" step={step} required={!intervalField || activeIntervalsRequired} disabled={intervalField && !activeIntervalsRequired} helper={intervalField && !activeIntervalsRequired ? "Tidak diperlukan pada jalur dosis tunggal; dosis berikutnya menunggu kadar dan evaluasi klinis." : undefined} value={evaluationForm[key]} onChange={(value) => { setEvaluationForm((current) => ({ ...current, [key]: value })); setEvaluation(null); setEvaluationErrors((current) => ({ ...current, [key]: "" })); }} error={evaluationErrors[key]} />; })}
              </div>
              <Button type="button" onClick={runEvaluation} className="mt-5 min-h-12 w-full rounded-xl"><CheckCircle2 size={18} />Evaluasi regimen</Button>
            </div>
            <div className="space-y-4">
              {!evaluation ? (
                <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-text-muted print-hide">Masukkan dosis dan interval manual serta aktual untuk melihat perbandingan tiga sumber secara terpisah.</div>
              ) : (
                <>
                  <div className="rounded-2xl border border-border bg-surface p-4 print-break-inside-avoid">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Hasil evaluasi aktif</p>
                        <h2 className="text-xl font-semibold text-text">Evaluasi Pemberian — {ANTIBIOTIC_LABELS[result.input.antibiotic]}</h2>
                      </div>
                      <Button type="button" variant="outline" onClick={printReport} className="print-hide">
                        <Printer size={17} />Cetak / Simpan sebagai PDF
                      </Button>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-text-muted">Rentang dosis manual</dt>
                        <dd className="font-semibold text-text">{formatNumber(evaluation.input.manualDoseMinMg)}–{formatNumber(evaluation.input.manualDoseMaxMg)} mg</dd>
                      </div>
                      <div>
                        <dt className="text-text-muted">Dosis aktual</dt>
                        <dd className="font-semibold text-text">{formatNumber(evaluation.input.actualDoseMg)} mg</dd>
                      </div>
                      <div>
                        <dt className="text-text-muted">Rentang interval manual</dt>
                        <dd className="font-semibold text-text">{formatEvaluationIntervalRange(evaluation.input.manualIntervalMinHours, evaluation.input.manualIntervalMaxHours)}</dd>
                      </div>
                      <div>
                        <dt className="text-text-muted">Interval aktual</dt>
                        <dd className="font-semibold text-text">{formatEvaluationInterval(evaluation.input.actualIntervalHours)}</dd>
                      </div>
                    </dl>
                  </div>
                  {evaluation.targets.map((target) => <EvaluationCard key={target.recommendationId} target={target} />)}
                </>
              )}
            </div>
          </div>
        )}
      </section>

      <footer className="mt-8 rounded-2xl border border-info/20 bg-info/5 p-4 text-xs leading-relaxed text-text-muted print-always print-break-inside-avoid">
        <div className="flex items-start gap-2"><Info size={16} className="mt-0.5 shrink-0 text-info" aria-hidden="true" /><div><strong className="text-text">Versi aturan {CALCULATOR_RULE_VERSION}.</strong> {CLINICAL_DISCLAIMER} Kalkulator ini belum divalidasi klinis atau regulatoris dan bukan alat medis.</div></div>
      </footer>
    </div>
  );
}
