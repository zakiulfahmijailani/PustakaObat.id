-- Fast, local readiness index for the Editor queue.
-- The source and translation objects remain private in the full-label database
-- and R2; this table stores only the selected label pointer and readiness facts.

create table if not exists public.monograph_full_label_availability (
  drug_key text primary key references public.monograph_staging_drugs(drug_key) on delete cascade,
  source_label_id text not null,
  translation_import_id uuid not null,
  translated_section_count integer not null check (translated_section_count > 0),
  source_effective_time text,
  match_method text not null check (match_method in ('rxcui', 'exact_single_ingredient_display_name')),
  synced_at timestamptz not null default now()
);

create index if not exists monograph_full_label_availability_import_idx
  on public.monograph_full_label_availability (translation_import_id);

comment on table public.monograph_full_label_availability is
  'Private readiness index used to keep the Editor queue actionable. It contains no FDA prose or AI translation text.';
