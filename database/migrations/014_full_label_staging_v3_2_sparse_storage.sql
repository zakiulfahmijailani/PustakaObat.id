-- Remove materialized queues and per-label storage placeholders. Both are
-- derivable, so materializing them wastes scarce relational storage.

drop table if exists pb_fl32_identity_review_queue cascade;
drop table if exists pb_fl32_label_section_manifests cascade;

create table pb_fl32_identity_review_decisions (
  label_id text primary key references pb_fl32_label_documents(label_id) on delete cascade,
  review_status text not null check (review_status in ('in_review', 'resolved', 'rejected')),
  reviewed_by uuid,
  review_note text,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create view pb_fl32_identity_review_queue as
select d.label_id,
  'No safe exact RxNorm link was accepted.'::text as review_reason,
  coalesce(x.review_status, 'pending'::text) as review_status,
  x.reviewed_by, x.review_note, x.reviewed_at
from pb_fl32_label_documents d
left join pb_fl32_identity_review_decisions x using (label_id)
where not exists (
  select 1 from pb_fl32_drug_label_candidates c where c.label_id=d.label_id
);

create table pb_fl32_label_section_manifests (
  label_id text primary key references pb_fl32_label_documents(label_id) on delete cascade,
  section_count integer not null,
  clinical_section_count integer not null,
  consumer_otc_section_count integer not null,
  total_source_characters bigint not null,
  object_shard smallint not null references pb_fl32_object_shards(shard_number),
  imported_at timestamptz not null default now()
);

create table pb_fl32_label_objects (
  label_id text primary key references pb_fl32_label_section_manifests(label_id) on delete cascade,
  object_key text not null unique,
  object_sha256 text not null,
  object_size_bytes bigint not null,
  storage_status text not null check (storage_status in ('uploaded', 'verified', 'failed')),
  storage_etag text,
  uploaded_at timestamptz not null default now(),
  storage_verified_at timestamptz,
  storage_last_error text,
  updated_at timestamptz not null default now()
);

create index pb_fl32_section_manifest_shard_idx
  on pb_fl32_label_section_manifests (object_shard);
create index pb_fl32_label_objects_status_idx
  on pb_fl32_label_objects (storage_status);

comment on table pb_fl32_label_section_manifests is
  'Compact section counts and shard routing only; full section inventory and prose remain in object storage.';
