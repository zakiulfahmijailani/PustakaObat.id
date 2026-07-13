-- =========================================================
-- apoteq - 003_who_catalog.sql
-- WHO eEML/AWaRe catalog, auditable import, and review workflow
-- =========================================================

create table public.who_medicines (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  external_id text,
  medicine_name text not null,
  editorial_name text,
  normalized_name text not null,
  slug text not null unique,
  source_name text not null default 'WHO' check (source_name = 'WHO'),
  source_version text not null,
  official_source_url text,
  is_who_eeml boolean not null default false,
  aware_category text
    check (aware_category in ('Access', 'Watch', 'Reserve', 'Not recommended')),
  is_monitoring_only boolean not null default false,
  is_not_on_eml boolean not null default false,
  data_status text not null
    check (data_status in ('WHO_ONLY', 'WHO_AND_AWARE', 'AWARE_ONLY')),
  import_status text not null default 'ready',
  source_retrieved_at timestamptz,
  source_generated_at timestamptz not null,
  source_payload jsonb not null default '{}'::jsonb,
  payload_checksum text not null,
  last_import_checksum text not null,
  publication_status text not null default 'published'
    check (publication_status in ('published', 'hidden')),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'needs_revision')),
  is_active boolean not null default true,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  manually_edited_at timestamptz,
  drug_id uuid references public.drugs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(source_key)) > 0),
  check (length(trim(medicine_name)) > 0),
  check (editorial_name is null or length(trim(editorial_name)) > 0),
  check (length(trim(normalized_name)) > 0),
  check (length(trim(slug)) > 0),
  check (payload_checksum ~ '^[a-f0-9]{64}$'),
  check (last_import_checksum ~ '^[a-f0-9]{64}$')
);

create unique index idx_who_medicines_external_id
  on public.who_medicines(external_id)
  where external_id is not null;
create index idx_who_medicines_normalized_name on public.who_medicines(normalized_name);
create index idx_who_medicines_aware_category on public.who_medicines(aware_category)
  where aware_category is not null;
create index idx_who_medicines_public_listing
  on public.who_medicines(is_active, publication_status, medicine_name);
create index idx_who_medicines_verification_status on public.who_medicines(verification_status);
create index idx_who_medicines_drug_id on public.who_medicines(drug_id)
  where drug_id is not null;

create trigger set_who_medicines_updated_at
before update on public.who_medicines
for each row execute function public.set_updated_at();

create table public.who_medicine_verifications (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.who_medicines(id) on delete cascade,
  previous_status text not null
    check (previous_status in ('pending', 'verified', 'rejected', 'needs_revision')),
  status text not null
    check (status in ('verified', 'rejected', 'needs_revision')),
  note text,
  verified_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (status = 'verified' or length(trim(coalesce(note, ''))) > 0)
);

create index idx_who_verifications_medicine_created
  on public.who_medicine_verifications(medicine_id, created_at desc);
create index idx_who_verifications_user
  on public.who_medicine_verifications(verified_by, created_at desc);

create table public.who_import_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null default 'WHO' check (source_name = 'WHO'),
  source_version text not null,
  source_file text not null,
  manifest_hash text not null,
  dataset_checksum text not null,
  schema_version text not null,
  record_count integer not null check (record_count >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  status text not null check (status in ('completed', 'failed')),
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  error_message text,
  imported_at timestamptz not null default now(),
  check (manifest_hash ~ '^[a-f0-9]{64}$'),
  check (dataset_checksum ~ '^[a-f0-9]{64}$')
);

create index idx_who_import_runs_imported_at on public.who_import_runs(imported_at desc);

alter table public.who_medicines enable row level security;
alter table public.who_medicine_verifications enable row level security;
alter table public.who_import_runs enable row level security;

create policy "who_medicines_public_read_published"
on public.who_medicines for select to anon, authenticated
using (is_active = true and publication_status = 'published');

create policy "who_medicines_staff_read_all"
on public.who_medicines for select to authenticated
using (public.has_role(array['pharmacist', 'verifier', 'admin']));

create policy "who_medicines_admin_update"
on public.who_medicines for update to authenticated
using (public.has_role(array['admin']))
with check (public.has_role(array['admin']));

create policy "who_verifications_staff_read"
on public.who_medicine_verifications for select to authenticated
using (public.has_role(array['pharmacist', 'verifier', 'admin']));

