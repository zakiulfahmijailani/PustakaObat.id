import 'server-only'

import { isNeonConfigured, queryNeon } from '@/lib/neon/server'
import { WHO_PAGE_SIZE } from '@/lib/who/constants'
import type { EditorialDraft, EditorialEvent, IndonesianCandidateDraft, MonographPublication, StagingDrugConcept, StagingEvidence, StagingSourceDocument } from './types'
import { queryFullLabelNeon } from '@/lib/full-label/database'

export interface StagingFilters {
  q?: string
  identity?: string
  candidate?: string
  pilot?: string
  page?: string
}

export interface EditorActionQueueItem extends StagingDrugConcept {
  new_section_count: number
  draft_section_count: number
  revision_section_count: number
  actionable_section_count: number
}

export interface EditorialReviewQueueItem {
  drug_key: string
  preferred_name: string
  identity_status: 'validated' | 'provisional'
  submitted_count: number
  unbound_count: number
  section_types: string[]
  oldest_submitted_at: string
}

export function normalizeStagingSearch(value: string | undefined) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9+./ -]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function getStagedDrugConcepts(filters: StagingFilters) {
  const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1)
  if (!isNeonConfigured()) return { concepts: [] as StagingDrugConcept[], count: 0, page, error: new Error('Neon is not configured.') }
  try {
    const conditions = ["d.editorial_status = 'staging'", "d.public_status = 'hidden'", 'd.publication_eligible = false']
    const parameters: unknown[] = []
    const q = normalizeStagingSearch(filters.q)
    if (q) { parameters.push(`%${q}%`); conditions.push(`(d.normalized_name ilike $${parameters.length} or exists (select 1 from public.monograph_staging_search_index s where s.drug_key = d.drug_key and s.search_text ilike $${parameters.length}))`) }
    if (['validated', 'provisional'].includes(filters.identity || '')) { parameters.push(filters.identity); conditions.push(`d.identity_status = $${parameters.length}`) }
    if (filters.candidate === 'true') conditions.push('d.core_editorial_candidate = true')
    if (filters.candidate === 'false') conditions.push('d.core_editorial_candidate = false')
    if (filters.pilot === 'true') conditions.push('d.is_pilot = true')
    const where = conditions.join(' and ')
    const total = await queryNeon<{ count: string }>(`select count(*)::text count from public.monograph_staging_drugs d where ${where}`, parameters)
    parameters.push(WHO_PAGE_SIZE, (page - 1) * WHO_PAGE_SIZE)
    const concepts = await queryNeon<StagingDrugConcept>(`
      select d.*,
        (select count(*)::int from public.monograph_staging_evidence e where e.drug_key = d.drug_key) evidence_count,
        (select count(*)::int from public.monograph_staging_source_documents s where s.drug_key = d.drug_key) source_count,
        (select count(distinct e.section_type)::int from public.monograph_staging_evidence e where e.drug_key = d.drug_key) covered_section_count
      from public.monograph_staging_drugs d where ${where}
      order by d.is_pilot desc, d.core_editorial_candidate desc, d.preferred_name asc
      limit $${parameters.length - 1} offset $${parameters.length}
    `, parameters)
    return { concepts, count: Number(total[0]?.count || 0), page, error: null }
  } catch (error) {
    return { concepts: [] as StagingDrugConcept[], count: 0, page, error }
  }
}

