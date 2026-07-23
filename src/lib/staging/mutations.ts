import 'server-only'

import { queryNeon } from '@/lib/neon/server'
import { validateEditorialEvidenceBinding } from '@/lib/full-label/editorial-binding'
import type { EditorialDraft } from './types'

export async function selectPilotDrug(drugKey: string, actorId: string) {
  const rows = await queryNeon<{ drug_key: string }>(`
    with selected as (
      update public.monograph_staging_drugs set is_pilot = true, updated_at = now()
      where drug_key = $1 and editorial_status = 'staging' and public_status = 'hidden'
      returning drug_key
    ), audited as (
      insert into public.monograph_editorial_events (drug_key, actor_id, action, metadata)
      select drug_key, $2::uuid, 'PILOT_SELECTED', jsonb_build_object('public_status', 'hidden', 'publication_eligible', false) from selected
    ) select drug_key from selected
  `, [drugKey, actorId])
  if (!rows[0]) throw new Error('Staged drug concept was not found.')
  return rows[0]
}

export async function saveEditorialDraft(drugKey: string, sectionType: string, contentIndonesian: string, sourceLabelId: string, actorId: string) {
  const binding = await validateEditorialEvidenceBinding(drugKey, sectionType, sourceLabelId)
  const rows = await queryNeon<EditorialDraft>(`
    with saved as (
      insert into public.monograph_editorial_drafts (
        drug_key, section_type, content_indonesian, authored_by,
        source_label_id, source_section_types, source_label_effective_time,
        source_binding_method, source_bound_at
      )
      select d.drug_key, $2, $3, $8::uuid, $4, $5::text[], $6, $7, now()
      from public.monograph_staging_drugs d
      where d.drug_key = $1 and d.public_status = 'hidden' and d.publication_eligible = false
      on conflict (drug_key, section_type) do update set
        content_indonesian = excluded.content_indonesian,
        authored_by = excluded.authored_by,
        status = 'draft', version = public.monograph_editorial_drafts.version + 1,
        submitted_at = null, reviewed_by = null, reviewed_at = null, reviewer_note = null,
        source_label_id = excluded.source_label_id,
        source_section_types = excluded.source_section_types,
        source_label_effective_time = excluded.source_label_effective_time,
        source_binding_method = excluded.source_binding_method,
        source_bound_at = now(),
        publication_eligible = false, updated_at = now()
      where public.monograph_editorial_drafts.status in ('draft', 'changes_requested')
      returning *, (xmax = 0) as was_created
    ), audited as (
      insert into public.monograph_editorial_events (draft_id, drug_key, actor_id, action, metadata)
      select id, drug_key, $8::uuid, case when was_created then 'DRAFT_CREATED' else 'DRAFT_UPDATED' end,
        jsonb_build_object('section_type', section_type, 'version', version, 'status', status,
          'source_label_id', source_label_id, 'source_section_types', source_section_types,
          'publication_eligible', false)
      from saved
    ) select id, drug_key, section_type, content_indonesian, status, version, authored_by,
      submitted_at, reviewed_by, reviewed_at, reviewer_note, source_label_id, source_section_types,
      source_label_effective_time, source_binding_method, source_bound_at,
      publication_eligible, created_at, updated_at from saved
  `, [drugKey, sectionType, contentIndonesian, binding.labelId, binding.sectionTypes, binding.effectiveTime, binding.method, actorId])
  if (!rows[0]) throw new Error('Draft cannot be edited after submission or approval.')
  return rows[0]
}

export async function createEditorialDraftFromAiCandidate(drugKey: string, sectionType: string, actorId: string) {
  const rows = await queryNeon<EditorialDraft>(`
    with candidate as (
      select c.drug_key, c.section_type, c.content_indonesian, c.generation_method,
        jsonb_array_length(c.automatic_qc_issues) as automatic_qc_issue_count
      from public.monograph_staging_indonesian_drafts c
      join public.monograph_staging_drugs s on s.drug_key = c.drug_key
      where c.drug_key = $1 and c.section_type = $2
        and c.review_status = 'draft_ai' and c.requires_pharmacist_review = true
        and c.publication_eligible = false and c.is_public = false
        and s.public_status = 'hidden' and s.publication_eligible = false
    ), saved as (
      insert into public.monograph_editorial_drafts (drug_key, section_type, content_indonesian, authored_by)
      select drug_key, section_type, content_indonesian, $3::uuid from candidate
      on conflict (drug_key, section_type) do update set
        content_indonesian = excluded.content_indonesian,
        authored_by = excluded.authored_by,
        status = 'draft', version = public.monograph_editorial_drafts.version + 1,
        submitted_at = null, reviewed_by = null, reviewed_at = null, reviewer_note = null,
        publication_eligible = false, updated_at = now()
      where public.monograph_editorial_drafts.status in ('draft', 'changes_requested')
      returning *, (xmax = 0) as was_created
    ), audited as (
      insert into public.monograph_editorial_events (draft_id, drug_key, actor_id, action, metadata)
      select saved.id, saved.drug_key, $3::uuid,
        case when saved.was_created then 'DRAFT_CREATED' else 'DRAFT_UPDATED' end,
        jsonb_build_object(
          'section_type', saved.section_type,
          'version', saved.version,
          'origin', 'indonesian_ai_candidate',
          'generation_method', candidate.generation_method,
          'automatic_qc_issue_count', candidate.automatic_qc_issue_count,
          'publication_eligible', false
        )
      from saved join candidate using (drug_key, section_type)
    )
    select id, drug_key, section_type, content_indonesian, status, version, authored_by,
      submitted_at, reviewed_by, reviewed_at, reviewer_note, source_label_id, source_section_types,
      source_label_effective_time, source_binding_method, source_bound_at,
      publication_eligible, created_at, updated_at
    from saved
  `, [drugKey, sectionType, actorId])
  if (!rows[0]) throw new Error('Kandidat AI tidak tersedia atau draf tidak dapat ditimpa setelah dikirim untuk review.')
  return rows[0]
}

