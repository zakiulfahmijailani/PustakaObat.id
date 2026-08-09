-- Private import registry for AI-translated FDA label text.  The translations
-- themselves live in private object storage, keyed by source_text_sha256.
-- Nothing in this table is publishable content.

create table if not exists public.pb_fl32_translation_imports (
  import_id uuid primary key,
  pipeline_version text not null,
  checkpoint_sha256 text not null unique,
  source_text_count integer not null check (source_text_count > 0),
  translation_count integer not null check (translation_count > 0),
  empty_translation_count integer not null default 0 check (empty_translation_count >= 0),
  translated_source_characters bigint not null check (translated_source_characters > 0),
  prefix_length smallint not null check (prefix_length between 2 and 4),
  object_prefix text not null,
  manifest_sha256 text not null,
  status text not null check (status in ('built', 'uploading', 'verified', 'failed')),
  editorial_status text not null default 'ai_translated'
    check (editorial_status = 'ai_translated'),
  public_status text not null default 'hidden'
    check (public_status = 'hidden'),
  publication_eligible boolean not null default false
    check (publication_eligible = false),
  imported_at timestamptz not null default now(),
  verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pb_fl32_translation_imports_active_idx
  on public.pb_fl32_translation_imports (status, imported_at desc)
  where status = 'verified';

comment on table public.pb_fl32_translation_imports is
  'Private object-storage overlays for AI-translated full-label source text. Never public content.';
