-- Publish individual pharmacist-approved monograph sections.
-- Source evidence remains private; only the approved Indonesian draft is copied.

alter table public.monograph_editorial_events
  drop constraint if exists monograph_editorial_events_action_check;
alter table public.monograph_editorial_events
  add constraint monograph_editorial_events_action_check check (action in (
    'PILOT_SELECTED', 'DRAFT_CREATED', 'DRAFT_UPDATED',
    'DRAFT_SUBMITTED', 'DRAFT_APPROVED', 'CHANGES_REQUESTED',
    'SECTION_PUBLISHED', 'MONOGRAPH_PUBLISHED'
  ));

create or replace function public.publish_approved_section(
  _draft_id uuid,
  _actor_id uuid
)
returns table (drug_id uuid, publication_id uuid, public_section_id uuid, section_type text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  approved_draft public.monograph_editorial_drafts;
  staged public.monograph_staging_drugs;
  public_drug_id uuid;
  publication uuid;
  section_id uuid;
  public_section_type text;
begin
  if _actor_id is null then
    raise exception 'An administrator is required to publish a section.';
  end if;

  select * into approved_draft
  from public.monograph_editorial_drafts
  where id = _draft_id
    and status = 'pharmacist_approved'
    and reviewed_by is not null
    and reviewed_at is not null
    and reviewed_by is distinct from authored_by
  for update;

  if approved_draft.id is null then
    raise exception 'Only a pharmacist-approved draft can be published.';
  end if;

  select * into staged
  from public.monograph_staging_drugs
  where drug_key = approved_draft.drug_key
    and identity_status = 'validated'
    and core_editorial_candidate = true
  for update;

  if staged.drug_key is null then
    raise exception 'The validated staged drug concept was not found.';
  end if;

  select p.id, p.drug_id into publication, public_drug_id
  from public.monograph_publications p
  where p.drug_key = approved_draft.drug_key
  for update;

  if publication is null then
    insert into public.drugs (
      name, generic_name, brand_names, category, dosage_form, strength,
      status, created_by, updated_by, published_at
    ) values (
      staged.preferred_name, staged.preferred_name, '{}'::text[], null, null, null,
      'published', _actor_id, _actor_id, now()
    ) returning id into public_drug_id;

    insert into public.monograph_publications (
      drug_key, drug_id, published_by, published_section_count
    ) values (
      approved_draft.drug_key, public_drug_id, _actor_id, 1
    ) returning id into publication;

    insert into public.monograph_publication_sources (
      publication_id, source_document_key, source_name, source_document_id,
      source_url, validation_status, usage_scope, retrieved_at
    )
    select publication, s.source_document_key, s.source_name, s.source_document_id,
      s.source_url, s.validation_status, s.usage_scope, s.retrieved_at
    from public.monograph_staging_source_documents s
    where s.drug_key = approved_draft.drug_key
    on conflict (publication_id, source_document_key) do nothing;

    update public.who_medicines
    set drug_id = public_drug_id
    where normalized_name = staged.normalized_name
      and is_active = true
      and publication_status = 'published';
  elsif exists (
    select 1 from public.monograph_publication_sections ps
    where ps.publication_id = publication
      and ps.section_type = approved_draft.section_type
  ) then
    raise exception 'This monograph section has already been published.';
  end if;

  public_section_type := case approved_draft.section_type
    when 'mechanism' then 'mechanism_of_action'
    else approved_draft.section_type
  end;

  insert into public.drug_monograph_sections (
    drug_id, section_type, content, status, generated_by_ai,
    created_by, updated_by, approved_by, approved_at
  ) values (
    public_drug_id, public_section_type::public.section_type,
    approved_draft.content_indonesian, 'published', false,
    approved_draft.authored_by, _actor_id,
    approved_draft.reviewed_by, approved_draft.reviewed_at
  ) returning id into section_id;

  insert into public.monograph_publication_sections (
    publication_id, editorial_draft_id, public_section_id,
    section_type, approved_by, approved_at
  ) values (
    publication, approved_draft.id, section_id,
    approved_draft.section_type, approved_draft.reviewed_by, approved_draft.reviewed_at
  );

  update public.monograph_publications p
  set published_section_count = (
    select count(*)::int
    from public.monograph_publication_sections ps
    where ps.publication_id = publication
  ), updated_at = now()
  where p.id = publication;

  insert into public.monograph_editorial_events (
    draft_id, drug_key, actor_id, action, metadata
  ) values (
    approved_draft.id, approved_draft.drug_key, _actor_id, 'SECTION_PUBLISHED',
    jsonb_build_object(
      'publication_id', publication,
      'drug_id', public_drug_id,
      'public_section_id', section_id,
      'section_type', approved_draft.section_type,
      'source_evidence_remains_hidden', true
    )
  );

  insert into public.audit_logs (
    user_id, action, resource_type, resource_id, metadata
  ) values (
    _actor_id, 'PUBLISH_MONOGRAPH_SECTION', 'drug_monograph_section', section_id,
    jsonb_build_object(
      'drug_key', approved_draft.drug_key,
      'draft_id', approved_draft.id,
      'publication_id', publication,
      'section_type', approved_draft.section_type
    )
  );

  return query select public_drug_id, publication, section_id, approved_draft.section_type;
end;
$$;

comment on function public.publish_approved_section(uuid, uuid) is
  'Publishes one pharmacist-approved Indonesian draft section. Raw evidence remains hidden.';
