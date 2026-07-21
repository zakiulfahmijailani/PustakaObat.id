-- Object keys are deterministic from label_id, so do not store and index the
-- same long key 260,717 times.

drop table if exists pb_fl32_label_objects;

create table pb_fl32_label_objects (
  label_id text primary key references pb_fl32_label_section_manifests(label_id) on delete cascade,
  object_sha256 text not null,
  object_size_bytes bigint not null,
  storage_status text not null check (storage_status in ('uploaded', 'verified', 'failed')),
  storage_etag text,
  uploaded_at timestamptz not null default now(),
  storage_verified_at timestamptz,
  storage_last_error text,
  updated_at timestamptz not null default now()
);

create index pb_fl32_label_objects_status_idx
  on pb_fl32_label_objects (storage_status);
