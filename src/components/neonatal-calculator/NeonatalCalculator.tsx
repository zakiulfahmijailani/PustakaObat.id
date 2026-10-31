"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  FileWarning,
  Info,
  LoaderCircle,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buildRecommendationPdf, buildEvaluationPdf, downloadPdf } from "@/lib/neonatal-calculator/pdf-reports";
import { BatchCalculator } from "./BatchCalculator";
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

type Tab = "recommendation" | "evaluation" | "batch";
type PatientForm = {
  patientLabel: string;
  antibiotic: Antibiotic | "";
  gestationalAgeWeeks: string;
  gestationalAgeDays: string;
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
  patientLabel: "Pasien 1",
  antibiotic: "",
  gestationalAgeWeeks: "",
  gestationalAgeDays: "",
  postnatalAgeDays: "",
  currentWeightKg: "",
  renalDataAvailable: false,
  serumCreatinineMgDl: "",
  urineOutputMlKgHour: "",
  therapeuticHypothermia: false,
  coxInhibitorTherapy: false,
  severeSepsisOrHighRiskInfection: false,
};

function freshPatient(n: number): PatientForm { return { ...initialPatientForm, patientLabel: `Pasien ${n}` }; }

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
        inputMode={inputProps.type === "number" ? "decimal" : inputProps.inputMode}
        className={`min-h-11 w-full rounded-xl border bg-background px-3 py-2.5 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${error ? "border-error" : "border-border focus-visible:border-primary"}`}
        {...inputProps}
        type={inputProps.type === "number" ? "text" : inputProps.type}
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
      <span><strong>{warning.severity === "critical" ? "PERINGATAN:" : warning.severity === "warning" ? "PERHATIAN:" : "INFORMASI:"}</strong> {warning.title && <strong>{warning.title}. </strong>}{warning.message}</span>
    </div>
  );
}

function Direction({ comparison }: { comparison: DirectionComparison | null }) {
  return comparison ? <span>{comparison.message}</span> : <span>Tidak berlaku.</span>;
}

function EvaluationCard({ target, showManual = true }: { target: RecommendationEvaluation; showManual?: boolean }) {
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
        {showManual && <div className="rounded-xl bg-surface-2 p-3">
          <dt className="font-semibold text-text">Rentang manual vs dosis</dt>
          <dd className="mt-1 space-y-1 text-text-muted">{target.manualDose.summary ?? <Direction comparison={target.manualDose.lowerBound} />}</dd>
        </div>}
        {showManual && <div className="rounded-xl bg-surface-2 p-3">
          <dt className="font-semibold text-text">Rentang manual vs interval</dt>
          <dd className="mt-1 space-y-1 text-text-muted">{target.manualInterval.summary ?? <Direction comparison={target.manualInterval.lowerBound} />}</dd>
        </div>}
      </dl>
    </article>
  );
}


