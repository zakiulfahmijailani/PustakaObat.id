# Monograph evidence staging v2.2

This workflow imports the private v2.2 handoff into additive Neon staging tables. It does not replace `who_medicines`, `drugs`, or `drug_monograph_sections`, and it never publishes source evidence.

## Private package location

Keep the extracted handoff at `data/imports/website_export/`. The directory and its ZIP are gitignored because `monograph_evidence.jsonl` contains raw source text. Do not move either artifact into `public/` or commit them.

## Exact commands

The scripts read the server-only `DATABASE_URL` from the current process, or from the ignored local `.env.local` when it is not already set.

```powershell
npm run staging:validate
npm run staging:migrate
npm run staging:import
npm run staging:import
npm run staging:verify
```

The first command verifies every SHA-256 from `import_manifest.json`, checks the schema contract and required fields, streams all JSONL records, and reconciles expected counts without database writes. The migration is idempotent. Running the import twice is the operational idempotency check: the second report must show zero inserted/updated rows and all records unchanged.

Expected reconciliation:

- 99 canonical concepts;
- 733 identifiers;
- 303 source documents;
- 375 unreviewed evidence records;
- 99 staging-only search entries;
- 31 editorial candidates;
- 0 public-publishable records.

## Access and editorial workflow

Authenticated reviewers use `/reviewer/staging`; authenticated admins use `/admin/staging`. They can filter staged concepts, inspect section coverage and provenance, select pilot concepts, write original Indonesian drafts, submit them, and record pharmacist decisions. Amoxicillin is initialized as the first pilot.

Raw `source_text` is selected only by the authenticated staging detail query. Public `/obat` routes still query only existing published WHO/public tables. A pharmacist-approved staging draft remains `publication_eligible=false`; publication requires a separate future workflow and is outside this integration.

## Rollback

The migration is additive. To remove only this workflow, first back up any editorial drafts and then apply `database/migrations/006_monograph_staging_v2_2.rollback.sql`. The rollback does not touch WHO data, authentication tables, public drugs, or public monograph sections.
