import * as React from "react";
import type { Category } from "@/lib/neonatal-calculator/notebook-results";
import type { DoseEvaluation, IntervalEvaluation } from "@/lib/neonatal-calculator/types";

export type VisibleEvaluationCategory = Exclude<Category, "">;

/** Presentation only: identical semantic colors for dose and frequency categories. */
export const EVALUATION_CATEGORY_COLOR = {
  Sesuai: "text-success",
  Berlebih: "text-error",
  Kurang: "text-warning",
} as const satisfies Record<VisibleEvaluationCategory, string>;

function startsWithCategory(text: string, category: VisibleEvaluationCategory): boolean {
  const rest = text.slice(category.length);
  return text.slice(0, category.length).toLocaleLowerCase("id-ID") === category.toLocaleLowerCase("id-ID") &&
    (!rest || /^[\s:;,.()–—-]/.test(rest));
}

/** Do not paint a discrete-option mismatch green just because its message says "Sesuai". */
export function visibleCategoryForStatus(
  status: DoseEvaluation["status"] | IntervalEvaluation["status"],
  message: string,
): VisibleEvaluationCategory | null {
  if (status === "sesuai") return "Sesuai";
  if (status === "berlebih") return "Berlebih";
  if (status === "kurang") return "Kurang";
  if (status === "lebih-pendek" && startsWithCategory(message, "Berlebih")) return "Berlebih";
  if (status === "lebih-panjang" && startsWithCategory(message, "Kurang")) return "Kurang";
  return null;
}

/** Keep the original clinical sentence intact; color only an actual category prefix. */
export function HighlightEvaluationCategory({
  category,
  text,
}: {
  category: VisibleEvaluationCategory | null;
  text: string;
}) {
  if (!category || !startsWithCategory(text, category)) return <>{text}</>;
  return <>
    <strong data-evaluation-category={category} className={EVALUATION_CATEGORY_COLOR[category]}>
      {text.slice(0, category.length)}
    </strong>{text.slice(category.length)}
  </>;
}