function PatientCaseFields({
  form, errors, onChange, prefix,
}: {
  form: PatientForm;
  errors: Record<string, string>;
  prefix: string;
  onChange: (key: keyof PatientForm, value: string | boolean) => void;
}) {
  return (
    <>
              <Field id={`${prefix}-patient-label`} label="Kode pasien" value={form.patientLabel} onChange={(value) => onChange("patientLabel", value)} maxLength={60} error={errors.patientLabel} helper="Label kasus non-identifying; jangan masukkan nama, nomor rekam medis, NIK, tanggal lahir, atau identitas pasien." />
              <div>
                <label htmlFor={`${prefix}-antibiotic`} className="block text-sm font-medium text-text">Antibiotik <span className="text-error">*</span></label>
                <select id={`${prefix}-antibiotic`} value={form.antibiotic} onChange={(event) => onChange("antibiotic", event.target.value as PatientForm["antibiotic"])} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  <option value="">-- pilih antibiotik --</option>
                  {Object.entries(ANTIBIOTIC_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={`${prefix}-ga`} label="Usia gestasi saat lahir — minggu" type="number" min="22" max="43" step="1" required placeholder="mis. 32" value={form.gestationalAgeWeeks} onChange={(value) => onChange("gestationalAgeWeeks", value)} error={errors.gestationalAgeWeeks} />
                <Field id={`${prefix}-ga-days`} label="Usia gestasi saat lahir — tambahan hari (opsional)" type="number" min="0" max="6" step="1" placeholder="mis. 4" value={form.gestationalAgeDays} onChange={(value) => onChange("gestationalAgeDays", value)} error={errors.gestationalAgeDays} />
                <Field id={`${prefix}-pna`} label="Usia pascalahir (hari)" type="number" min="0" max="28" step="1" required placeholder="mis. 3" value={form.postnatalAgeDays} onChange={(value) => onChange("postnatalAgeDays", value)} error={errors.postnatalAgeDays} />
                <Field id={`${prefix}-weight`} label="Berat badan saat ini (kg)" type="number" min="0.3" max="10" step="0.001" required placeholder="mis. 1,72" value={form.currentWeightKg} onChange={(value) => onChange("currentWeightKg", value)} error={errors.currentWeightKg} />
              </div>
              <fieldset className="rounded-xl border border-border p-4">
                <legend className="px-1 text-sm font-semibold text-text">Fungsi ginjal</legend>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-text"><input type="checkbox" className="h-5 w-5 accent-primary" checked={form.renalDataAvailable} onChange={(event) => { const available = event.target.checked; onChange("renalDataAvailable", available); }} />Data fungsi ginjal tersedia</label>
                {!form.renalDataAvailable && <p className="mt-2 text-xs leading-relaxed text-warning">Data ginjal tidak tersedia; perhitungan mengikuti asumsi normal sesuai usia pada notebook. Periksa fungsi ginjal sebelum keputusan terapi.</p>}
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field id={`${prefix}-scr`} label="Kreatinin serum (mg/dL)" type="number" min="0" max="10" step="0.01" required={form.renalDataAvailable} disabled={!form.renalDataAvailable} placeholder="mis. 0,6" value={form.serumCreatinineMgDl} onChange={(value) => onChange("serumCreatinineMgDl", value)} error={errors.serumCreatinineMgDl} />
                  <Field id={`${prefix}-uop`} label="Produksi urin (mL/kg/jam)" type="number" min="0" max="10" step="0.01" disabled={!form.renalDataAvailable} placeholder="mis. 2,0" value={form.urineOutputMlKgHour} onChange={(value) => onChange("urineOutputMlKgHour", value)} error={errors.urineOutputMlKgHour} helper="Opsional, tetapi sangat dianjurkan." />
                </div>
              </fieldset>
              <fieldset className="space-y-2 rounded-xl border border-border p-4">
                <legend className="px-1 text-sm font-semibold text-text">Konteks klinis</legend>
                {([
                  ["therapeuticHypothermia", "Hipotermia terapeutik / HIE"],
                  ["coxInhibitorTherapy", "Terapi indometasin atau ibuprofen (COX inhibitor)"],
                  ["severeSepsisOrHighRiskInfection", "Sepsis berat / kecurigaan MRSA / meningitis / endokarditis"],
                ] as const).map(([key, label]) => <label key={key} className={`flex min-h-11 cursor-pointer items-center gap-3 text-sm ${key === "severeSepsisOrHighRiskInfection" && form.antibiotic !== "vankomisin" ? "text-text-muted" : "text-text"}`}><input type="checkbox" checked={form[key]} onChange={(event) => onChange(key, event.target.checked)} className="h-5 w-5 accent-primary" />{label}</label>)}
              </fieldset>

    </>
  );
}

function buildPatientInput(form: PatientForm): PatientInput {
  const number = (raw: string) => raw.trim() === "" ? Number.NaN : Number(raw.replace(",", "."));
  const optional = (raw: string) => raw.trim() === "" ? undefined : number(raw);
  return {
    patientLabel: form.patientLabel || undefined,
    antibiotic: form.antibiotic as Antibiotic,
    gestationalAgeWeeks: number(form.gestationalAgeWeeks),
    gestationalAgeDays: optional(form.gestationalAgeDays),
    postnatalAgeDays: number(form.postnatalAgeDays),
    currentWeightKg: number(form.currentWeightKg),
    renalDataAvailable: form.renalDataAvailable,
    serumCreatinineMgDl: form.renalDataAvailable ? optional(form.serumCreatinineMgDl) : undefined,
    urineOutputMlKgHour: form.renalDataAvailable ? optional(form.urineOutputMlKgHour) : undefined,
    therapeuticHypothermia: form.therapeuticHypothermia,
    coxInhibitorTherapy: form.coxInhibitorTherapy,
    severeSepsisOrHighRiskInfection: form.severeSepsisOrHighRiskInfection,
  };
}

function WarningLegend() {
  return <div className="flex flex-wrap gap-3 text-xs text-text-muted">
    <span className="font-semibold text-error">Merah: peringatan</span>
    <span className="font-semibold text-warning">Kuning: perhatian</span>
    <span className="font-semibold text-info">Biru: informasi</span>
    <span className="font-semibold text-primary">Hijau: sesuai</span>
  </div>;
}

function SortedWarnings({ warnings }: { warnings: ClinicalWarning[] }) {
  const priority = { critical: 0, warning: 1, info: 2 };
  const unique = [...new Map(warnings.map((warning) => [warning.code, warning])).values()];
  return <div className="space-y-2">{unique.sort((a, b) => priority[a.severity] - priority[b.severity]).map((warning) =>
    <Warning key={warning.code} warning={warning} />
  )}</div>;
}

function RecommendationTable({ calculated }: { calculated: CalculatorResult }) {
  const rs = calculated.recommendations.institutionalPrimary;
  const anmf = calculated.recommendations.anmf2024;
  const doseText = (r: Recommendation) => {
    const { minTotalMg, maxTotalMg } = r.dose;
    return minTotalMg === null ? "Tidak tersedia" :
      minTotalMg === maxTotalMg ? `${formatNumber(minTotalMg)} mg` :
      `${formatNumber(minTotalMg)}–${formatNumber(maxTotalMg ?? minTotalMg)} mg`;
  };
  const mgKg = (r: Recommendation) => r.dose.minMgPerKg === r.dose.maxMgPerKg
    ? `${formatNumber(r.dose.minMgPerKg ?? 0)} mg/kg per pemberian`
    : `${formatNumber(r.dose.minMgPerKg ?? 0)}–${formatNumber(r.dose.maxMgPerKg ?? 0)} mg/kg per pemberian`;
  return <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
    <table className="min-w-[560px] w-full text-left text-sm">
      <thead className="bg-surface-2"><tr><th className="p-3">Parameter</th><th className="p-3">Pedoman Rumah Sakit</th><th className="p-3">Literatur Terkini (ANMF 2024)</th></tr></thead>
      <tbody>
        <tr className="border-t border-border"><th className="p-3">Dosis per pemberian</th>{[rs, anmf].map(r=><td className="p-3" key={r.id}><strong>{doseText(r)}</strong><div className="mt-1 text-xs text-text-muted">{mgKg(r)}</div></td>)}</tr>
        <tr className="border-t border-border"><th className="p-3">Frekuensi</th>{[rs, anmf].map(r=><td className="p-3" key={r.id}>{r.interval.kind === "single-dose-only" ? "Dosis tunggal (bukan rutin)" : r.interval.label.startsWith("tiap") ? r.interval.label : formatInterval(r.interval).replace(/q(\d+)h/g, "tiap $1 jam")}</td>)}</tr>
      </tbody>
    </table>
    <p className="border-t border-border p-3 text-xs text-text-muted">Pedoman Rumah Sakit tidak membedakan usia gestasi dalam regimen utama. ANMF 2024 membedakan usia pascamenstruasi dan usia pascalahir. Verifikasi terhadap pedoman klinis terbaru tetap diperlukan.</p>
  </div>;
}

export function NeonatalCalculator({ initialMode = "recommendation" }: { initialMode?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialMode);
  const [patientForm, setPatientForm] = useState(initialPatientForm);
  const [patientErrors, setPatientErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [evaluationPatientForm, setEvaluationPatientForm] = useState<PatientForm>(freshPatient(1));
  const [evaluationPatientErrors, setEvaluationPatientErrors] = useState<Record<string, string>>({});
  const [evaluationResult, setEvaluationResult] = useState<CalculatorResult | null>(null);
  const [manualEnabled, setManualEnabled] = useState(false);
  const [recommendationHistory, setRecommendationHistory] = useState<CalculatorResult[]>([]);
  const [evaluationHistory, setEvaluationHistory] = useState<Array<{ patient: CalculatorResult; evaluation: RegimenEvaluationResult }>>([]);
  const [formMessage, setFormMessage] = useState<Tab | null>(null);
  const [evaluationForm, setEvaluationForm] = useState(initialEvaluationForm);
  const [evaluationErrors, setEvaluationErrors] = useState<Record<string, string>>({});
  const [evaluation, setEvaluation] = useState<RegimenEvaluationResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const resultContainerRef = useRef<HTMLDivElement>(null);
  const recommendationTabRef = useRef<HTMLButtonElement>(null);
  const evaluationTabRef = useRef<HTMLButtonElement>(null);
  const batchTabRef = useRef<HTMLButtonElement>(null);

  const selectTab = (nextTab: Tab, focus = false) => {
    setTab(nextTab);
    if (focus) {
      const target = nextTab === "recommendation"
        ? recommendationTabRef
        : nextTab === "evaluation"
          ? evaluationTabRef
          : batchTabRef;
      window.requestAnimationFrame(() => target.current?.focus());
    }
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const order: Tab[] = ["recommendation", "evaluation", "batch"];
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (order.indexOf(tab) + direction + order.length) % order.length;
      selectTab(order[nextIndex], true);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectTab("recommendation", true);
    } else if (event.key === "End") {
      event.preventDefault();
      selectTab("batch", true);
    }
  };

  const updatePatient = (key: keyof PatientForm, value: string | boolean) => {
    setPatientForm((current) => key === "renalDataAvailable" && value === false ? { ...current, renalDataAvailable: false, serumCreatinineMgDl: "", urineOutputMlKgHour: "" } : { ...current, [key]: value });
    setResult(null);
    setFormMessage(null);
    setPatientErrors((current) => ({ ...current, [key]: "" }));
  };

  const updateEvaluationPatient = (key: keyof PatientForm, value: string | boolean) => {
    setEvaluationPatientForm(current => key === "renalDataAvailable" && value === false
      ? { ...current, renalDataAvailable: false, serumCreatinineMgDl: "", urineOutputMlKgHour: "" }
      : { ...current, [key]: value });
    setEvaluationResult(null);
    setEvaluation(null);
    setFormMessage(null);
    setEvaluationPatientErrors(current => ({ ...current, [key]: "" }));
  };
  const resetCase = (mode: "recommendation" | "evaluation") => {
    if (mode === "recommendation") {
      setPatientForm(freshPatient(recommendationHistory.length + 1));
      setPatientErrors({});
      setResult(null);
    } else {
      setEvaluationPatientForm(freshPatient(evaluationHistory.length + 1));
      setEvaluationPatientErrors({});
      setEvaluationForm(initialEvaluationForm);
      setEvaluationErrors({});
      setEvaluationResult(null);
      setEvaluation(null);
      setManualEnabled(false);
    }
    setFormMessage(mode);
  };
  const copyPatientFromRecommendation = () => {
    setEvaluationPatientForm({ ...patientForm });
    setEvaluationPatientErrors({});
    setEvaluationResult(null);
    setEvaluation(null);
    setFormMessage(null);
  };
  const calculate = async () => {
    const candidate = buildPatientInput(patientForm);
    const validated = validatePatientInput(candidate);
    if (!validated.success) {
      setPatientErrors(issuesByField(validated.issues));
      setResult(null);
      const firstField = validated.issues[0]?.field;
      const fieldIds: Record<string, string> = { gestationalAgeWeeks: "ga", gestationalAgeDays: "ga-days", postnatalAgeDays: "pna", currentWeightKg: "weight", serumCreatinineMgDl: "scr", urineOutputMlKgHour: "uop", patientLabel: "patient-label" };
      window.requestAnimationFrame(() => document.getElementById(`rec-${fieldIds[firstField] ?? firstField}`)?.focus());
      return;
    }
    setPatientErrors({});
    setIsCalculating(true);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    try {
      const next = calculateRecommendations(validated.data);
      setResult(next);
      setRecommendationHistory(current => [...current, next]);
      setFormMessage(null);
      window.requestAnimationFrame(() => resultContainerRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
    } finally {
      setIsCalculating(false);
    }
  };

  const runEvaluation = () => {
    const check = validatePatientInput(buildPatientInput(evaluationPatientForm));
    if (!check.success) {
      setEvaluationPatientErrors(issuesByField(check.issues));
      setEvaluationResult(null);
      setEvaluation(null);
      return;
    }
    const calculated = calculateRecommendations(check.data);
    const intervalRequired = [calculated.recommendations.institutionalPrimary, calculated.recommendations.anmf2024]
      .some(r => r.eligibleForRegimenEvaluation && r.interval.kind !== "single-dose-only");
    const actualDose = evaluationForm.actualDoseMg.trim() === "" ? Number.NaN : Number(evaluationForm.actualDoseMg.replace(",", "."));
    const actualHours = evaluationForm.actualIntervalHours.trim() === "" ? null : Number(evaluationForm.actualIntervalHours.replace(",", "."));
    const actualFallback = Number.isFinite(actualDose) && actualDose > 0 ? actualDose : Number.NaN;
    const candidate: RegimenEvaluationInput = {
      actualDoseMg: actualDose,
      actualIntervalHours: actualHours,
      manualDoseMinMg: manualEnabled ? (evaluationForm.manualDoseMinMg.trim() === "" ? Number.NaN : Number(evaluationForm.manualDoseMinMg.replace(",", "."))) : actualFallback,
      manualDoseMaxMg: manualEnabled ? (evaluationForm.manualDoseMaxMg.trim() === "" ? Number.NaN : Number(evaluationForm.manualDoseMaxMg.replace(",", "."))) : actualFallback,
      manualIntervalMinHours: manualEnabled ? (evaluationForm.manualIntervalMinHours.trim() === "" ? null : Number(evaluationForm.manualIntervalMinHours.replace(",", "."))) : actualHours,
      manualIntervalMaxHours: manualEnabled ? (evaluationForm.manualIntervalMaxHours.trim() === "" ? null : Number(evaluationForm.manualIntervalMaxHours.replace(",", "."))) : actualHours,
    };
    const validated = validateRegimenEvaluationInput(candidate, intervalRequired);
    if (!validated.success) {
      setEvaluationErrors(issuesByField(validated.issues));
      setEvaluation(null);
      return;
    }
    const next = evaluateRegimen(calculated, validated.data);
    setEvaluationErrors({});
    setEvaluationPatientErrors({});
    setEvaluationResult(calculated);
    setEvaluation(next);
    setEvaluationHistory(current => [...current, { patient: calculated, evaluation: next }]);
    setFormMessage(null);
  };

  const printReport = () => {
    setGeneratedAt(new Date().toLocaleString("id-ID"));
    window.requestAnimationFrame(() => window.print());
  };
  const downloadRecommendation = () => {
    if (!result) return;
    downloadPdf(buildRecommendationPdf(result), "rekomendasi-neonatus.pdf");
  };
  const downloadEvaluation = () => {
    if (!evaluationResult || !evaluation) return;
    downloadPdf(buildEvaluationPdf(evaluationResult, evaluation, manualEnabled), "evaluasi-neonatus.pdf");
  };

  const renalStatusLabel =
    result?.renalStatus === "data-unavailable"
      ? "Data fungsi ginjal tidak tersedia (diasumsikan normal sesuai usia)"
      : result?.renalStatus === "renal-impairment-criteria-met"
        ? result.input.antibiotic === "vankomisin"
          ? "Kriteria gangguan ginjal UNC untuk vankomisin terpenuhi"
          : "Sinyal kaji ulang fungsi ginjal (kriteria UNC vankomisin; bukan aturan penyesuaian aminoglikosida)"
        : result?.input.antibiotic === "vankomisin"
          ? "Kriteria gangguan ginjal UNC untuk vankomisin tidak terpenuhi dari data yang diberikan"
          : "Tidak ada sinyal berdasarkan kriteria kaji ulang UNC dari data yang diberikan; bukan konfirmasi fungsi ginjal normal";
  const activeIntervalsRequired = evaluationResult
    ? [evaluationResult.recommendations.institutionalPrimary, evaluationResult.recommendations.anmf2024].some(
        (recommendation) =>
          recommendation.eligibleForRegimenEvaluation &&
          recommendation.interval.kind !== "single-dose-only" &&
          recommendation.interval.kind !== "continuous-range",
      )
    : true;

  return (
    <div className="container max-w-7xl pb-16 print-container [&_button]:whitespace-normal">
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

      <ol className="mb-4 grid gap-2 text-sm sm:grid-cols-3 print-hide" aria-label="Alur penggunaan kalkulator">
        <li className={`rounded-xl border p-3 ${tab === "recommendation" ? "border-primary bg-primary/5" : "border-border bg-surface"}`}><span className="font-bold text-primary">01</span><span className="ml-2 font-semibold text-text">Data & rekomendasi</span></li>
        <li className={`rounded-xl border p-3 ${tab === "evaluation" ? "border-primary bg-primary/5" : "border-border bg-surface"}`}><span className="font-bold text-primary">02</span><span className="ml-2 font-semibold text-text">Evaluasi aktual</span></li>
        <li className={`rounded-xl border p-3 ${tab === "batch" ? "border-primary bg-primary/5" : "border-border bg-surface"}`}><span className="font-bold text-primary">03</span><span className="ml-2 font-semibold text-text">Banyak pasien</span></li>
      </ol>

      <div className="mb-6 grid gap-2 rounded-2xl border border-border bg-surface p-1.5 sm:grid-cols-3 print-hide" role="tablist" aria-label="Mode kalkulator">
        <button ref={recommendationTabRef} id="recommendation-tab" type="button" role="tab" tabIndex={tab === "recommendation" ? 0 : -1} aria-selected={tab === "recommendation"} aria-controls="recommendation-panel" onKeyDown={handleTabKeyDown} onClick={() => selectTab("recommendation")} className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === "recommendation" ? "bg-primary text-white" : "text-text-muted hover:bg-surface-2"}`}>Rekomendasi Dosis</button>
        <button ref={evaluationTabRef} id="evaluation-tab" type="button" role="tab" tabIndex={tab === "evaluation" ? 0 : -1} aria-selected={tab === "evaluation"} aria-controls="evaluation-panel" onKeyDown={handleTabKeyDown} onClick={() => selectTab("evaluation")} className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === "evaluation" ? "bg-primary text-white" : "text-text-muted hover:bg-surface-2"}`}>Evaluasi Pemberian</button>
        <button ref={batchTabRef} id="batch-tab" type="button" role="tab" tabIndex={tab === "batch" ? 0 : -1} aria-selected={tab === "batch"} aria-controls="batch-panel" onKeyDown={handleTabKeyDown} onClick={() => selectTab("batch")} className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === "batch" ? "bg-primary text-white" : "text-text-muted hover:bg-surface-2"}`}>Evaluasi Batch</button>
      </div>

      <section id="recommendation-panel" role="tabpanel" aria-labelledby="recommendation-tab" hidden={tab !== "recommendation"} className="print-always">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
          <div className="rounded-2xl border border-border bg-surface p-5 print-hide">
            <h2 className="text-xl font-semibold text-text">Data kasus</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">Semua field klinis hanya berada dalam memori tab ini.</p>
            <div className="mt-5 grid gap-4">
              <PatientCaseFields prefix="rec" form={patientForm} errors={patientErrors} onChange={updatePatient} />
              {formMessage === "recommendation" && <p role="status" className="rounded-lg border border-info/30 bg-info/10 p-3 text-sm text-info">INFORMASI: Formulir siap untuk pasien baru.</p>}
              <Button type="button" variant="outline" onClick={() => resetCase("recommendation")}>Pasien Baru</Button>
              <Button type="button" onClick={() => void calculate()} disabled={isCalculating} className="min-h-12 rounded-xl">{isCalculating ? <LoaderCircle className="animate-spin" size={18} /> : <Calculator size={18} />}{isCalculating ? "Menghitung…" : "Hitung rekomendasi"}</Button>
            </div>
          </div>

          <div ref={resultContainerRef} className="min-w-0 scroll-mt-28">
            {!result ? (
              <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-8 text-center print-hide"><div><FileWarning className="mx-auto text-text-muted" aria-hidden="true" /><h2 className="mt-3 text-xl font-semibold text-text">Belum ada hasil aktif</h2><p className="mt-2 max-w-md text-sm text-text-muted">Isi data kasus dan hitung rekomendasi. Data ginjal yang tidak tersedia memakai asumsi normal sesuai usia dan ditandai dengan peringatan.</p></div></div>
            ) : (
              <div className="space-y-5" aria-live="polite">
                <div className="rounded-2xl border border-border bg-surface p-4 print-break-inside-avoid">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Ringkasan input</p><h2 className="text-xl font-semibold text-text">{ANTIBIOTIC_LABELS[result.input.antibiotic]}{result.input.patientLabel ? ` — ${result.input.patientLabel}` : ""}</h2></div><div className="flex flex-wrap gap-2 print-hide"><Button type="button" variant="outline" onClick={downloadRecommendation}>Unduh PDF Rekomendasi Dosis</Button><Button type="button" variant="outline" onClick={printReport}><Printer size={17} />Cetak</Button></div></div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3"><div><dt className="text-text-muted">GA lahir / PNA / PMA</dt><dd className="font-semibold text-text">{formatNumber(result.input.gestationalAgeWeeks)} minggu {result.input.gestationalAgeDays ?? 0} hari / {result.input.postnatalAgeDays} hari / {result.input.gestationalAgeWeeks + Math.floor(((result.input.gestationalAgeDays ?? 0) + result.input.postnatalAgeDays) / 7)} minggu {((result.input.gestationalAgeDays ?? 0) + result.input.postnatalAgeDays) % 7} hari</dd></div><div><dt className="text-text-muted">Berat</dt><dd className="font-semibold text-text">{formatNumber(result.input.currentWeightKg)} kg</dd></div><div><dt className="text-text-muted">Status data ginjal</dt><dd className="font-semibold text-text">{renalStatusLabel}</dd></div><div><dt className="text-text-muted">SCr / UOP</dt><dd className="font-semibold text-text">{result.input.serumCreatinineMgDl === undefined ? "Tidak tersedia" : `${formatNumber(result.input.serumCreatinineMgDl)} mg/dL`} / {result.input.urineOutputMlKgHour === undefined ? "Tidak tersedia" : `${formatNumber(result.input.urineOutputMlKgHour)} mL/kg/jam`}</dd></div><div className="sm:col-span-2"><dt className="text-text-muted">Konteks klinis</dt><dd className="font-semibold text-text">{[result.input.therapeuticHypothermia && "Hipotermia terapeutik/HIE", result.input.coxInhibitorTherapy && "COX inhibitor", result.input.severeSepsisOrHighRiskInfection && "Sepsis berat/infeksi risiko tinggi"].filter(Boolean).join("; ") || "Tidak ada modifier yang dipilih"}</dd></div></dl>
                  {generatedAt && <p className="mt-3 hidden text-xs text-text-muted print:block">Dibuat lokal: {generatedAt} · Versi aturan: {result.calculatorRuleVersion}</p>}
                </div>
                <SortedWarnings warnings={[...result.globalWarnings, ...result.recommendations.institutionalPrimary.warnings, ...result.recommendations.anmf2024.warnings]} />
                <RecommendationTable calculated={result} />
                <WarningLegend />
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
        {recommendationHistory.length > 0 && <details className="mt-5 rounded-2xl border border-border bg-surface p-4 print-hide">
          <summary className="cursor-pointer font-semibold">Riwayat Rekomendasi Dosis ({recommendationHistory.length})</summary>
          <div className="mt-3 overflow-x-auto"><table className="min-w-[550px] w-full text-left text-sm"><thead><tr><th>Kode pasien</th><th>Antibiotik</th><th>Usia lahir</th><th>Berat</th><th>Dosis RS</th><th>Dosis Literatur</th></tr></thead><tbody>{recommendationHistory.map((entry, index)=><tr key={index} className="border-t border-border"><td className="py-2">{entry.input.patientLabel ?? `Pasien ${index+1}`}</td><td>{ANTIBIOTIC_LABELS[entry.input.antibiotic]}</td><td>{entry.input.gestationalAgeWeeks} minggu {entry.input.gestationalAgeDays ?? 0} hari</td><td>{formatNumber(entry.input.currentWeightKg)} kg</td><td>{formatNumber(entry.recommendations.institutionalPrimary.dose.minTotalMg ?? 0)} mg</td><td>{formatNumber(entry.recommendations.anmf2024.dose.minTotalMg ?? 0)} mg</td></tr>)}</tbody></table></div>
        </details>}
      </section>

      <section id="evaluation-panel" role="tabpanel" aria-labelledby="evaluation-tab" hidden={tab !== "evaluation"} className="print-evaluation">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
          <div className="rounded-2xl border border-border bg-surface p-5 print-hide">
            <h2 className="text-xl font-semibold">Data pasien — Evaluasi Pemberian</h2>
            <p className="mt-1 text-sm text-text-muted">Formulir ini berdiri sendiri. Rekomendasi Dosis tidak perlu dihitung lebih dulu.</p>
            <div className="mt-4 space-y-4">
              <PatientCaseFields prefix="eval" form={evaluationPatientForm} errors={evaluationPatientErrors} onChange={updateEvaluationPatient} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={copyPatientFromRecommendation}>Salin data pasien dari Rekomendasi Dosis</Button>
                <Button type="button" variant="outline" onClick={() => resetCase("evaluation")}>Pasien Baru</Button>
              </div>
              {formMessage === "evaluation" && <p role="status" className="rounded-lg border border-info/30 bg-info/10 p-3 text-sm text-info">INFORMASI: Formulir siap untuk pasien baru.</p>}
              <Field id="eval-actual-dose" type="number" step="0.001" min="0.001" label="Dosis aktual per pemberian (mg)" required value={evaluationForm.actualDoseMg} error={evaluationErrors.actualDoseMg} onChange={v => { setEvaluationForm(p=>({...p, actualDoseMg:v}));setEvaluation(null); }} />
              <Field id="eval-actual-hours" type="number" step="1" min="1" max="96" label="Frekuensi aktual — diberikan setiap ... jam" required={activeIntervalsRequired} value={evaluationForm.actualIntervalHours} error={evaluationErrors.actualIntervalHours} onChange={v => { setEvaluationForm(p=>({...p, actualIntervalHours:v}));setEvaluation(null); }} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-primary" checked={manualEnabled} onChange={e=>{setManualEnabled(e.target.checked);setEvaluation(null);}} />Saya punya hasil hitung manual sebagai pembanding (opsional)</label>
              {manualEnabled && <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
                {([
                  ["manualDoseMinMg", "Dosis manual batas bawah (mg)", "0.001"],
                  ["manualDoseMaxMg", "Dosis manual batas atas (mg)", "0.001"],
                  ["manualIntervalMinHours", "Frekuensi manual paling sering — tiap ... jam", "1"],
                  ["manualIntervalMaxHours", "Frekuensi manual paling jarang — tiap ... jam", "1"],
                ] as const).map(([key,label,step]) => <Field key={key} id={`eval-${key}`} label={label} type="number" min="0.001" step={step} required value={evaluationForm[key]} error={evaluationErrors[key]} onChange={v=>{setEvaluationForm(p=>({...p,[key]:v}));setEvaluation(null);}} />)}
              </div>}
              <Button type="button" className="w-full" onClick={runEvaluation}><CheckCircle2 size={17}/> Evaluasi Pemberian</Button>
            </div>
          </div>
          <div className="space-y-4">
            {!evaluation || !evaluationResult ? <div className="rounded-2xl border border-dashed border-border p-8 text-center text-text-muted">Isi data pasien dan dosis aktual, lalu pilih Evaluasi Pemberian.</div> : <>
              <div className="rounded-2xl border border-border bg-surface p-4"><h2 className="text-lg font-semibold">Evaluasi Pemberian — {ANTIBIOTIC_LABELS[evaluationResult.input.antibiotic]}</h2>
                <p className="mt-2 text-xs text-text-muted">Kode pasien: {evaluationResult.input.patientLabel ?? "Tanpa kode"} · {evaluationResult.input.gestationalAgeWeeks} minggu {evaluationResult.input.gestationalAgeDays ?? 0} hari · {evaluationResult.input.postnatalAgeDays} hari pascalahir</p>
                <div className="mt-3"><WarningLegend /></div>
              </div>
              <Button type="button" variant="outline" onClick={downloadEvaluation}>Unduh PDF Evaluasi Pemberian</Button>
              <SortedWarnings warnings={[...evaluationResult.globalWarnings, ...evaluationResult.recommendations.institutionalPrimary.warnings, ...evaluationResult.recommendations.anmf2024.warnings]} />
              {evaluation.targets.filter(target => target.recommendationId !== evaluationResult.recommendations.institutionalAgeComparator.id).map(target =>
                <EvaluationCard key={target.recommendationId} target={target} showManual={manualEnabled} />
              )}
            </>}
          </div>
        </div>
        {evaluationHistory.length > 0 && <details className="mt-5 rounded-2xl border border-border bg-surface p-4 print-hide">
          <summary className="cursor-pointer font-semibold">Riwayat Evaluasi Pemberian ({evaluationHistory.length})</summary>
          <div className="mt-3 overflow-x-auto"><table className="min-w-[480px] w-full text-left text-sm"><thead><tr><th>Kode pasien</th><th>Antibiotik</th><th>Dosis aktual</th><th>Interval</th><th>Perbandingan RS</th><th>Perbandingan Literatur</th></tr></thead><tbody>{evaluationHistory.map((entry, index)=><tr key={index} className="border-t border-border"><td className="py-2">{entry.patient.input.patientLabel ?? `Pasien ${index+1}`}</td><td>{ANTIBIOTIC_LABELS[entry.patient.input.antibiotic]}</td><td>{formatNumber(entry.evaluation.input.actualDoseMg)} mg</td><td>{entry.evaluation.input.actualIntervalHours ?? "–"} jam</td><td>{entry.evaluation.targets[0]?.actualDose.status}</td><td>{entry.evaluation.targets[2]?.actualDose.status}</td></tr>)}</tbody></table></div>
        </details>}
      </section>

      <section id="batch-panel" role="tabpanel" aria-labelledby="batch-tab" hidden={tab !== "batch"}>
        <BatchCalculator />
      </section>

      <footer className="mt-8 rounded-2xl border border-info/20 bg-info/5 p-4 text-xs leading-relaxed text-text-muted print-always print-break-inside-avoid">
        <div className="flex items-start gap-2"><Info size={16} className="mt-0.5 shrink-0 text-info" aria-hidden="true" /><div><strong className="text-text">Versi aturan {CALCULATOR_RULE_VERSION}.</strong> {CLINICAL_DISCLAIMER} Kalkulator ini belum divalidasi klinis atau regulatoris dan bukan alat medis.</div></div>
      </footer>
    </div>
  );
}
