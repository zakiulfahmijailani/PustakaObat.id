-- Indonesian localization and editorial draft staging.
-- Additive only: no public drug or WHO records are modified.

create table if not exists public.monograph_staging_indonesian_names (
  drug_key text primary key references public.monograph_staging_drugs(drug_key) on delete cascade,
  preferred_name_source text not null,
  preferred_name_indonesian text not null,
  naming_status text not null default 'curated_candidate',
  requires_pharmacist_review boolean not null default true,
  publication_eligible boolean not null default false check (publication_eligible = false),
  is_public boolean not null default false check (is_public = false),
  pipeline_version text not null,
  row_checksum text not null check (row_checksum ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monograph_staging_indonesian_aliases (
  id bigint generated always as identity primary key,
  drug_key text not null references public.monograph_staging_drugs(drug_key) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  language_code text not null,
  alias_type text not null,
  priority integer not null default 50,
  review_status text not null default 'curated_candidate',
  publication_eligible boolean not null default false check (publication_eligible = false),
  is_public boolean not null default false check (is_public = false),
  pipeline_version text not null,
  row_checksum text not null check (row_checksum ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drug_key, normalized_alias, language_code)
);

create index if not exists monograph_staging_indonesian_aliases_lookup_idx
  on public.monograph_staging_indonesian_aliases(normalized_alias, language_code);

create table if not exists public.monograph_staging_indonesian_drafts (
  id bigint generated always as identity primary key,
  drug_key text not null references public.monograph_staging_drugs(drug_key) on delete cascade,
  section_type text not null,
  title_indonesian text not null,
  content_indonesian text not null,
  source_evidence_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(source_evidence_ids) = 'array'),
  missing_information text not null default '',
  safety_notes text not null default '',
  automatic_qc_issues jsonb not null default '[]'::jsonb check (jsonb_typeof(automatic_qc_issues) = 'array'),
  generation_method text not null,
  review_status text not null default 'draft_ai',
  requires_pharmacist_review boolean not null default true,
  publication_eligible boolean not null default false check (publication_eligible = false),
  is_public boolean not null default false check (is_public = false),
  pipeline_version text not null,
  row_checksum text not null check (row_checksum ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drug_key, section_type),
  check (length(trim(content_indonesian)) > 0)
);

create index if not exists monograph_staging_indonesian_drafts_review_idx
  on public.monograph_staging_indonesian_drafts(review_status, drug_key);

drop trigger if exists set_monograph_staging_indonesian_names_updated_at on public.monograph_staging_indonesian_names;
create trigger set_monograph_staging_indonesian_names_updated_at
before update on public.monograph_staging_indonesian_names
for each row execute function public.set_updated_at();

drop trigger if exists set_monograph_staging_indonesian_aliases_updated_at on public.monograph_staging_indonesian_aliases;
create trigger set_monograph_staging_indonesian_aliases_updated_at
before update on public.monograph_staging_indonesian_aliases
for each row execute function public.set_updated_at();

drop trigger if exists set_monograph_staging_indonesian_drafts_updated_at on public.monograph_staging_indonesian_drafts;
create trigger set_monograph_staging_indonesian_drafts_updated_at
before update on public.monograph_staging_indonesian_drafts
for each row execute function public.set_updated_at();
