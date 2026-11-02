import { categoryText, categorizeRange, frequencyResult, intervalBounds, type Category } from "./notebook-results";
import type { CalculatorResult, RegimenEvaluationInput } from "./types";

export type ActualEvaluationSummary = {
  tone: "critical" | "warning" | "success" | "info";
  title: string;
  items: { label: string; category: Exclude<Category, ""> | null; message: string }[];
};

/** Present the four actual comparisons from v19's _ringkasan_evaluasi. */
export function buildActualEvaluationSummary(
  calculated: CalculatorResult,
  input: Pick<RegimenEvaluationInput, "actualDoseMg" | "actualIntervalHours">,
): ActualEvaluationSummary {
  const items: ActualEvaluationSummary["items"] = [];
  for (const [name, rec] of [
    ["Pedoman RS", calculated.recommendations.institutionalPrimary],
    ["Literatur Terkini", calculated.recommendations.anmf2024],
  ] as const) {
    const dose = categorizeRange(input.actualDoseMg, input.actualDoseMg, rec.dose.minTotalMg, rec.dose.maxTotalMg);
    items.push({ label: "Dosis aktual vs " + name, category: dose.category || null,
      message: dose.category ? categoryText(dose) : "Tidak dapat dibandingkan (rujukan tidak menetapkan dosis numerik)." });
    const [lower, upper] = intervalBounds(rec.interval);
    const frequency = frequencyResult(input.actualIntervalHours, input.actualIntervalHours, lower, upper);
    const discreteMismatch = rec.interval.kind === "discrete" && input.actualIntervalHours !== null
      && frequency.category === "Sesuai" && !rec.interval.allowedHours.includes(input.actualIntervalHours);
    items.push({ label: "Frekuensi aktual vs " + name, category: discreteMismatch ? null : frequency.category || null,
      message: discreteMismatch ? "Tidak sesuai opsi interval yang tersedia."
        : frequency.category ? categoryText(frequency) : input.actualIntervalHours === null
        ? "Tidak dapat dibandingkan (interval aktual tidak diisi)."
        : "Tidak dapat dibandingkan (rujukan tidak menetapkan interval rutin)." });
  }
  const excess = items.some(item => item.category === "Berlebih");
  const deficit = items.some(item => item.category === "Kurang");
  if (excess && deficit) return { tone: "critical", title: "Pemberian aktual tidak sesuai rujukan (BERLEBIH dan KURANG)", items };
  if (excess) return { tone: "critical", title: "Pemberian aktual BERLEBIH dibanding rujukan", items };
  if (deficit) return { tone: "warning", title: "Pemberian aktual KURANG dibanding rujukan", items };
  if (items.some(item => item.category === null)) return { tone: "info", title: "Pemberian aktual belum dapat dinilai sepenuhnya", items };
  return { tone: "success", title: "Dosis dan frekuensi aktual sesuai dengan rujukan", items };
}
