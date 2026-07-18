# Neonatal Calculator Known Limitations

- The source notebook has valid-looking static Python but no recorded execution outputs. TypeScript behavior is verified by automated tests, not by treating the notebook as a runtime oracle.
- Supported deterministic notebook rules now use the same executable boundary operators and antibiotic-specific qualitative notes. Production-only safety guards remain explicit: missing renal data are unknown, not normal; discrete interval semantics are preserved; licensed commercial monograph calculations and research/batch tooling remain excluded.
- Code implementation does not imply clinical, regulatory, medical-device, or institutional validation.
- Institutional protocols and formularies can change. Every rule must be independently reviewed against the latest controlled source before real-world use.
- The UNC-derived renal criterion is a vankomisin decision criterion. For gentamisin/amikasin it produces a cautious review warning only; aminoglycoside renal adjustment is not automated.
- Missing renal data never imply normal function. Routine recommendations may still be displayed with a visible missing-data warning and require clinical verification.
- UOP is optional in the supported workflow. When it is absent and the isolated SCr threshold is not met, the SCr/UOP combination cannot be fully assessed; the calculator shows this as incomplete information rather than normal renal function.
- Total doses are calculated arithmetically; formulation, concentration, measurable volume, infusion preparation, compatibility, and administration technique are outside scope.
- The general UNC vankomisin q8–q18 statement is informational and deliberately not treated as a continuous compliance range.
- TDM timing and target notes are support information, not an automated pharmacokinetic service.
- Local `.xlsx` batch evaluation is available for up to 1,000 rows and uses the same deterministic rules as the individual calculator. It is not machine learning, does not infer missing values, and has not received independent clinical or regulator validation.
- Cohort statistics, research interpretation, server-side batch storage, and automatic PDF generation remain deferred. Statistical output would not constitute clinical evidence.
- The current calculation is not persisted. Printing uses the browser's native print dialog and contains only the active in-memory calculation.
- The patient label is a non-identifying case label. The UI cannot technically guarantee that a user will not enter an identifier; users are explicitly instructed not to do so.
- UI unit tests are not yet component-level because the repository had no component testing framework. The domain and threshold logic are independently unit tested; visual behavior is manually QA-tested.
