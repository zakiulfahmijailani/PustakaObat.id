-- Each editorial draft must retain the private FDA label and label fields the
-- editor used. The referenced label lives in the dedicated full-label database,
-- therefore no cross-database foreign key is possible here.

alter table public.monograph_editorial_drafts
  add column if not exists source_label_id text,
  add column if not exists source_section_types text[] not null default '{}'::text[],
  add column if not exists source_label_effective_time text,
  add column if not exists source_binding_method text,
  add column if not exists source_bound_at timestamptz;

create index if not exists monograph_editorial_drafts_source_label_idx
  on public.monograph_editorial_drafts(source_label_id)
  where source_label_id is not null;

comment on column public.monograph_editorial_drafts.source_label_id is
  'Private openFDA label ID selected by the editor; verified server-side against the full-label candidate index.';
comment on column public.monograph_editorial_drafts.source_section_types is
  'Exact FDA label field names used for this monograph section. Reviewer reads these same fields from the bound label.';
