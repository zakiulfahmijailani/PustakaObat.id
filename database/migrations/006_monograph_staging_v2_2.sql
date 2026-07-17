-- Apoteq monograph evidence staging schema v2.2.
-- Additive and isolated from public.drugs, public.drug_monograph_sections,
-- and public.who_medicines. Nothing in this schema is public-publishable.

create extension if not exists pgcrypto;

create table if not exists public.monograph_staging_import_runs (
  id uuid primary key default gen_random_uuid(),
  manifest_checksum text not null unique,
  pipeline_version text not null,
  generated_at timestamptz not null,
  source_directory text not null,
  status text not null check (status in ('running', 'completed', 'failed')),
  staging_only boolean not null default true check (staging_only = true),
  expected_counts jsonb not null default '{}'::jsonb,
  result_counts jsonb not null default '{}'::jsonb,
  file_checksums jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 1 check (attempt_count > 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (manifest_checksum ~ '^[a-f0-9]{64}$')
);

create table if not exists public.monograph_staging_drugs (
  drug_key text primary key,
  preferred_name text not null,
  normalized_name text not null,
  slug text not null,
  seed_type text not null check (seed_type in ('ingredient', 'combination')),
  ingredient_parts jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredient_parts) = 'array'),
  ingredient_count integer not null check (ingredient_count > 0),
  rxcui text,
  rxnorm_name text,
  rxnorm_tty text,
  match_method text,
  name_similarity numeric,
  rxnorm_validation_status text,
  validation_reason text,
  identity_status text not null check (identity_status in ('validated', 'provisional')),
  seed_id text,
  source_record_id text,
  source_url text,
  record_kind text,
  source_dom_class text,
  section_names jsonb not null default '[]'::jsonb check (jsonb_typeof(section_names) = 'array'),
  formulations jsonb not null default '[]'::jsonb check (jsonb_typeof(formulations) = 'array'),
  indication_names jsonb not null default '[]'::jsonb check (jsonb_typeof(indication_names) = 'array'),
  aware_category text,
  coverage jsonb not null default '{}'::jsonb,
  core_editorial_candidate boolean not null default false,
  is_pilot boolean not null default false,
  editorial_status text not null default 'staging' check (editorial_status = 'staging'),
  public_status text not null default 'hidden' check (public_status = 'hidden'),
  publication_eligible boolean not null default false check (publication_eligible = false),
  bpom_status text not null default 'BPOM_PENDING' check (bpom_status = 'BPOM_PENDING'),
  pipeline_version text not null,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  apoteq_drug_id uuid references public.drugs(id) on delete set null,
  row_checksum text not null check (row_checksum ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (drug_key ~ '^DRUG_[A-Z0-9]+$'),
  check ((seed_type = 'ingredient' and ingredient_count = 1) or seed_type = 'combination')
);

create unique index if not exists monograph_staging_drugs_slug_key
  on public.monograph_staging_drugs(slug);
create index if not exists monograph_staging_drugs_review_queue_idx
  on public.monograph_staging_drugs(identity_status, core_editorial_candidate, preferred_name);
create index if not exists monograph_staging_drugs_pilot_idx
  on public.monograph_staging_drugs(is_pilot) where is_pilot = true;

create table if not exists public.monograph_staging_identifiers (
  id bigint generated always as identity primary key,
  drug_key text not null references public.monograph_staging_drugs(drug_key) on delete cascade,
  identifier_system text not null,
  identifier_value text not null,
  is_primary boolean not null default false,
  validation_status text not null,
  source_created_at timestamptz,
  row_checksum text not null check (row_checksum ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drug_key, identifier_system, identifier_value)
);

create index if not exists monograph_staging_identifiers_drug_idx
  on public.monograph_staging_identifiers(drug_key);

