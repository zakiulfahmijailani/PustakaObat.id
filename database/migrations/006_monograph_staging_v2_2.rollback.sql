-- Explicit rollback for 006_monograph_staging_v2_2.sql.
-- This removes staging/editorial data only. Existing WHO and public drug data
-- are not touched. Back up editorial drafts before running in any environment.

begin;
drop table if exists public.monograph_editorial_events;
drop table if exists public.monograph_editorial_drafts;
drop table if exists public.monograph_staging_search_index;
drop table if exists public.monograph_staging_evidence;
drop table if exists public.monograph_staging_source_documents;
drop table if exists public.monograph_staging_identifiers;
drop table if exists public.monograph_staging_drugs;
drop table if exists public.monograph_staging_import_runs;
commit;
