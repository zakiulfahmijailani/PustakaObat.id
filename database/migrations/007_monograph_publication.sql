-- Publish pharmacist-approved Indonesian monographs without exposing staging
-- evidence. This migration is additive: source records remain hidden and
-- immutable as public content.

do $$
declare
  value text;
begin
  if exists (select 1 from pg_type where typname = 'section_type') then
    foreach value in array array[
      'drug_interactions', 'pregnancy', 'specific_populations',
      'clinical_pharmacology', 'pharmacokinetics', 'how_supplied'
    ] loop
      if not exists (
        select 1
        from pg_enum e join pg_type t on t.oid = e.enumtypid
        where t.typname = 'section_type' and e.enumlabel = value
      ) then
        execute format('alter type public.section_type add value %L', value);
      end if;
    end loop;
  end if;
end
$$;

create table if not exists public.monograph_publications (
  id uuid primary key default gen_random_uuid(),
  drug_key text not null unique references public.monograph_staging_drugs(drug_key) on delete restrict,
  drug_id uuid not null unique references public.drugs(id) on delete restrict,
  published_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz not null default now(),
  published_section_count integer not null check (published_section_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monograph_publications_drug_idx
  on public.monograph_publications(drug_id);

create table if not exists public.monograph_publication_sections (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.monograph_publications(id) on delete cascade,
  editorial_draft_id uuid not null unique references public.monograph_editorial_drafts(id) on delete restrict,
  public_section_id uuid not null unique references public.drug_monograph_sections(id) on delete restrict,
  section_type text not null,
  approved_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null,
  published_at timestamptz not null default now(),
  unique (publication_id, section_type)
);

create table if not exists public.monograph_publication_sources (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.monograph_publications(id) on delete cascade,
  source_document_key text not null,
  source_name text not null,
  source_document_id text not null,
  source_url text,
  validation_status text not null,
  usage_scope text not null,
  retrieved_at timestamptz,
  unique (publication_id, source_document_key)
);

create index if not exists monograph_publication_sources_publication_idx
  on public.monograph_publication_sources(publication_id, source_name);

drop trigger if exists set_monograph_publications_updated_at on public.monograph_publications;
create trigger set_monograph_publications_updated_at
before update on public.monograph_publications
for each row execute function public.set_updated_at();

alter table public.monograph_editorial_events
  drop constraint if exists monograph_editorial_events_action_check;
alter table public.monograph_editorial_events
  add constraint monograph_editorial_events_action_check check (action in (
    'PILOT_SELECTED', 'DRAFT_CREATED', 'DRAFT_UPDATED',
    'DRAFT_SUBMITTED', 'DRAFT_APPROVED', 'CHANGES_REQUESTED',
    'MONOGRAPH_PUBLISHED'
  ));

create or replace function public.publish_approved_monograph(
  _drug_key text,
  _actor_id uuid
)
returns table (drug_id uuid, publication_id uuid, published_sections integer)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  staged public.monograph_staging_drugs;
  public_drug public.drugs;
  publication uuid;
  draft record;
  section_id uuid;
  required_sections text[] := array['indication', 'dosage', 'side_effects', 'contraindication', 'warnings'];
  missing_sections text[];
  section_count integer;
begin
  if _actor_id is null then
    raise exception 'A reviewer is required to publish a monograph.';
  end if;

  select * into staged
  from public.monograph_staging_drugs
  where drug_key = _drug_key
    and editorial_status = 'staging'
    and public_status = 'hidden'
    and publication_eligible = false
  for update;

  if staged.drug_key is null then
    raise exception 'Staged drug concept was not found.';
  end if;
  if staged.identity_status <> 'validated' or not staged.core_editorial_candidate then
    raise exception 'Only validated editorial candidates can be published.';
  end if;
  if exists (select 1 from public.monograph_publications where drug_key = _drug_key) then
    raise exception 'This monograph has already been published. Create and review a new revision before republishing.';
  end if;

  select array_agg(required.section_type order by required.section_type)
  into missing_sections
  from unnest(required_sections) as required(section_type)
  where not exists (
    select 1
    from public.monograph_editorial_drafts d
    where d.drug_key = _drug_key
      and d.section_type = required.section_type
      and d.status = 'pharmacist_approved'
      and d.reviewed_by is not null
      and d.reviewed_at is not null
      and d.reviewed_by is distinct from d.authored_by
  );
  if missing_sections is not null then
    raise exception 'Publication requires pharmacist approval for: %.', array_to_string(missing_sections, ', ');
  end if;

  select count(*)::int into section_count
  from public.monograph_editorial_drafts d
  where d.drug_key = _drug_key
    and d.status = 'pharmacist_approved'
    and d.reviewed_by is not null
    and d.reviewed_at is not null
    and d.reviewed_by is distinct from d.authored_by;

  insert into public.drugs (
    name, generic_name, brand_names, category, dosage_form, strength,
    status, created_by, updated_by, published_at
  ) values (
    staged.preferred_name, staged.preferred_name, '{}'::text[], null, null, null,
    'published', _actor_id, _actor_id, now()
  ) returning * into public_drug;

  insert into public.monograph_publications (
    drug_key, drug_id, published_by, published_section_count
  ) values (
    _drug_key, public_drug.id, _actor_id, section_count
  ) returning id into publication;

  for draft in
    select *
    from public.monograph_editorial_drafts
    where drug_key = _drug_key
      and status = 'pharmacist_approved'
      and reviewed_by is not null
      and reviewed_at is not null
      and reviewed_by is distinct from authored_by
    order by section_type
  loop
    insert into public.drug_monograph_sections (
      drug_id, section_type, content, status, generated_by_ai,
      created_by, updated_by, approved_by, approved_at
    ) values (
      public_drug.id, draft.section_type::public.section_type,
      draft.content_indonesian, 'published', false,
      draft.authored_by, _actor_id, draft.reviewed_by, draft.reviewed_at
    ) returning id into section_id;

    insert into public.monograph_publication_sections (
      publication_id, editorial_draft_id, public_section_id,
      section_type, approved_by, approved_at
    ) values (
      publication, draft.id, section_id,
      draft.section_type, draft.reviewed_by, draft.reviewed_at
    );
  end loop;

  insert into public.monograph_publication_sources (
    publication_id, source_document_key, source_name, source_document_id,
    source_url, validation_status, usage_scope, retrieved_at
  )
  select publication, s.source_document_key, s.source_name, s.source_document_id,
    s.source_url, s.validation_status, s.usage_scope, s.retrieved_at
  from public.monograph_staging_source_documents s
  where s.drug_key = _drug_key
  on conflict (publication_id, source_document_key) do nothing;

  update public.who_medicines
  set drug_id = public_drug.id
  where normalized_name = staged.normalized_name
    and is_active = true
    and publication_status = 'published';

  insert into public.monograph_editorial_events (
    drug_key, actor_id, action, metadata
  ) values (
    _drug_key, _actor_id, 'MONOGRAPH_PUBLISHED',
    jsonb_build_object(
      'publication_id', publication,
      'drug_id', public_drug.id,
      'published_section_count', section_count,
      'source_evidence_remains_hidden', true
    )
  );

  insert into public.audit_logs (
    user_id, action, resource_type, resource_id, metadata
  ) values (
    _actor_id, 'PUBLISH_MONOGRAPH', 'drug', public_drug.id,
    jsonb_build_object('drug_key', _drug_key, 'publication_id', publication, 'published_section_count', section_count)
  );

  return query select public_drug.id, publication, section_count;
end;
$$;

comment on function public.publish_approved_monograph(text, uuid) is
  'Publishes only approved original Indonesian drafts. Raw staging evidence remains hidden.';