create table if not exists public.monograph_staging_source_documents (
  source_document_key text primary key,
  drug_key text not null references public.monograph_staging_drugs(drug_key) on delete cascade,
  preferred_name text not null,
  source_name text not null,
  source_document_id text not null,
  source_url text,
  validation_status text not null,
  usage_scope text not null,
  retrieved_at timestamptz,
  row_checksum text not null check (row_checksum ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monograph_staging_source_documents_drug_idx
  on public.monograph_staging_source_documents(drug_key, source_name);

create table if not exists public.monograph_staging_evidence (
  evidence_id text primary key,
  drug_key text not null references public.monograph_staging_drugs(drug_key) on delete cascade,
  section_type text not null,
  source_name text not null,
  source_document_id text not null,
  source_set_id text,
  source_section text not null,
  source_text text not null,
  source_version text,
  concept_ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(concept_ingredients) = 'array'),
  label_ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(label_ingredients) = 'array'),
  ingredient_match_status text not null,
  product_specific boolean not null default false,
  license_status text not null,
  retrieved_at timestamptz,
  review_status text not null default 'unreviewed' check (review_status = 'unreviewed'),
  publication_eligible boolean not null default false check (publication_eligible = false),
  pipeline_version text not null,
  row_checksum text not null check (row_checksum ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monograph_staging_evidence_drug_section_idx
  on public.monograph_staging_evidence(drug_key, section_type);
create index if not exists monograph_staging_evidence_unreviewed_idx
  on public.monograph_staging_evidence(review_status, drug_key);

create table if not exists public.monograph_staging_search_index (
  drug_key text primary key references public.monograph_staging_drugs(drug_key) on delete cascade,
  preferred_name text not null,
  slug text not null,
  identity_status text not null,
  search_text text not null,
  market_context_status text not null default 'BPOM_PENDING' check (market_context_status = 'BPOM_PENDING'),
  website_visibility text not null default 'staging_only' check (website_visibility = 'staging_only'),
  public_status text not null default 'hidden' check (public_status = 'hidden'),
  row_checksum text not null check (row_checksum ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monograph_staging_search_text_idx
  on public.monograph_staging_search_index using gin (to_tsvector('simple', search_text));

create table if not exists public.monograph_editorial_drafts (
  id uuid primary key default gen_random_uuid(),
  drug_key text not null references public.monograph_staging_drugs(drug_key) on delete restrict,
  section_type text not null,
  content_indonesian text not null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'changes_requested', 'pharmacist_approved')),
  version integer not null default 1 check (version > 0),
  authored_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  reviewer_note text,
  publication_eligible boolean not null default false check (publication_eligible = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drug_key, section_type),
  check (length(trim(content_indonesian)) > 0)
);

create index if not exists monograph_editorial_drafts_queue_idx
  on public.monograph_editorial_drafts(status, updated_at desc);

create table if not exists public.monograph_editorial_events (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references public.monograph_editorial_drafts(id) on delete set null,
  drug_key text not null references public.monograph_staging_drugs(drug_key) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in (
    'PILOT_SELECTED', 'DRAFT_CREATED', 'DRAFT_UPDATED',
    'DRAFT_SUBMITTED', 'DRAFT_APPROVED', 'CHANGES_REQUESTED'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists monograph_editorial_events_drug_created_idx
  on public.monograph_editorial_events(drug_key, created_at desc);

-- Only imported source tables use automatic updated_at triggers. Editorial
-- mutations set updated_at explicitly so their audit CTEs remain atomic.
drop trigger if exists set_monograph_staging_import_runs_updated_at on public.monograph_staging_import_runs;
create trigger set_monograph_staging_import_runs_updated_at
before update on public.monograph_staging_import_runs
for each row execute function public.set_updated_at();

drop trigger if exists set_monograph_staging_drugs_updated_at on public.monograph_staging_drugs;
create trigger set_monograph_staging_drugs_updated_at
before update on public.monograph_staging_drugs
for each row execute function public.set_updated_at();
