# WHO medicine data on Neon

Apoteq stores its WHO Electronic Essential Medicines List (eEML) and AWaRe catalog in Neon PostgreSQL. WHO status is source information only: it does not mean a medicine is registered by BPOM, approved for sale, or available in Indonesia. The public pages repeat this limitation and do not invent clinical fields missing from the source.

## Source package

The committed import package is located at:

```text
data/imports/who/
|-- manifest.json
|-- raw/
|   |-- who_eeml_medicines.csv
|   `-- who_aware_candidates.csv
`-- processed/
    |-- who_medicine_catalog.csv
    `-- who_medicine_catalog.json
```

The importer reads `processed/who_medicine_catalog.json`, verifies its SHA-256 against `manifest.json`, and never exposes the raw package through `public/`.

## Neon configuration

Copy the pooled connection string from the Neon dashboard and set it only as a server-side environment variable:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
```

Add `DATABASE_URL` to local `.env.local` and to the Vercel project settings. Never prefix it with `NEXT_PUBLIC_` and never commit it.

The runtime uses the official `@neondatabase/serverless` HTTP driver. Public reads are performed in server components, and pharmacist/admin changes go through authenticated server API routes. Browser code never receives the Neon connection string.

## Database migration

Apply [003_who_catalog.sql](../database/migrations/003_who_catalog.sql) to the intended Neon branch. The easiest option is Neon Console -> SQL Editor -> paste the migration -> Run.

If `psql` is installed, the equivalent local command is:

```powershell
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/migrations/003_who_catalog.sql
```

The migration is plain PostgreSQL. It contains no Supabase `auth.uid()`, `anon`, `authenticated`, `service_role`, or Supabase RLS policies. It creates:

- `who_medicines`, with source-controlled fields plus local editorial and verification state;
- `who_medicine_verifications`, an append-only pharmacist review history;
- `who_import_runs`, with inserted, updated, skipped, and failed counts;
- `who_audit_logs`, which records review and admin changes;
- idempotent import, review, and admin-update PostgreSQL functions.

Access control remains in authenticated Next.js server routes. The public query layer always filters for `is_active = true` and `publication_status = 'published'`.

## Validate and import

Validation needs no database connection:

```powershell
npm run who:validate
```

The snapshot currently contains 962 source rows. The parser prepares 960 medicines and quarantines two ambiguous scraper navigation labels (`First choice` and `Second choice`).

After applying the migration and setting `DATABASE_URL`, import with:

```powershell
npm run who:import
```

The import uses stable WHO IDs where available and a deterministic WHO/name key otherwise. Re-running it is idempotent. Source updates do not overwrite `verification_status`, `publication_status`, `is_active`, `editorial_name`, or review history.

## Routes and roles

- Public catalog: `/obat`
- Public detail: `/obat/[slug]`
- Pharmacist review queue: `/dashboard/who`
- Pharmacist review detail/history: `/dashboard/who/[id]`
- Admin WHO management/import history: `/dashboard/admin/who`

The existing authentication provider still establishes the signed-in user and role. Neon is the WHO data store; it is not itself a replacement for an authentication provider unless Neon Auth is configured separately. Pharmacist/admin authorization is checked on the server before any Neon mutation.

Rejected or revision-needed records are hidden from public access while retaining the original WHO source facts and verification history. Admin removal is soft (`hidden` or inactive), not destructive deletion.

## Vercel deployment

1. Add the server-only `DATABASE_URL` in Vercel Project Settings -> Environment Variables.
2. Apply the migration to the same Neon database/branch referenced by that URL.
3. Run `npm run who:import` from a trusted local or CI environment with the same `DATABASE_URL`.
4. Deploy the commit, or redeploy after the variable is added.
5. Open `/obat` and confirm search, filters, detail pages, WHO links, and the BPOM disclaimer.

No database import button is exposed to the browser. Import remains an operator action because it requires privileged database access.

## Attribution and limitation

Use text attribution to the World Health Organization and link to the official record. Do not use the WHO logo without permission. eEML and AWaRe are separate source facts, and neither is presented as BPOM registration.