/** Work an Editor can perform now: unclaimed AI sections or their own editable drafts. */
export async function getEditorActionQueue(filters: StagingFilters, actorId: string) {
  const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1)
  if (!isNeonConfigured()) return { concepts: [] as EditorActionQueueItem[], count: 0, page, error: new Error('Neon is not configured.') }
  try {
    const conditions = [
      "d.editorial_status = 'staging'",
      "d.public_status = 'hidden'",
      'd.publication_eligible = false',
      `(exists (
        select 1 from public.monograph_staging_indonesian_drafts ai
        where ai.drug_key = d.drug_key
          and ai.review_status = 'draft_ai'
          and ai.requires_pharmacist_review = true
          and ai.publication_eligible = false
          and ai.is_public = false
          and not exists (
            select 1 from public.monograph_editorial_drafts claimed
            where claimed.drug_key = ai.drug_key and claimed.section_type = ai.section_type
          )
      ) or exists (
        select 1 from public.monograph_editorial_drafts own
        where own.drug_key = d.drug_key
          and own.authored_by = $1::uuid
          and own.status in ('draft', 'changes_requested')
      ))`,
    ]
    const parameters: unknown[] = [actorId]
    const q = normalizeStagingSearch(filters.q)
    if (q) { parameters.push(`%${q}%`); conditions.push(`(d.normalized_name ilike $${parameters.length} or exists (select 1 from public.monograph_staging_search_index s where s.drug_key = d.drug_key and s.search_text ilike $${parameters.length}))`) }
    const where = conditions.join(' and ')
    const total = await queryNeon<{ count: string }>(`select count(*)::text count from public.monograph_staging_drugs d where ${where}`, parameters)
    parameters.push(WHO_PAGE_SIZE, (page - 1) * WHO_PAGE_SIZE)
    const concepts = await queryNeon<EditorActionQueueItem>(`
      select d.*,
        (select count(distinct ai.section_type)::int
          from public.monograph_staging_indonesian_drafts ai
          where ai.drug_key = d.drug_key
            and ai.review_status = 'draft_ai'
            and ai.requires_pharmacist_review = true
            and ai.publication_eligible = false
            and ai.is_public = false
            and not exists (
              select 1 from public.monograph_editorial_drafts claimed
              where claimed.drug_key = ai.drug_key and claimed.section_type = ai.section_type
            )) as new_section_count,
        (select count(distinct own.section_type)::int
          from public.monograph_editorial_drafts own
          where own.drug_key = d.drug_key and own.authored_by = $1::uuid and own.status = 'draft') as draft_section_count,
        (select count(distinct own.section_type)::int
          from public.monograph_editorial_drafts own
          where own.drug_key = d.drug_key and own.authored_by = $1::uuid and own.status = 'changes_requested') as revision_section_count,
        (select count(*)::int from (
          select ai.section_type
          from public.monograph_staging_indonesian_drafts ai
          where ai.drug_key = d.drug_key
            and ai.review_status = 'draft_ai'
            and ai.requires_pharmacist_review = true
            and ai.publication_eligible = false
            and ai.is_public = false
            and not exists (
              select 1 from public.monograph_editorial_drafts claimed
              where claimed.drug_key = ai.drug_key and claimed.section_type = ai.section_type
            )
          union
          select own.section_type
          from public.monograph_editorial_drafts own
          where own.drug_key = d.drug_key
            and own.authored_by = $1::uuid
            and own.status in ('draft', 'changes_requested')
        ) actionable) as actionable_section_count
      from public.monograph_staging_drugs d
      where ${where}
      order by exists (
          select 1 from public.monograph_editorial_drafts priority
          where priority.drug_key = d.drug_key and priority.authored_by = $1::uuid and priority.status = 'changes_requested'
        ) desc,
        d.is_pilot desc,
        exists (
          select 1 from public.monograph_editorial_drafts progress
          where progress.drug_key = d.drug_key and progress.authored_by = $1::uuid and progress.status = 'draft'
        ) desc,
        d.preferred_name asc
      limit $${parameters.length - 1} offset $${parameters.length}
    `, parameters)
    return { concepts, count: Number(total[0]?.count || 0), page, error: null }
  } catch (error) {
    return { concepts: [] as EditorActionQueueItem[], count: 0, page, error }
  }
}

