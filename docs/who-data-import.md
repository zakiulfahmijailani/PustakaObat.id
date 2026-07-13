# WHO medicine data in Apoteq

Apoteq imports a snapshot of the WHO Electronic Essential Medicines List (eEML) and the WHO AWaRe antibiotics portal. This source layer is intentionally separate from the existing `drugs` monograph workflow.

WHO status does **not** mean a medicine is registered by BPOM, approved for sale, or available in Indonesia. Public pages repeat this limitation and do not invent dosage, contraindication, interaction, pregnancy, or other clinical fields absent from the source files.

## Source files

The committed import package is located at:

```text
data/import/who/
├── manifest.json
├── raw/
│   ├── who_eeml_medicines.csv
│   └── who_aware_candidates.csv
└── processed/
    ├── who_medicine_catalog.csv
    └── who_medicine_catalog.json
```

The importer reads `processed/who_medicine_catalog.json` and verifies its SHA-256 against `manifest.json`. Raw files are retained for provenance, not loaded by the browser.

## Database migration

Apply [003_who_catalog.sql](../supabase/migrations/003_who_catalog.sql) after the base Supabase migration:

```powershell
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

If the repository is not linked, apply the migration through Supabase SQL Editor. The migration adds:

- `who_medicines`: source-controlled WHO fields plus local editorial override, publication, active, and current verification state;
- `who_medicine_verifications`: append-only pharmacist review history;
- `who_import_runs`: inserted/updated/skipped/failed counts for each run;
- service-role-only idempotent import RPC;
- server-enforced pharmacist/verifier/admin review RPC;
- server-enforced admin update/soft-hide RPC;
- RLS so public users only read active, published records.

The existing Supabase roles remain `pharmacist`, `verifier`, and `admin`. Pharmacists and verifiers can review WHO records; only admins can edit publication metadata or deactivate them.

## Validate and import

Validation is local and performs no database write:

```powershell
npm run who:validate
```

The current snapshot contains 962 source rows. The importer prepares 960 medicines and skips two ambiguous scraper navigation labels (`First choice` and `Second choice`) because they are not medicine names and each contains multiple AWaRe categories.

For an import, set these values only in a trusted local/CI environment:

```text
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Never expose the service-role key through a `NEXT_PUBLIC_` variable or a browser bundle. Then run:

```powershell
npm run who:import
```

The importer uses a stable WHO ID first and a deterministic WHO/name key otherwise. Re-running it does not create duplicates. Unchanged rows are counted as skipped. Source changes update only source-controlled columns; pharmacist verification, publication state, active state, and editorial-name overrides are preserved.

## Review and administration

- Public catalog: `/obat`
- Public detail: `/obat/[slug]`
- Staff review queue: `/dashboard/who`
- Staff review detail and history: `/dashboard/who/[id]`
- Admin WHO management and import history: `/dashboard/admin/who`
- Local monograph creation: `/dashboard/obat/new`

Rejected or revision-needed records are hidden from public access but retain the original WHO status and full review history. Admin edits use `editorial_name`; the source name remains auditable.

## Re-import and rollback

Re-run `npm run who:import` for a new validated snapshot. The service-role import is atomic.

There is no destructive batch rollback. To withdraw an imported record, an admin sets it to `hidden` or inactive in `/dashboard/admin/who`. For a whole batch, use the `dataset_checksum` shown in `who_import_runs` to identify records through `last_import_checksum`, review the affected rows, and soft-hide them. Do not hard-delete verification history.

## Vercel deployment

Vercel requires only the existing public Supabase variables for runtime pages:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Do not add `SUPABASE_SERVICE_ROLE_KEY` to client-visible Vercel variables. Apply the migration and run the data import before or immediately after deploying the application commit. The application does not expose a web import button because importing with a service-role credential is intentionally an operator-only action.

## Attribution

Use text attribution to the World Health Organization and link to the official record. Do not use the WHO logo without permission. eEML and AWaRe are displayed as distinct source facts, and neither is presented as BPOM registration.
