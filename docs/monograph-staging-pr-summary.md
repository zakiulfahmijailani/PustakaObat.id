# PR summary — monograph staging export v2.2

## What changed

- Adds isolated Neon tables for canonical concepts, identifiers, provenance, raw evidence, staging search aliases, import runs, original Indonesian drafts, and append-only editorial events.
- Adds a streaming, checksum-gated, transaction-based, idempotent Node importer with dry-run and reconciliation reporting.
- Adds reviewer/admin-only staging queues and drug detail workspaces, starting with amoxicillin as the pilot.
- Adds executable validation for package integrity, public-query isolation, hidden/non-publishable state, combination identity, WHO preservation, and database counts.

## Safeguards

All imported concepts are `editorial_status=staging`, `public_status=hidden`, and `publication_eligible=false`. Evidence is fixed to `review_status=unreviewed` and cannot become publication-eligible in its source table. Staging aliases are never read by public search. Raw source files are gitignored and raw `source_text` is queried only after reviewer/admin authentication. No public monograph is created or updated.

## Reconciliation

Expected after import: 99 concepts, 733 identifiers, 303 source documents, 375 evidence records, 99 search entries, 31 editorial candidates, and zero public-publishable records. The importer records manifest/file checksums, timestamps, attempts, result counts, and failures.

## Rollback

Apply `database/migrations/006_monograph_staging_v2_2.rollback.sql` after backing up editorial drafts. It drops only the new monograph staging/editorial tables and leaves WHO, auth, reviewer approval, public drugs, and public monograph sections unchanged.