export async function submitEditorialDraft(draftId: string, actorId: string) {
  const rows = await queryNeon<EditorialDraft>(`
    with submitted as (
      update public.monograph_editorial_drafts
      set status = 'submitted', submitted_at = now(), publication_eligible = false, updated_at = now()
      where id = $1::uuid and status in ('draft', 'changes_requested') and length(trim(content_indonesian)) >= 40
        and source_label_id is not null and cardinality(source_section_types) > 0
      returning *
    ), audited as (
      insert into public.monograph_editorial_events (draft_id, drug_key, actor_id, action, metadata)
      select id, drug_key, $2::uuid, 'DRAFT_SUBMITTED', jsonb_build_object('section_type', section_type, 'version', version, 'publication_eligible', false) from submitted
    ) select * from submitted
  `, [draftId, actorId])
  if (!rows[0]) throw new Error('Draf harus berisi minimal 40 karakter, dapat diedit, dan terikat ke evidence FDA sebelum dikirim.')
  return rows[0]
}

export async function reviewEditorialDraft(draftId: string, decision: 'approve' | 'changes_requested', note: string | null, actorId: string) {
  const status = decision === 'approve' ? 'pharmacist_approved' : 'changes_requested'
  const action = decision === 'approve' ? 'DRAFT_APPROVED' : 'CHANGES_REQUESTED'
  const rows = await queryNeon<EditorialDraft>(`
    with reviewed as (
      update public.monograph_editorial_drafts
      set status = $2, reviewed_by = $4::uuid, reviewed_at = now(), reviewer_note = nullif(trim($3), ''),
          publication_eligible = false, updated_at = now()
      where id = $1::uuid and status = 'submitted' and authored_by is distinct from $4::uuid
        and source_label_id is not null and cardinality(source_section_types) > 0
      returning *
    ), audited as (
      insert into public.monograph_editorial_events (draft_id, drug_key, actor_id, action, metadata)
      select id, drug_key, $4::uuid, $5,
        jsonb_build_object('section_type', section_type, 'version', version, 'note', reviewer_note, 'publication_eligible', false)
      from reviewed
    ) select * from reviewed
  `, [draftId, status, note || '', actorId, action])
  if (!rows[0]) throw new Error('Hanya Reviewer lain yang dapat meninjau draf terkirim yang sudah terikat ke evidence FDA.')
  return rows[0]
}

export async function publishApprovedMonograph(drugKey: string, actorId: string) {
  const unbound = await queryNeon<{ total: number }>(`
    select count(*)::int as total
    from public.monograph_editorial_drafts
    where drug_key = $1 and status = 'pharmacist_approved'
      and (source_label_id is null or cardinality(source_section_types) = 0)
  `, [drugKey])
  if ((unbound[0]?.total || 0) > 0) throw new Error('Masih ada bagian yang disetujui tetapi belum terikat ke evidence FDA. Minta Editor menyimpan ulang dan Reviewer meninjau ulang bagian tersebut.')
  const rows = await queryNeon<{ drug_id: string; publication_id: string; published_sections: number }>(
    'select * from public.publish_approved_monograph($1, $2::uuid)',
    [drugKey, actorId],
  )
  if (!rows[0]) throw new Error('The approved monograph could not be published.')
  return rows[0]
}

export async function publishApprovedSection(draftId: string, actorId: string) {
  const binding = await queryNeon<{ bound: boolean }>(`
    select source_label_id is not null and cardinality(source_section_types) > 0 as bound
    from public.monograph_editorial_drafts
    where id = $1::uuid and status = 'pharmacist_approved'
  `, [draftId])
  if (!binding[0]?.bound) throw new Error('Bagian belum dapat diterbitkan karena belum terikat ke evidence FDA yang telah diverifikasi.')
  const rows = await queryNeon<{ drug_id: string; publication_id: string; public_section_id: string; section_type: string }>(
    'select * from public.publish_approved_section($1::uuid, $2::uuid)',
    [draftId, actorId],
  )
  if (!rows[0]) throw new Error('The approved section could not be published.')
  return rows[0]
}