/** Submitted drafts that this Reviewer is permitted to decide now. */
export async function getEditorialReviewQueue(filters: StagingFilters, actorId: string) {
  const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1)
  if (!isNeonConfigured()) return { items: [] as EditorialReviewQueueItem[], count: 0, page, error: new Error('Neon is not configured.') }
  try {
    const conditions = [
      "s.editorial_status = 'staging'",
      "s.public_status = 'hidden'",
      "draft.status = 'submitted'",
      'draft.authored_by is distinct from $1::uuid',
    ]
    const parameters: unknown[] = [actorId]
    const q = normalizeStagingSearch(filters.q)
    if (q) { parameters.push(`%${q}%`); conditions.push(`(s.normalized_name ilike $${parameters.length} or exists (select 1 from public.monograph_staging_search_index search where search.drug_key = s.drug_key and search.search_text ilike $${parameters.length}))`) }
    const where = conditions.join(' and ')
    const total = await queryNeon<{ count: string }>(`select count(distinct s.drug_key)::text count from public.monograph_staging_drugs s join public.monograph_editorial_drafts draft on draft.drug_key = s.drug_key where ${where}`, parameters)
    parameters.push(WHO_PAGE_SIZE, (page - 1) * WHO_PAGE_SIZE)
    const items = await queryNeon<EditorialReviewQueueItem>(`
      select s.drug_key, s.preferred_name, s.identity_status,
        count(*)::int as submitted_count,
        count(*) filter (where draft.source_label_id is null or cardinality(draft.source_section_types) = 0)::int as unbound_count,
        array_agg(draft.section_type order by draft.submitted_at asc, draft.section_type) as section_types,
        min(draft.submitted_at)::text as oldest_submitted_at
      from public.monograph_staging_drugs s
      join public.monograph_editorial_drafts draft on draft.drug_key = s.drug_key
      where ${where}
      group by s.drug_key, s.preferred_name, s.identity_status
      order by min(draft.submitted_at) asc, s.preferred_name asc
      limit $${parameters.length - 1} offset $${parameters.length}
    `, parameters)
    return { items, count: Number(total[0]?.count || 0), page, error: null }
  } catch (error) {
    return { items: [] as EditorialReviewQueueItem[], count: 0, page, error }
  }
}

export async function getStagedDrugForStaff(drugKey: string) {
  if (!isNeonConfigured()) return { concept: null, evidence: [], sources: [], drafts: [], candidates: [], events: [], publication: null, publishedDraftIds: [] as string[], error: new Error('Neon is not configured.') }
  try {
    const [conceptRows, evidence, sources, drafts, candidates, events, publicationRows, publishedDraftRows] = await Promise.all([
      queryNeon<StagingDrugConcept>("select * from public.monograph_staging_drugs where drug_key = $1 and editorial_status = 'staging' and public_status = 'hidden' limit 1", [drugKey]),
      queryNeon<StagingEvidence>("select evidence_id, drug_key, section_type, source_name, source_document_id, source_section, source_text, source_version, ingredient_match_status, product_specific, license_status, retrieved_at, review_status, publication_eligible from public.monograph_staging_evidence where drug_key = $1 and review_status = 'unreviewed' order by section_type, source_name", [drugKey]),
      queryNeon<StagingSourceDocument>('select source_document_key, drug_key, source_name, source_document_id, source_url, validation_status, usage_scope, retrieved_at from public.monograph_staging_source_documents where drug_key = $1 order by source_name, source_document_id', [drugKey]),
      queryNeon<EditorialDraft>('select * from public.monograph_editorial_drafts where drug_key = $1 order by section_type', [drugKey]),
      queryNeon<IndonesianCandidateDraft>(`select drug_key, section_type, title_indonesian, content_indonesian,
        safety_notes, automatic_qc_issues, generation_method
        from public.monograph_staging_indonesian_drafts
        where drug_key = $1 and review_status = 'draft_ai' and requires_pharmacist_review = true
          and publication_eligible = false and is_public = false
        order by section_type`, [drugKey]),
      queryNeon<EditorialEvent>('select * from public.monograph_editorial_events where drug_key = $1 order by created_at desc limit 100', [drugKey]),
      queryNeon<MonographPublication>('select id, drug_key, drug_id, published_by, published_at, published_section_count from public.monograph_publications where drug_key = $1 limit 1', [drugKey]),
      queryNeon<{ editorial_draft_id: string }>(`select ps.editorial_draft_id
        from public.monograph_publication_sections ps
        join public.monograph_publications p on p.id = ps.publication_id
        where p.drug_key = $1`, [drugKey]),
    ])
    return { concept: conceptRows[0] || null, evidence, sources, drafts, candidates, events, publication: publicationRows[0] || null, publishedDraftIds: publishedDraftRows.map((row) => row.editorial_draft_id), error: null }
  } catch (error) {
    return { concept: null, evidence: [] as StagingEvidence[], sources: [] as StagingSourceDocument[], drafts: [] as EditorialDraft[], candidates: [] as IndonesianCandidateDraft[], events: [] as EditorialEvent[], publication: null, publishedDraftIds: [] as string[], error }
  }
}

