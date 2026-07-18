# Batch Evaluation and Statistics Roadmap

## Implemented: local batch evaluation

The public calculator now supports deterministic batch evaluation for `.xlsx` files using the same recommendation and regimen-evaluation engine as the individual calculator.

- One row represents one non-identifying patient/case code.
- The workbook is parsed, validated, calculated, previewed, and exported entirely in the browser.
- The file and calculated results are not uploaded to, logged by, or persisted in Apoteq.
- The current limit is 5 MB and 1,000 candidate rows per workbook.
- Actual dose and interval are evaluated even when the optional manual comparison block is empty or invalid.
- Invalid optional manual ranges are exported as data warnings and do not suppress an otherwise valid actual-regimen evaluation.
- The result workbook separates the summary, successful evaluations, validation errors, and input-data warnings.
- Rule version and clinical warnings are included in the export for traceability.

Batch output remains clinical decision support. It does not perform machine learning, infer missing values, or replace independent clinical review.

## Still deferred: cohort statistics and research interpretation

- Comparing an observed value with the midpoint of a valid clinical range can be misleading.
- A p-value is not clinical significance. Effect size, confidence intervals, missingness, cohort definition, and clinical context must be specified first.
- Multiple comparisons, small samples, distribution assumptions, and paired-data requirements need a prespecified analysis plan.
- Statistical significance must never be presented as clinical appropriateness.

## Required before server-side upload or persistence

The current local-only design intentionally avoids server-side bulk clinical data. Any future storage or shared research workspace requires:

1. Clinical/research governance for cohort fields, endpoints, missing-data handling, and an approved analysis plan.
2. Privacy review for de-identification, authorization, access control, retention, deletion, and export policy.
3. Security design for upload limits, malware/content validation, encryption, isolation, auditability, and incident response.
4. Independent validation and a controlled pilot before public clinical enablement.
