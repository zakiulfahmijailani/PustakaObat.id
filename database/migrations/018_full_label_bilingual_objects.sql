-- Compact private objects that co-locate the English FDA source and its
-- unreviewed Indonesian AI translation. One label load should require one
-- object read instead of one source object plus many translation-prefix reads.

create table if not exists public.pb_fl32_bilingual_label_objects (
  label_id text not null references public.pb_fl32_label_section_manifests(label_id) on delete cascade,
  translation_import_id uuid not null references public.pb_fl32_translation_imports(import_id) on delete cascade,
  object_sha256 text not null,
  object_size_bytes bigint not null check (object_size_bytes > 0),
  translated_section_count integer not null check (translated_section_count >= 0),
  storage_status text not null check (storage_status in ('uploaded', 'verified', 'failed')),
  storage_etag text,
  uploaded_at timestamptz not null default now(),
  storage_verified_at timestamptz,
  storage_last_error text,
  updated_at timestamptz not null default now(),
  primary key (label_id, translation_import_id)
);

create index if not exists pb_fl32_bilingual_objects_status_idx
  on public.pb_fl32_bilingual_label_objects (translation_import_id, storage_status);

comment on table public.pb_fl32_bilingual_label_objects is
  'Private per-label English + unreviewed Indonesian objects for authenticated editorial reads only.';
