import * as React from "react";
import type { DoseEvaluation, IntervalEvaluation } from "@/lib/neonatal-calculator/types";
import { EVALUATION_CATEGORY_COLOR, HighlightEvaluationCategory, visibleCategoryForStatus } from "./EvaluationCategoryColor";

type EvaluationStatus = DoseEvaluation["status"] | IntervalEvaluation["status"];

export function categoryDisplayParts(status: EvaluationStatus, message: string) {
  const words = status.replaceAll("-", " ");
  const label = words.charAt(0).toLocaleUpperCase("id-ID") + words.slice(1);
  const text = message.trim();
  const next = text.charAt(label.length);
  // v20 writes the classification only once: "Berlebih (+0,3 mg; +1,4%)",
  // never "Berlebih — Berlebih (+0,3 mg; +1,4%)".
  const repeated = text.slice(0, label.length).toLocaleLowerCase("id-ID") === label.toLocaleLowerCase("id-ID") &&
    (!next || /[\s:;,.()–—-]/.test(next));
  const detail = repeated ? text.slice(label.length).trimStart() : text;
  const separator = !detail ? "" : repeated ? (/^[,;:.!?]/.test(detail) ? "" : " ") : " — ";
  return { label, detail, separator };
}

/** Purely presentational; never changes the evaluation or notebook category. */
export function EvaluationStatusText({ status, message }: { status: EvaluationStatus; message: string }) {
  const {label, detail, separator} = categoryDisplayParts(status, message);
  const category = visibleCategoryForStatus(status, message);
  const labelCategory = category && label === category ? category : null;
  return <>
    <strong data-evaluation-category={labelCategory ?? undefined} className={labelCategory ? EVALUATION_CATEGORY_COLOR[labelCategory] : "text-text"}>{label}</strong>
    {detail ? <>{separator}<HighlightEvaluationCategory category={labelCategory ? null : category} text={detail} /></> : null}
  </>;
}
