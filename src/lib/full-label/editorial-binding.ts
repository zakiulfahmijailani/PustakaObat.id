import 'server-only'

import { queryNeon } from '@/lib/neon/server'
import { getFullLabelCandidates } from '@/lib/staging/queries'
import { fdaSectionTypesForMonographSection } from './section-mapping'
import { queryFullLabelNeon } from './database'
import { readBilingualLabelObject } from './storage'

export interface EditorialEvidenceBinding {
  labelId: string
  sectionTypes: string[]
  effectiveTime: string | null
  method: string
}

/**
 * Validates an editor-selected source without trusting a client-provided field
 * list. The label must be a safe candidate for the staged drug and must contain
 * an FDA field mapped to the requested monograph section.
 */
export async function validateEditorialEvidenceBinding(
  drugKey: string,
  monographSectionType: string,
  selectedLabelId: string,
): Promise<EditorialEvidenceBinding> {
  const allowedFieldTypes = fdaSectionTypesForMonographSection(monographSectionType)
  if (!allowedFieldTypes.length) throw new Error('Bagian monografi belum memiliki pemetaan evidence FDA.')

  const concepts = await queryNeon<{ rxcui: string | null, preferred_name: string | null }>(`
    select rxcui, preferred_name
    from public.monograph_staging_drugs
    where drug_key = $1 and editorial_status = 'staging' and public_status = 'hidden'
    limit 1
  `, [drugKey])
  const concept = concepts[0]
  if (!concept) throw new Error('Konsep obat staging tidak ditemukan.')

  const candidates = await getFullLabelCandidates(concept.rxcui, concept.preferred_name)
  const candidate = candidates.find((item) => item.label_id === selectedLabelId)
  if (!candidate) throw new Error('Label FDA tidak merupakan kandidat aman untuk obat ini.')

  const manifests = await queryFullLabelNeon<{
    effective_time: string | null
    section_count: number
    translation_import_id: string
    manifest_sha256: string
  }>(`
    with latest_overlay as (
      select import_id, manifest_sha256
      from public.pb_fl32_translation_imports
      where status='verified' and editorial_status='ai_translated'
        and public_status='hidden' and publication_eligible=false
      order by verified_at desc nulls last, imported_at desc limit 1
    )
    select d.effective_time, m.section_count,
      imports.import_id::text as translation_import_id, imports.manifest_sha256
    from public.pb_fl32_label_documents d
    join public.pb_fl32_label_section_manifests m using (label_id)
    join public.pb_fl32_object_shards s on s.shard_number = m.object_shard
    join public.pb_fl32_label_objects o using (label_id)
    cross join latest_overlay imports
    join public.pb_fl32_bilingual_label_objects bilingual
      on bilingual.label_id=d.label_id and bilingual.translation_import_id=imports.import_id
    where d.label_id = $1 and s.storage_status in ('uploaded', 'verified')
      and o.storage_status='verified' and bilingual.storage_status='verified'
      and bilingual.translated_section_count > 0
    limit 1
  `, [selectedLabelId])
  const manifest = manifests[0]
  if (!manifest) throw new Error('Metadata label FDA belum tersedia.')

  const sections = await readBilingualLabelObject(
    selectedLabelId,
    manifest.section_count,
    manifest.translation_import_id,
    manifest.manifest_sha256,
  )
  const available = new Set(sections.map((section) => section.section_type))
  const sectionTypes = allowedFieldTypes.filter((field) => available.has(field))
  if (!sectionTypes.length) {
    throw new Error('Label FDA yang dipilih tidak memiliki seksi sumber untuk bagian monografi ini. Pilih label lain atau bagian lain.')
  }

  return {
    labelId: selectedLabelId,
    sectionTypes,
    effectiveTime: manifest.effective_time,
    method: candidate.match_method,
  }
}
