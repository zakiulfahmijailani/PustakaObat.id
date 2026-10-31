# Neonatal Calculator Known Limitations

Updated 31 October 2026 for rule version `2026.11.01-notebook-v18-parity-draft`.

- The original user-supplied v18 notebook is executed directly in the differential test suite. Its SHA256 is pinned; see [parity evidence](neonatal-notebook-v18-parity.md). Numerical parity does not establish independent clinical, regulatory, or institutional validation.
- Missing renal measurements remain `data-unavailable` in the calculation contract. To reproduce notebook v18, routine calculations use its normal-for-age assumption, explicitly labeled as an **assumption** in the UI, Excel, and PDF. A high-risk missing-data warning is red, otherwise yellow. This assumption is not a measured normal result. Clinical approval of this workflow is still outstanding.
- If renal impairment criteria are met, the institutional vancomycin recommendation is a single dose; its routine frequency is not evaluable. ANMF is still evaluated as in the notebook, with renal/TDM warnings retained.
- The live notebook oracle checks recommendations, warning levels/reasons, batch result cells, category denominators, and statistical outputs. P-values are compared within numerical tolerance, not bit for bit. SciPy is pinned to 1.17.1 because automatic Wilcoxon method selection varies across versions.
- The 34-row acceptance input is the previously transcribed fixture in the repository. The original two acceptance workbooks and official nine-case admin document are not available locally; no claim is made that the original comparator's `Cek` sheet has passed.
- The website keeps its existing explicit validation limits and integer age/interval checks. Notebook behavior outside supported valid inputs (such as permissive rounding of invalid/fractional ages or negative laboratory values) is not reproduced.
- Six-sheet Excel export, exploratory cohort statistics, and downloadable PDF reports run locally in browser memory. They do not upload or store patient data. Histories disappear on reload.
- The PDF contains the active recommendation/evaluation, or cohort summary. Its layout is distinct from the notebook, while the tested numerical results match. Optional manual comparisons appear only when selected.
- Commercial licensed monograph calculations, formulation/concentration/infusion preparation, automated pharmacokinetics, and clinical persistence remain outside scope.
- Source guidelines and institutional protocols require independent review before real-world use. Do not interpret statistical significance as clinical suitability.
- The patient label is a non-identifying case label; users must not enter direct identifiers.
- This remains draft work on the stacked calculator branches. The release criteria in [priority 4 acceptance](neonatal-priority4-acceptance.md) remain applicable; parity testing does not grant release approval.
