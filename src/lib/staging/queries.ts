import 'server-only'

import { isNeonConfigured, queryNeon } from '@/lib/neon/server'
import { WHO_PAGE_SIZE } from '@/lib/who/constants'
import type { EditorialDraft, EditorialEvent, MonographPublication, StagingDrugConcept, StagingEvidence, StagingSourceDocument } from './types'

export interface StagingFilters {
  q?: string
  identity?: string
  candidate?: string
  pilot?: string
  page?: string
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

export async function getStagedDrugForStaff(drugKey: string) {
  if (!isNeonConfigured()) return { concept: null, evidence: [], sources: [], drafts: [], events: [], publication: null, error: new Error('Neon is not configured.') }
  try {
    const [conceptRows, evidence, sources, drafts, events, publicationRows] = await Promise.all([
      queryNeon<StagingDrugConcept>("select * from public.monograph_staging_drugs where drug_key = $1 and editorial_status = 'staging' and public_status = 'hidden' limit 1", [drugKey]),
      queryNeon<StagingEvidence>("select evidence_id, drug_key, section_type, source_name, source_document_id, source_section, source_text, source_version, ingredient_match_status, product_specific, license_status, retrieved_at, review_status, publication_eligible from public.monograph_staging_evidence where drug_key = $1 and review_status = 'unreviewed' order by section_type, source_name", [drugKey]),
      queryNeon<StagingSourceDocument>('select source_document_key, drug_key, source_name, source_document_id, source_url, validation_status, usage_scope, retrieved_at from public.monograph_staging_source_documents where drug_key = $1 order by source_name, source_document_id', [drugKey]),
      queryNeon<EditorialDraft>('select * from public.monograph_editorial_drafts where drug_key = $1 order by section_type', [drugKey]),
      queryNeon<EditorialEvent>('select * from public.monograph_editorial_events where drug_key = $1 order by created_at desc limit 100', [drugKey]),
      queryNeon<MonographPublication>('select id, drug_key, drug_id, published_by, published_at, published_section_count from public.monograph_publications where drug_key = $1 limit 1', [drugKey]),
    ])
    return { concept: conceptRows[0] || null, evidence, sources, drafts, events, publication: publicationRows[0] || null, error: null }
  } catch (error) {
    return { concept: null, evidence: [] as StagingEvidence[], sources: [] as StagingSourceDocument[], drafts: [] as EditorialDraft[], events: [] as EditorialEvent[], publication: null, error }
  }
}
