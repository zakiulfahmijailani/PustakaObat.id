# Neonatal Calculator Production Plan

## Existing architecture findings

- The application is Next.js 15.5 App Router with React 19, strict TypeScript, Tailwind CSS 4, and Vercel deployment in `sin1`.
- The public calculator route is `/kalkulator`; the previous page placed untested clinical thresholds directly in a client component. A second standalone HTML calculator duplicated those unsafe rules under `public/`.
- Supabase Auth/Postgres/RLS are represented by `src/lib/supabase/*` and `supabase/migrations/001_init.sql`. However, `src/middleware.ts` currently bypasses all auth checks and several product paths are static/demo oriented.
- Neon is not used. Supabase is the designated database in the PRD.
- There was no unit-test runner or GitHub Actions workflow. Vitest and a minimal CI workflow are added for the pure domain layer.
- Existing visual conventions use warm neutral surfaces, teal primary color, rounded cards, minimum 44px controls, and Indonesian copy.

## Files and behavior in scope

- Replace `src/app/(public)/kalkulator/page.tsx` and remove the obsolete `public/kalkulator-dosis-antibiotik.html` duplicate.
- Add `src/components/neonatal-calculator/NeonatalCalculator.tsx` for the two-tab neonatal CDS UI and narrowly improve shared mobile navigation accessibility in `src/components/layout/Navbar.tsx`.
- Add a deterministic, React-independent TypeScript domain and tests under `src/lib/neonatal-calculator`.
- Implement input validation, PMA, renal review signals, three independently labeled recommendations, regimen evaluation, qualitative notes, and native browser print-to-PDF.
- Add print styles to `src/app/globals.css`, Vitest configuration/scripts, five production documents, and `.github/workflows/ci.yml`. No unrelated product behavior changes.

## Production scope

- Single-case recommendations for gentamisin, amikasin, and vankomisin.
- Existing-regimen evaluation using total-dose boundaries and explicit interval semantics.
- In-memory-only current calculation and print report.
- Accessible, responsive UI and traceable rule version `2026.07.13-production-2`.

## Deferred scope

- Batch Excel/CSV, bulk export, statistical tests, automatic statistical interpretation, Python/xhtml2pdf, and server-generated reports.
- Clinical audit persistence. This is deferred until authenticated routing is enforced and a dedicated privacy/retention/RLS review is complete.
- Automatic renal dose adjustment for aminoglycosides.

## Supabase / Neon decision

No migration or audit write is added. The public route has no reliable authenticated boundary because middleware explicitly bypasses auth. Storing clinical snapshots now would create an unreviewed health-data store. Neon is absent and will not be introduced or used to duplicate data.

## Test and deployment plan

1. Run install only when dependencies are absent; run lint, strict typecheck, Vitest, and the production build.
2. CI runs the same gates on pushes and pull requests.
3. Run the page locally and check desktop, 375px mobile, keyboard controls, errors, empty state, results, evaluation, print view, URL stability, and browser console.
4. Deploy through the existing Vercel Next.js build without a new runtime, database, or secret.
