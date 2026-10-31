# Notebook v18 parity verification

Repository: PustakaObat.id. This work concerns the neonatal antibiotic calculator, independently of SIGARA.

## Reference and scope

Original: `kalkulator_dosis_antibiotik_neonatus_v18.ipynb`, copied unchanged to `tests/fixtures/neonatal/notebook-v18.ipynb`.

SHA256: `1ecf1816c585f996e0aa313ec9a50c469330405cd338f1ac286248f230f9a846`.

`scripts/neonatal-notebook-oracle.py` executes original cells 3, 5, 6, 8, 10, 14, and 17. Only package-install shell lines and display output are suppressed. Expected results come from the original Python functions, never from a reimplementation or the TypeScript engine. The notebook's 92 built-in checks execute, including form/widget and batch checks.

Differential coverage:

- 1,242 profiles covering antibiotic, GA/day and PNA boundaries, hypothermia/COX modifiers, SCr and UOP thresholds, and absent renal measurements.
- The existing exact transcribed 34-row acceptance fixture: 30 valid patients and four rejected rows. Every public field and internal research variable is compared with Python.
- 99 additional dose/weight precision cases covering Python decimal rounding and percentage formatting.
- Category counts and denominators for overall/per-antibiotic actual/manual dose/frequency comparisons.
- Per-antibiotic Shapiro/paired t/Wilcoxon statistics and McNemar results against SciPy 1.17.1. Statistical values use absolute tolerances of approximately 1e-6 (p) and 1e-7 (test statistic), rather than bitwise equality.
- Additional constant, all-zero, normal, skewed, tied and untied cohorts, including n=13/14 and n=50/51 method boundaries.

## Corrections

- Dose products round to four decimals before display, as in Python. Exact IEEE-754 decimal formatting uses Python's ties-to-even behavior, including halfway values.
- Signed dose/frequency differences and manual bounds use the notebook's category priority and 1e-6 dose epsilon.
- Missing renal measurements retain unknown status but carry the notebook's explicit normal-for-age calculation assumption; warning priority follows its high-risk rule.
- The workbook has the notebook's 24 public result columns with matching text, units, category details and renal labels.
- Paired dose tests use mg/kg, not total mg. Frequency midpoint is the average of the minimum/maximum doses per day, not the reciprocal of an average interval. Manual categories use both bounds; missing single-dose frequencies stay out of denominators.
- Wilcoxon matches SciPy automatic exact/permutation/asymptotic selection and default lack of continuity correction. McNemar with no discordants has p=1.
- Browser decimal inputs accept commas. Single-column mobile grids, wrapped actions, and contained tables prevent page overflow. PDF paired tests are grouped by antibiotic like the notebook.

## Repeat the checks

From the repository root, install the pinned Python reference dependencies, then run normal project checks:

```powershell
python -m pip install -r tests/fixtures/neonatal/requirements.txt
npm ci
npm test
npm run lint
npm run typecheck
npm run build
npm run start -- --port 3110
```

In a separate terminal with Playwright available:

```powershell
# If Playwright is installed elsewhere, set PLAYWRIGHT_MODULE to its module path.
node scripts/neonatal-browser-parity.cjs
python -m pip install pymupdf
python scripts/neonatal-pdf-parity.py
```

The browser runner accepts `BASE_URL` and `PLAYWRIGHT_MODULE`; both Python runners accept the current interpreter through `PYTHON` where applicable. Chrome is the browser channel. Artifacts and JSON reports are written under `.tmp/neonatal-parity/`; they are local QA output, not committed patient records.

The browser runner checks 30 individual recommendation results, 30 independent evaluations, all 720 cells of the actual downloaded workbook, the 34/30/4 batch totals, PDF downloads with/without manual comparisons, reset/reload behavior, runtime errors, patient-data requests, and 375px mobile page width. The PDF runner checks numeric content and page bounds and renders PNGs for visual inspection.

## Limits and release status

The original acceptance workbooks and nine-case admin instructions are not available locally. Direct Python differential comparison is independently reproducible, but it does not claim that a missing official workbook's `Cek` sheet has run. Validation remains stricter than the notebook on malformed/out-of-range inputs.

This is a numerical/software parity result, not independent clinical validation. The missing-renal assumption requires clinical review under `neonatal-priority4-acceptance.md`. Draft stacked branches are not permission to merge or release. No production release is claimed by these checks.
