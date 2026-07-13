# Neonatal Calculator Changelog

## 2026-07-13 — production rule version `2026.07.13-production-2`

### Notebook parity update

- Matched the executable notebook boundaries for gentamisin GA 29/34, amikasin PMA 29/34, and vankomisin PMA 29/36/44.
- Matched the renal combination criterion exactly: SCr >=0.5 mg/dL requires UOP strictly below 1 mL/kg/hour; UOP exactly 1.0 does not meet that branch.
- Replaced generic qualitative references with the notebook's antibiotic-specific WHO, Swiss Society of Neonatology, JAID/JSC, and ACOG/AAP context.
- Added regression coverage at every behavior-changing boundary and bumped the traceable rule version.

### Preserved production safety controls

- Missing renal data remain `data-unavailable` and are never assumed normal.
- Gentamisin q24h OR q48h remains a discrete compliance rule, so q36h is not silently accepted as an in-range institutional interval.
- Licensed commercial monograph calculations, batch/statistical workflows, and Python-generated reports remain excluded from the public production calculator.

### Verification

- `npm run lint` — passed with 0 errors; 8 pre-existing warnings remain in unrelated components.
- `npm run typecheck` — passed.
- `npm test` — 11 files and 97 tests passed.
- `npm run build` — passed; `/kalkulator` remains statically prerendered.

## 2026-07-13 — production rule version `2026.07.13-production-1`

### Files changed

- Replaced `src/app/(public)/kalkulator/page.tsx` and added `src/components/neonatal-calculator/NeonatalCalculator.tsx`.
- Added the pure TypeScript domain and tests under `src/lib/neonatal-calculator/`.
- Added calculator print rules to `src/app/globals.css`.
- Added keyboard-complete tabs and 44px, labeled mobile navigation controls.
- Removed `public/kalkulator-dosis-antibiotik.html` because it duplicated unvalidated, unsafe rules.
- Added Vitest configuration, npm scripts, GitHub Actions CI, and five calculator documents.

### Route and rule coverage

- Public route: `/kalkulator`.
- Covers PMA, renal-data state, gentamisin, amikasin, vankomisin, institutional primary, institutional age comparator, ANMF 2024, actual regimen evaluation, manual-bound comparison, and native print.
- Detailed rule-to-test mapping is in `neonatal-calculator-rule-traceability.md`.

### Production exclusions

- Licensed commercial monograph content is absent from calculation, imports, output, links, and UI.
- Batch files, Excel export, Python PDF, statistical tests, and automatic interpretation are excluded.
- No LLM, remote API, browser scraping, dynamic guideline fetch, or runtime network source is used for calculations.

### Safety decisions

- q24h OR q48h is modeled as a discrete set; q36h is explicitly non-compliant.
- Vankomisin q8–q18 coverage is informational and non-evaluable; PMA/PNA comparator is used for specific interval evaluation.
- Missing renal data are never interpreted as normal.
- Missing UOP is surfaced when the combined renal criterion cannot be fully assessed; it is never inferred as normal.
- The UNC renal criterion controls the vankomisin single-dose path only. Aminoglycosides receive a review warning with no automatic renal adjustment.
- Vankomisin renal criteria produce 10 mg/kg once, no invented routine interval, and a hold-for-level warning.

### Supabase / Neon / Vercel

- No audit table or clinical write was added. Auth middleware currently bypasses checks, so safe clinical persistence is deferred.
- Neon is not used or introduced.
- Vercel remains a standard Next.js build with no new runtime process, Python dependency, or secret.

### Commands and results

- `npm run lint` — passed with 0 errors; 8 pre-existing unused-variable warnings remain in unrelated auth/dashboard/drug components.
- `npm run typecheck` — passed.
- `npm test` — 11 files and 89 tests passed.
- `npm run build` — passed; `/kalkulator` is statically prerendered and uses no new server runtime.
- No formatter command exists in this repository, so no separate formatter was run.

### Known limitations and clinical review

See `neonatal-calculator-known-limitations.md`. Before real-world use, clinical owners must approve every rule, source version, threshold-boundary discrepancy, TDM wording, and renal-data workflow.

### Manual QA checklist

- [x] Desktop calculator and three-card result
- [x] 375px mobile layout, vertically stacked cards, no horizontal overflow, and 44px touch targets
- [x] Keyboard tabs (Arrow Left/Right, Home, End), inputs, details controls, and visible focus styles
- [x] Empty/default and inline validation error states
- [x] q24/q48 discrete evaluation including explicit q36 mismatch
- [x] Vankomisin renal single-dose state, hold-for-level warning, and non-evaluable routine interval
- [x] Browser-native print action, local timestamp, rule version, and print-only current active result/evaluation structure
- [x] No browser console errors during tested flows; URL remained `/kalkulator` without query/hash data
- [x] Source inspection confirmed no calculator storage, analytics, console logging, audit write, or obsolete standalone route
