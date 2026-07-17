import 'server-only'

import { queryNeon } from '@/lib/neon/server'
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

export async function saveEditorialDraft(drugKey: string, sectionType: string, contentIndonesian: string, actorId: string) {
  const rows = await queryNeon<EditorialDraft>(`
    with saved as (
      insert into public.monograph_editorial_drafts (drug_key, section_type, content_indonesian, authored_by)
      select d.drug_key, $2, $3, $4::uuid
      from public.monograph_staging_drugs d
      where d.drug_key = $1 and d.public_status = 'hidden' and d.publication_eligible = false
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
      select id, drug_key, $4::uuid, case when was_created then 'DRAFT_CREATED' else 'DRAFT_UPDATED' end,
        jsonb_build_object('section_type', section_type, 'version', version, 'status', status, 'publication_eligible', false)
      from saved
    ) select id, drug_key, section_type, content_indonesian, status, version, authored_by,
      submitted_at, reviewed_by, reviewed_at, reviewer_note, publication_eligible, created_at, updated_at from saved
  `, [drugKey, sectionType, contentIndonesian, actorId])
  if (!rows[0]) throw new Error('Draft cannot be edited after submission or approval.')
  return rows[0]
}

export async function submitEditorialDraft(draftId: string, actorId: string) {
  const rows = await queryNeon<EditorialDraft>(`
    with submitted as (
      update public.monograph_editorial_drafts
      set status = 'submitted', submitted_at = now(), publication_eligible = false, updated_at = now()
      where id = $1::uuid and status in ('draft', 'changes_requested') and length(trim(content_indonesian)) >= 40
      returning *
    ), audited as (
      insert into public.monograph_editorial_events (draft_id, drug_key, actor_id, action, metadata)
      select id, drug_key, $2::uuid, 'DRAFT_SUBMITTED', jsonb_build_object('section_type', section_type, 'version', version, 'publication_eligible', false) from submitted
    ) select * from submitted
  `, [draftId, actorId])
  if (!rows[0]) throw new Error('Draft must contain at least 40 characters and be editable before submission.')
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
      returning *
    ), audited as (
      insert into public.monograph_editorial_events (draft_id, drug_key, actor_id, action, metadata)
      select id, drug_key, $4::uuid, $5,
        jsonb_build_object('section_type', section_type, 'version', version, 'note', reviewer_note, 'publication_eligible', false)
      from reviewed
    ) select * from reviewed
  `, [draftId, status, note || '', actorId, action])
  if (!rows[0]) throw new Error('Only another reviewer can review a submitted draft.')
  return rows[0]
}

export async function publishApprovedMonograph(drugKey: string, actorId: string) {
  const rows = await queryNeon<{ drug_id: string; publication_id: string; published_sections: number }>(
    'select * from public.publish_approved_monograph($1, $2::uuid)',
    [drugKey, actorId],
  )
  if (!rows[0]) throw new Error('The approved monograph could not be published.')
  return rows[0]
}
