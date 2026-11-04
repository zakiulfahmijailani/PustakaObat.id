import type { Antibiotic } from "@/lib/neonatal-calculator/types";
import { getV20ReferenceEntries } from "@/lib/neonatal-calculator/reference-block-v20";

/** Rendered in both recommendation and evaluation, including the print tree. */
export function ReferenceBlock({ antibiotic }: { antibiotic: Antibiotic }) {
  const entries = getV20ReferenceEntries(antibiotic);
  return (
    <section aria-label="Rujukan" className="rounded-2xl border border-border bg-surface p-5 text-sm leading-relaxed text-text print:break-inside-auto">
      <h3 className="mb-3 text-lg font-semibold text-text">Rujukan</h3>
      <ul className="list-disc space-y-3 pl-5">
        {entries.map(entry => (
          <li key={entry.label}>
            <strong>{entry.label}:</strong> {entry.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
