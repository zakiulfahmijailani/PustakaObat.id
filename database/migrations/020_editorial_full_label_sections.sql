-- Record only the monograph section names that have a translated FDA source
-- in the selected private bilingual object. No medical prose is stored here.

alter table public.monograph_full_label_availability
  add column if not exists available_section_types text[] not null default '{}'::text[];

comment on column public.monograph_full_label_availability.available_section_types is
  'Private monograph section identifiers derived from translated sections in the selected bilingual FDA object.';