/** A private FDA label that has been safely matched to a staged drug concept. */
export interface FullLabelCandidate {
  label_id: string
  preferred_name: string | null
  effective_time: string | null
  ingredient_count: number
  candidate_rank: number | null
  match_method: 'rxcui' | 'exact_single_ingredient_display_name'
}

type FullLabelCandidateRow = Omit<FullLabelCandidate, 'match_method'>

/**
 * Finds private FDA labels for the editorial workbench without treating the
 * result as a canonical identity merge. RxCUI is preferred. A narrowly scoped
 * fallback is permitted only for an exact display-name match on a one-ingredient
 * label, which keeps combinations (for example, abacavir + lamivudine) out of
 * a single-ingredient drug workspace.
 */
export async function getFullLabelCandidates(rxcui: string | null, preferredName: string | null = null) {
  const rxcuiCandidates = rxcui ? await queryFullLabelNeon<FullLabelCandidateRow>(`
      select c.label_id, c.preferred_name, d.effective_time, d.ingredient_count, c.candidate_rank
      from public.pb_fl32_drug_label_candidates c
      join public.pb_fl32_label_documents d using (label_id)
      join public.pb_fl32_label_section_manifests m using (label_id)
      join public.pb_fl32_object_shards s on s.shard_number = m.object_shard
      where c.rxcui = $1
        and s.storage_status in ('uploaded', 'verified')
      order by c.candidate_rank nulls last, d.effective_time desc nulls last
      limit 5
    `, [rxcui]).then((rows) => rows.map((row) => ({ ...row, match_method: 'rxcui' as const }))) : []

  if (rxcuiCandidates.length > 0) return rxcuiCandidates

  const normalizedName = preferredName?.trim()
  if (!normalizedName || normalizedName.length < 3) return [] as FullLabelCandidate[]

  return queryFullLabelNeon<FullLabelCandidateRow>(`
    select
      d.label_id,
      $1::text as preferred_name,
      d.effective_time,
      d.ingredient_count,
      null::integer as candidate_rank,
      'exact_single_ingredient_display_name'::text as match_method
    from public.pb_fl32_label_documents d
    join public.pb_fl32_label_section_manifests m using (label_id)
    join public.pb_fl32_object_shards s on s.shard_number = m.object_shard
    where d.ingredient_count = 1
      and s.storage_status in ('uploaded', 'verified')
      and exists (
        select 1
        from jsonb_array_elements_text(d.display_names) as display_name(value)
        where lower(display_name.value) = lower($1)
      )
    order by d.effective_time desc nulls last
    limit 5
  `, [normalizedName]).then((rows) => rows.map((row) => ({ ...row, match_method: 'exact_single_ingredient_display_name' as const })))
}

export async function getStagedDrugForEditor(drugKey: string, actorId: string) {
  if (!isNeonConfigured()) return { concept: null, drafts: [], candidates: [], error: new Error('Neon is not configured.') }
  try {
    const [conceptRows, drafts, candidates] = await Promise.all([
      queryNeon<StagingDrugConcept>("select * from public.monograph_staging_drugs where drug_key = $1 and editorial_status = 'staging' and public_status = 'hidden' limit 1", [drugKey]),
      queryNeon<EditorialDraft>('select * from public.monograph_editorial_drafts where drug_key = $1 and authored_by = $2::uuid order by section_type', [drugKey, actorId]),
      queryNeon<IndonesianCandidateDraft>(`select drug_key, section_type, title_indonesian, content_indonesian,
        safety_notes, automatic_qc_issues, generation_method
        from public.monograph_staging_indonesian_drafts candidate
        where drug_key = $1 and review_status = 'draft_ai' and requires_pharmacist_review = true
          and publication_eligible = false and is_public = false
          and not exists (
            select 1 from public.monograph_editorial_drafts claimed
            where claimed.drug_key = candidate.drug_key and claimed.section_type = candidate.section_type
          )
        order by section_type`, [drugKey]),
    ])
    return { concept: conceptRows[0] || null, drafts, candidates, error: null }
  } catch (error) {
    return { concept: null, drafts: [] as EditorialDraft[], candidates: [] as IndonesianCandidateDraft[], error }
  }
}
