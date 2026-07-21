-- Compact full-label v3.2 metadata for constrained Neon branches.
-- The complete metadata exports and all source prose stay in the immutable
-- package/object store. Neon contains only the workbench lookup index.

drop table if exists pb_fl32_label_identity_candidates cascade;
drop table if exists pb_fl32_identity_review_queue cascade;
drop table if exists pb_fl32_label_section_manifests cascade;
drop table if exists pb_fl32_drug_label_candidates cascade;
drop table if exists pb_fl32_label_documents cascade;

create table if not exists pb_fl32_import_runs (
  manifest_sha256 text primary key,
  package_version text not null,
  manifest_json jsonb not null,
  status text not null check (status in ('running', 'completed', 'failed')),
  attempt_count integer not null default 1,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text
);

create table if not exists pb_fl32_object_shards (
  shard_number integer primary key check (shard_number between 0 and 15),
  source_file_name text not null unique,
  source_sha256 text not null,
  compressed_size_bytes bigint not null check (compressed_size_bytes > 0),
  object_key text not null unique,
  storage_status text not null default 'pending'
    check (storage_status in ('pending', 'uploading', 'uploaded', 'verified', 'failed')),
  storage_etag text,
  uploaded_at timestamptz,
  verified_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create table pb_fl32_label_documents (
  label_id text primary key,
  spl_document_id text,
  spl_set_id text,
  effective_time text,
  display_names jsonb not null default '[]'::jsonb,
  ingredient_count smallint not null default 0,
  ingredient_fingerprint text not null default '',
  is_latest_set_version boolean not null default false,
  is_human_label boolean not null default false,
  editorial_status text not null check (editorial_status = 'source_only'),
  public_status text not null check (public_status = 'hidden'),
  publication_eligible boolean not null check (publication_eligible = false),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pb_fl32_drug_label_candidates (
  candidate_id text primary key,
  drug_id text not null,
  rxcui text,
  preferred_name text,
  label_id text not null references pb_fl32_label_documents(label_id) on delete cascade,
  match_method text not null,
  identity_confidence real not null,
  identity_match_safe boolean not null check (identity_match_safe = true),
  requires_manual_review boolean not null,
  ranking_score real,
  candidate_rank integer,
  editorial_status text not null check (editorial_status = 'source_only'),
  public_status text not null check (public_status = 'hidden'),
  publication_eligible boolean not null check (publication_eligible = false),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drug_id, label_id)
);

create view pb_fl32_label_identity_candidates as
select candidate_id, label_id, drug_id, rxcui, preferred_name,
  null::text as concept_level, null::text as concept_tty,
  match_method, identity_confidence::double precision as identity_confidence,
  identity_match_safe, null::text as match_reason, requires_manual_review,
  editorial_status, public_status, publication_eligible, imported_at, updated_at
from pb_fl32_drug_label_candidates;

create table pb_fl32_identity_review_queue (
  label_id text primary key references pb_fl32_label_documents(label_id) on delete cascade,
  review_reason text not null,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'in_review', 'resolved', 'rejected')),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pb_fl32_label_section_manifests (
  label_id text primary key references pb_fl32_label_documents(label_id) on delete cascade,
  section_count integer not null,
  clinical_section_count integer not null,
  consumer_otc_section_count integer not null,
  total_source_characters bigint not null,
  section_types jsonb not null,
  object_shard smallint not null references pb_fl32_object_shards(shard_number),
  object_key text not null,
  object_sha256 text,
  object_size_bytes bigint,
  storage_status text not null default 'pending'
    check (storage_status in ('pending', 'uploading', 'uploaded', 'verified', 'failed')),
  storage_etag text,
  uploaded_at timestamptz,
  storage_verified_at timestamptz,
  storage_last_error text,
  editorial_status text not null check (editorial_status = 'source_only'),
  public_status text not null check (public_status = 'hidden'),
  publication_eligible boolean not null check (publication_eligible = false),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pb_fl32_documents_ingredient_idx
  on pb_fl32_label_documents (ingredient_fingerprint) where ingredient_fingerprint <> '';
create index pb_fl32_documents_set_idx
  on pb_fl32_label_documents (spl_set_id) where is_latest_set_version;
create index pb_fl32_drug_candidates_rank_idx
  on pb_fl32_drug_label_candidates (drug_id, candidate_rank);
create index pb_fl32_section_manifest_shard_idx
  on pb_fl32_label_section_manifests (object_shard);
create index pb_fl32_section_manifest_storage_idx
  on pb_fl32_label_section_manifests (storage_status, object_shard);

comment on table pb_fl32_label_documents is
  'Compact hidden lookup index. Complete v3.2 metadata is retained in immutable package/object storage.';
