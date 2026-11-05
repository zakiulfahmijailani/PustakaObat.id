import * as React from "react";
import type { CalculatorResult, RegimenEvaluationResult } from "@/lib/neonatal-calculator/types";
import { v20RenalText, v20ActualDoseText } from "@/lib/neonatal-calculator/notebook-results";

/** Uses the same frozen v20 renal summary formatter as the batch export. */
export function RenalStatusSummary({ calculated }: { calculated: CalculatorResult }) {
  return (
    <section aria-label="Ringkasan fungsi ginjal" className="mt-3 rounded-xl border border-border bg-surface-2 p-3 text-sm">
      <h3 className="font-semibold text-text">Fungsi ginjal</h3>
      <p className="mt-1 leading-relaxed text-text-muted">{v20RenalText(calculated)}</p>
    </section>
  );
}

/** Presentation only: actual mg ÷ patient weight for the mg/kg equivalent. */
export function ActualAdministeredDoseSummary({
  calculated, evaluation,
}: { calculated: CalculatorResult; evaluation: RegimenEvaluationResult }) {
  return (
    <section aria-label="Ringkasan dosis aktual" className="mt-3 rounded-xl border border-border bg-surface-2 p-3 text-sm">
      <h3 className="font-semibold text-text">Dosis aktual yang diberikan</h3>
      <dl className="mt-1">
        <div>
          <dt className="text-text-muted">Dosis per pemberian (mg dan mg/kg)</dt>
          <dd className="font-semibold text-text">
            {v20ActualDoseText(evaluation.input.actualDoseMg, calculated.input.currentWeightKg)}
            {evaluation.input.actualIntervalHours === null
              ? ", interval aktual tidak diisi."
              : `, diberikan tiap ${evaluation.input.actualIntervalHours} jam.`}
          </dd>
        </div>
      </dl>
    </section>
  );
}
