import * as React from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { buildActualEvaluationSummary } from "@/lib/neonatal-calculator/actual-evaluation-summary";
import { HighlightEvaluationCategory } from "./EvaluationCategoryColor";
import type { CalculatorResult, RegimenEvaluationResult } from "@/lib/neonatal-calculator/types";

export function ActualEvaluationSummary({ calculated, evaluation }: { calculated: CalculatorResult; evaluation: RegimenEvaluationResult }) {
  const summary = buildActualEvaluationSummary(calculated, evaluation.input);
  const tones = {
    critical: "border-error/30 bg-error/10 text-error",
    warning: "border-warning/30 bg-warning/10 text-warning",
    success: "border-primary/30 bg-primary/10 text-primary",
    info: "border-info/30 bg-info/10 text-info",
  };
  const labels = { critical: "PERINGATAN", warning: "PERHATIAN", success: "SESUAI", info: "INFORMASI" };
  const Icon = summary.tone === "success" ? CheckCircle2 : summary.tone === "info" ? Info : AlertTriangle;
  return <section id="actual-evaluation-summary" role="status" aria-live="polite" aria-labelledby="actual-evaluation-summary-title"
    className={`rounded-xl border p-4 text-sm leading-relaxed print-break-inside-avoid ${tones[summary.tone]}`}>
    <div className="flex items-start gap-2">
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <h3 id="actual-evaluation-summary-title" className="font-semibold">{labels[summary.tone]}: {summary.title}</h3>
        <ul className="mt-2 space-y-1.5">
          {summary.items.map(item => <li key={item.label} className="break-words text-text">
            <strong>{item.label}:</strong>{" "}<span><HighlightEvaluationCategory category={item.category} text={item.message} /></span>
          </li>)}
        </ul>
      </div>
    </div>
  </section>;
}
