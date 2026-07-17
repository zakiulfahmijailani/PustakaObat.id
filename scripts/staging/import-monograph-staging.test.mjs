import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sha256, validateDataset, verifyPackage } from './import-monograph-staging.mjs'

const temporaryDirectories = []

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'apoteq-staging-'))
  temporaryDirectories.push(directory)
  const amoxicillin = { drug_id: 'DRUG_AMOX', preferred_name: 'Amoxicillin', normalized_name: 'amoxicillin', slug: 'amoxicillin', seed_type: 'ingredient', ingredient_parts: '["amoxicillin"]', ingredient_count: 1, identity_status: 'validated', editorial_status: 'staging', public_status: 'hidden', raw_evidence_publishable: false, pipeline_version: '2.2.0', section_names: '[]', formulations: '[]', indication_names: '[]' }
  const combination = { drug_id: 'DRUG_AMOXCLAV', preferred_name: 'Amoxicillin + clavulanic acid', normalized_name: 'amoxicillin + clavulanic acid', slug: 'amoxicillin-clavulanic-acid', seed_type: 'combination', ingredient_parts: '["amoxicillin","clavulanic acid"]', ingredient_count: 2, identity_status: 'provisional', editorial_status: 'staging', public_status: 'hidden', raw_evidence_publishable: false, pipeline_version: '2.2.0', section_names: '[]', formulations: '[]', indication_names: '[]' }
  const files = {
    'drugs.jsonl': `${JSON.stringify(amoxicillin)}\n${JSON.stringify(combination)}\n`,
    'drug_identifiers.jsonl': `${JSON.stringify({ drug_id: 'DRUG_AMOX', identifier_system: 'APOTEQ', identifier_value: 'DRUG_AMOX', validation_status: 'validated' })}\n${JSON.stringify({ drug_id: 'DRUG_AMOXCLAV', identifier_system: 'APOTEQ', identifier_value: 'DRUG_AMOXCLAV', validation_status: 'validated' })}\n`,
    'drug_source_documents.jsonl': `${JSON.stringify({ source_document_key: 'WHO:1', drug_id: 'DRUG_AMOX', preferred_name: 'Amoxicillin', source_name: 'WHO', source_document_id: '1', validation_status: 'validated', usage_scope: 'seed' })}\n${JSON.stringify({ source_document_key: 'WHO:2', drug_id: 'DRUG_AMOXCLAV', preferred_name: 'Amoxicillin + clavulanic acid', source_name: 'WHO', source_document_id: '2', validation_status: 'validated', usage_scope: 'seed' })}\n`,
    'monograph_evidence.jsonl': `${JSON.stringify({ evidence_id: 'EVID_1', drug_id: 'DRUG_AMOX', section_type: 'indication', source_name: 'source', source_document_id: '1', source_section: 'indications', source_text: 'private evidence text', concept_ingredients: '["amoxicillin"]', label_ingredients: '["amoxicillin"]', ingredient_match_status: 'accepted', license_status: 'review_required', review_status: 'unreviewed', publication_eligible: false, pipeline_version: '2.2.0' })}\n`,
    'drug_search_index.jsonl': `${JSON.stringify({ drug_id: 'DRUG_AMOX', preferred_name: 'Amoxicillin', slug: 'amoxicillin', identity_status: 'validated', public_status: 'hidden', search_text: 'amoxicillin', market_context_status: 'BPOM_PENDING', website_visibility: 'staging_only' })}\n${JSON.stringify({ drug_id: 'DRUG_AMOXCLAV', preferred_name: 'Amoxicillin + clavulanic acid', slug: 'amoxicillin-clavulanic-acid', identity_status: 'provisional', public_status: 'hidden', search_text: 'amoxicillin clavulanic acid', market_context_status: 'BPOM_PENDING', website_visibility: 'staging_only' })}\n`,
    'core_coverage_report.csv': 'drug_id,preferred_name,core_editorial_candidate,public_publishable\nDRUG_AMOX,Amoxicillin,True,False\nDRUG_AMOXCLAV,Amoxicillin + clavulanic acid,False,False\n',
    'README_CODEX.md': 'staging only\n',
    'schema_contract.json': JSON.stringify({ pipeline_version: '2.2.0', publication_rule: 'public publication requires pharmacist-reviewed original Indonesian monograph sections', staging_only: true, primary_keys: { 'drugs.jsonl': ['drug_id'], 'drug_identifiers.jsonl': ['drug_id', 'identifier_system', 'identifier_value'], 'drug_source_documents.jsonl': ['source_document_key'], 'monograph_evidence.jsonl': ['evidence_id'], 'drug_search_index.jsonl': ['drug_id'] } }),
  }
  for (const [name, content] of Object.entries(files)) await writeFile(join(directory, name), content)
  const manifest = { pipeline_version: '2.2.0', generated_at: new Date().toISOString(), staging_only: true, qc_summary: { fatal_total: 0, qc_passed: true }, record_counts: { drugs: 2, identifiers: 2, source_documents: 2, evidence: 1, search_index: 2, editorial_candidates: 1, public_publishable: 0 }, files: Object.entries(files).map(([file, content]) => ({ file, sha256: sha256(Buffer.from(content)), size_bytes: Buffer.byteLength(content) })) }
  await writeFile(join(directory, 'import_manifest.json'), JSON.stringify(manifest))
  return directory
}

afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })

describe('monograph staging package validation', () => {
  it('reconciles counts and preserves amoxicillin combination identity', async () => {
    const result = await validateDataset(await createFixture())
    expect(result.counts).toMatchObject({ drugs: 2, evidence: 1, public_publishable: 0 })
    expect(result.amoxicillinDrugKey).toBe('DRUG_AMOX')
  })

  it('aborts when a manifest checksum does not match', async () => {
    const directory = await createFixture()
    await writeFile(join(directory, 'drugs.jsonl'), '{}\n')
    await expect(verifyPackage(directory)).rejects.toThrow('SHA-256 mismatch for drugs.jsonl')
  })
})