create policy "who_import_runs_admin_read"
on public.who_import_runs for select to authenticated
using (public.has_role(array['admin']));

create or replace function public.import_who_catalog(
  _dataset_checksum text,
  _manifest_hash text,
  _schema_version text,
  _source_version text,
  _source_file text,
  _generated_at timestamptz,
  _started_at timestamptz,
  _skipped_count integer,
  _failed_count integer,
  _records jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  total_count integer := jsonb_array_length(_records);
  inserted_count integer := 0;
  updated_count integer := 0;
  unchanged_count integer := 0;
begin
  if _dataset_checksum !~ '^[a-f0-9]{64}$' or _manifest_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid WHO checksum';
  end if;
  if _schema_version <> '1.0.0' then
    raise exception 'Unsupported WHO catalog schema version: %', _schema_version;
  end if;
  if jsonb_typeof(_records) <> 'array' or total_count = 0 then
    raise exception 'WHO records must be a non-empty JSON array';
  end if;
  if exists (
    select 1 from jsonb_array_elements(_records) record
    where coalesce(trim(record ->> 'source_key'), '') = ''
       or coalesce(trim(record ->> 'medicine_name'), '') = ''
       or coalesce(trim(record ->> 'normalized_name'), '') = ''
       or coalesce(trim(record ->> 'slug'), '') = ''
  ) then
    raise exception 'WHO records contain missing required values';
  end if;

  with incoming as (
    select source_key, payload_checksum
    from jsonb_to_recordset(_records) as record(source_key text, payload_checksum text)
  )
  select
    count(*) filter (where existing.id is null),
    count(*) filter (where existing.id is not null and existing.payload_checksum is distinct from incoming.payload_checksum),
    count(*) filter (where existing.id is not null and existing.payload_checksum = incoming.payload_checksum)
  into inserted_count, updated_count, unchanged_count
  from incoming
  left join public.who_medicines existing using (source_key);

  insert into public.who_medicines (
    source_key, external_id, medicine_name, normalized_name, slug,
    source_name, source_version, official_source_url, is_who_eeml,
    aware_category, is_monitoring_only, is_not_on_eml, data_status,
    import_status, source_retrieved_at, source_generated_at, source_payload,
    payload_checksum, last_import_checksum
  )
  select
    record.source_key, nullif(record.external_id, ''), record.medicine_name,
    record.normalized_name, record.slug, 'WHO', _source_version,
    nullif(record.official_source_url, ''), record.is_who_eeml,
    nullif(record.aware_category, ''), coalesce(record.is_monitoring_only, false),
    coalesce(record.is_not_on_eml, false), record.data_status,
    coalesce(nullif(record.import_status, ''), 'ready'), record.source_retrieved_at,
    _generated_at, coalesce(record.source_payload, '{}'::jsonb),
    record.payload_checksum, _dataset_checksum
  from jsonb_to_recordset(_records) as record(
    source_key text, external_id text, medicine_name text, normalized_name text,
    slug text, official_source_url text, is_who_eeml boolean, aware_category text,
    is_monitoring_only boolean, is_not_on_eml boolean, data_status text,
    import_status text, source_retrieved_at timestamptz, source_payload jsonb,
    payload_checksum text
  )
  on conflict (source_key) do update set
    external_id = excluded.external_id,
    medicine_name = excluded.medicine_name,
    normalized_name = excluded.normalized_name,
    slug = excluded.slug,
    source_version = excluded.source_version,
    official_source_url = excluded.official_source_url,
    is_who_eeml = excluded.is_who_eeml,
    aware_category = excluded.aware_category,
    is_monitoring_only = excluded.is_monitoring_only,
    is_not_on_eml = excluded.is_not_on_eml,
    data_status = excluded.data_status,
    import_status = excluded.import_status,
    source_retrieved_at = excluded.source_retrieved_at,
    source_generated_at = excluded.source_generated_at,
    source_payload = excluded.source_payload,
    payload_checksum = excluded.payload_checksum,
    last_import_checksum = excluded.last_import_checksum
  where public.who_medicines.payload_checksum is distinct from excluded.payload_checksum;

  insert into public.who_import_runs (
    source_version, source_file, manifest_hash, dataset_checksum, schema_version,
    record_count, inserted_count, updated_count, skipped_count, failed_count,
    status, started_at, completed_at
  ) values (
    _source_version, _source_file, _manifest_hash, _dataset_checksum, _schema_version,
    total_count, inserted_count, updated_count, coalesce(_skipped_count, 0),
    coalesce(_failed_count, 0), 'completed', _started_at, now()
  );

  return jsonb_build_object(
    'records', total_count,
    'inserted', inserted_count,
    'updated', updated_count,
    'skipped', unchanged_count + coalesce(_skipped_count, 0),
    'failed', coalesce(_failed_count, 0),
    'dataset_checksum', _dataset_checksum
  );
end;
$$;

revoke all on function public.import_who_catalog(text, text, text, text, text, timestamptz, timestamptz, integer, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.import_who_catalog(text, text, text, text, text, timestamptz, timestamptz, integer, integer, jsonb)
  to service_role;

create or replace function public.review_who_medicine(
  _record_id uuid,
  _decision text,
  _note text default null
)
returns public.who_medicines
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  previous_status text;
  reviewed_record public.who_medicines;
begin
  if not public.has_role(array['pharmacist', 'verifier', 'admin']) then
    raise exception 'Only active pharmacy staff can review WHO records';
  end if;
  if _decision not in ('verified', 'rejected', 'needs_revision') then
    raise exception 'Unsupported WHO review decision';
  end if;
  if _decision <> 'verified' and coalesce(trim(_note), '') = '' then
    raise exception 'A review note is required for rejection or revision';
  end if;

  select verification_status into previous_status
  from public.who_medicines where id = _record_id for update;
  if previous_status is null then
    raise exception 'WHO medicine record not found';
  end if;

  update public.who_medicines
  set verification_status = _decision,
      publication_status = case when _decision = 'verified' then 'published' else 'hidden' end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = _record_id
  returning * into reviewed_record;

  insert into public.who_medicine_verifications (
    medicine_id, previous_status, status, note, verified_by
  ) values (_record_id, previous_status, _decision, nullif(trim(_note), ''), auth.uid());

  insert into public.audit_logs (user_id, action, resource_type, resource_id, metadata)
  values (
    auth.uid(), 'REVIEW_WHO_MEDICINE', 'who_medicine', _record_id,
    jsonb_build_object('previous_status', previous_status, 'decision', _decision, 'note', _note)
  );
  return reviewed_record;
end;
$$;

revoke all on function public.review_who_medicine(uuid, text, text) from public, anon;
grant execute on function public.review_who_medicine(uuid, text, text) to authenticated;

create or replace function public.admin_update_who_medicine(
  _record_id uuid,
  _editorial_name text,
  _publication_status text,
  _is_active boolean
)
returns public.who_medicines
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  previous_record public.who_medicines;
  updated_record public.who_medicines;
begin
  if not public.has_role(array['admin']) then
    raise exception 'Only an active admin can manage WHO records';
  end if;
  if _publication_status not in ('published', 'hidden') then
    raise exception 'Invalid publication status';
  end if;

  select * into previous_record from public.who_medicines where id = _record_id for update;
  if previous_record.id is null then
    raise exception 'WHO medicine record not found';
  end if;

  update public.who_medicines
  set editorial_name = nullif(trim(_editorial_name), ''),
      publication_status = _publication_status,
      is_active = _is_active,
      manually_edited_at = now()
  where id = _record_id
  returning * into updated_record;

  insert into public.audit_logs (user_id, action, resource_type, resource_id, metadata)
  values (
    auth.uid(), 'UPDATE_WHO_MEDICINE', 'who_medicine', _record_id,
    jsonb_build_object(
      'before', jsonb_build_object('editorial_name', previous_record.editorial_name, 'publication_status', previous_record.publication_status, 'is_active', previous_record.is_active),
      'after', jsonb_build_object('editorial_name', updated_record.editorial_name, 'publication_status', updated_record.publication_status, 'is_active', updated_record.is_active)
    )
  );
  return updated_record;
end;
$$;

revoke all on function public.admin_update_who_medicine(uuid, text, text, boolean) from public, anon;
grant execute on function public.admin_update_who_medicine(uuid, text, text, boolean) to authenticated;

-- Complete the existing local-monograph admin workflow without changing its model.
create policy "drugs_admin_insert"
on public.drugs for insert to authenticated
with check (public.has_role(array['admin']) and submitted_by = auth.uid());

create policy "drug_sections_admin_insert"
on public.drug_monograph_sections for insert to authenticated
with check (public.has_role(array['admin']));
