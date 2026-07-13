# Batch and Statistics Roadmap

Batch and statistical features are intentionally not part of the first production pass.

## Why they are deferred

- They require a separate clinical-methodology review. Comparing an observed value with the midpoint of a valid clinical range can be misleading.
- A p-value is not clinical significance. Effect size, confidence intervals, missingness, cohort definition, and clinical context must be specified first.
- Multiple comparisons, small samples, distribution assumptions, and paired-data requirements need a prespecified analysis plan.
- Uploads materially increase privacy and security risk. Bulk patient data need a dedicated authorization, retention, deletion, encryption, malware/file-validation, and incident-response design.
- Bulk output can amplify a rule error across many patients, so release governance must be stronger than for an interactive one-case CDS.

## Proposed future phases

1. Clinical/research governance defines approved cohort fields, endpoints, missing-data handling, and statistical plan.
2. Privacy review defines de-identification, access control, retention, and export policy.
3. Security design defines upload limits, parsers, content validation, isolation, and auditability.
4. A separate research module is implemented with explicit versioning and fixtures; it must never label statistical significance as clinical appropriateness.
5. Independent validation and controlled pilot occur before public enablement.

No placeholder upload or statistics buttons are exposed in the production UI.
