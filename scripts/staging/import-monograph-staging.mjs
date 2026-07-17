import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

export const DEFAULT_DATA_DIRECTORY = resolve('data/imports/website_export')
export const EXPECTED_PIPELINE_VERSION = '2.2.0'

const JSONL_SPECS = {
  drugs: {
    file: 'drugs.jsonl',
    required: ['drug_id', 'preferred_name', 'normalized_name', 'slug', 'seed_type', 'ingredient_count', 'identity_status', 'editorial_status', 'public_status', 'pipeline_version'],
    key: (row) => row.drug_id,
  },
  identifiers: {
    file: 'drug_identifiers.jsonl',
    required: ['drug_id', 'identifier_system', 'identifier_value', 'validation_status'],
    key: (row) => `${row.drug_id}\u0000${row.identifier_system}\u0000${row.identifier_value}`,
  },
  source_documents: {
    file: 'drug_source_documents.jsonl',
    required: ['source_document_key', 'drug_id', 'preferred_name', 'source_name', 'source_document_id', 'validation_status', 'usage_scope'],
    allowEmpty: ['source_document_id'],
    key: (row) => row.source_document_key,
  },
  evidence: {
    file: 'monograph_evidence.jsonl',
    required: ['evidence_id', 'drug_id', 'section_type', 'source_name', 'source_document_id', 'source_section', 'source_text', 'ingredient_match_status', 'license_status', 'review_status', 'publication_eligible', 'pipeline_version'],
    key: (row) => row.evidence_id,
  },
  search_index: {
    file: 'drug_search_index.jsonl',
    required: ['drug_id', 'preferred_name', 'slug', 'identity_status', 'public_status', 'search_text', 'market_context_status', 'website_visibility'],
    key: (row) => row.drug_id,
  },
}

const EXPECTED_PRIMARY_KEYS = {
  'drugs.jsonl': ['drug_id'],
  'drug_identifiers.jsonl': ['drug_id', 'identifier_system', 'identifier_value'],
  'drug_source_documents.jsonl': ['source_document_key'],
  'monograph_evidence.jsonl': ['evidence_id'],
  'drug_search_index.jsonl': ['drug_id'],
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function nonEmpty(value) {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function hashFile(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

function parseJsonArray(value, field, file, lineNumber) {
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value || '[]')
    assert(Array.isArray(parsed), `${file}:${lineNumber} ${field} must be a JSON array`)
    return parsed
  } catch (error) {
    throw new Error(`${file}:${lineNumber} invalid ${field}: ${error instanceof Error ? error.message : error}`)
  }
}

export async function* streamJsonLines(path, fileLabel = path) {
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })
  let lineNumber = 0
  for await (const line of lines) {
    lineNumber += 1
    if (!line.trim()) continue
    try {
      yield { row: JSON.parse(line), lineNumber }
    } catch (error) {
      throw new Error(`${fileLabel}:${lineNumber} is not valid JSON: ${error instanceof Error ? error.message : error}`)
    }
  }
}

function parseCsvLine(line) {
  const values = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1 } else quoted = !quoted
    } else if (character === ',' && !quoted) {
      values.push(value); value = ''
    } else value += character
  }
  values.push(value)
  return values
}

function csvBoolean(value) {
  return String(value).toLowerCase() === 'true'
}

export async function readCoverage(path) {
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })
  let headers = null
  const records = new Map()
  for await (const line of lines) {
    if (!headers) { headers = parseCsvLine(line); continue }
    if (!line.trim()) continue
    const values = parseCsvLine(line)
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
    assert(nonEmpty(row.drug_id), 'core_coverage_report.csv contains a row without drug_id')
    assert(!records.has(row.drug_id), `Duplicate coverage drug_id: ${row.drug_id}`)
    records.set(row.drug_id, row)
  }
  return records
}

export async function verifyPackage(dataDirectory = DEFAULT_DATA_DIRECTORY) {
  const manifestPath = resolve(dataDirectory, 'import_manifest.json')
  const contractPath = resolve(dataDirectory, 'schema_contract.json')
  const [manifestBuffer, contractBuffer] = await Promise.all([readFile(manifestPath), readFile(contractPath)])
  const manifest = JSON.parse(manifestBuffer.toString('utf8'))
  const contract = JSON.parse(contractBuffer.toString('utf8'))

  assert(manifest.pipeline_version === EXPECTED_PIPELINE_VERSION, `Unsupported manifest pipeline version: ${manifest.pipeline_version}`)
  assert(contract.pipeline_version === EXPECTED_PIPELINE_VERSION, `Unsupported schema contract pipeline version: ${contract.pipeline_version}`)
  assert(manifest.staging_only === true && contract.staging_only === true, 'Package and schema contract must be staging-only')
  assert(manifest.qc_summary?.fatal_total === 0 && manifest.qc_summary?.qc_passed === true, 'Manifest fatal QC checks did not pass')
  assert(manifest.record_counts?.public_publishable === 0, 'Manifest unexpectedly contains public-publishable monographs')
  assert(contract.publication_rule === 'public publication requires pharmacist-reviewed original Indonesian monograph sections', 'Unexpected publication rule in schema contract')
  for (const [file, key] of Object.entries(EXPECTED_PRIMARY_KEYS)) {
    assert(JSON.stringify(contract.primary_keys?.[file]) === JSON.stringify(key), `Schema-contract primary key mismatch for ${file}`)
  }

  const checksums = {}
  for (const entry of manifest.files || []) {
    assert(nonEmpty(entry.file) && /^[a-f0-9]{64}$/.test(entry.sha256), 'Manifest contains an invalid file checksum entry')
    const path = resolve(dataDirectory, entry.file)
    const actual = await hashFile(path)
    assert(actual === entry.sha256, `SHA-256 mismatch for ${entry.file}: expected ${entry.sha256}, received ${actual}`)
    checksums[entry.file] = actual
  }

  return { manifest, contract, manifestChecksum: sha256(manifestBuffer), checksums }
}

function validateStagingInvariant(kind, row, file, lineNumber) {
  if (kind === 'drugs') {
    assert(row.editorial_status === 'staging', `${file}:${lineNumber} editorial_status must be staging`)
    assert(row.public_status === 'hidden', `${file}:${lineNumber} public_status must be hidden`)
    assert(row.raw_evidence_publishable === false, `${file}:${lineNumber} raw evidence must not be publishable`)
    assert(['ingredient', 'combination'].includes(row.seed_type), `${file}:${lineNumber} invalid seed_type`)
    assert(row.seed_type === 'combination' || Number(row.ingredient_count) === 1, `${file}:${lineNumber} invalid single-ingredient count`)
  } else if (kind === 'evidence') {
    assert(row.review_status === 'unreviewed', `${file}:${lineNumber} evidence must be unreviewed`)
    assert(row.publication_eligible === false, `${file}:${lineNumber} evidence must not be publication-eligible`)
    assert(nonEmpty(row.source_text), `${file}:${lineNumber} source_text is required for server-side evidence`)
  } else if (kind === 'search_index') {
    assert(row.public_status === 'hidden', `${file}:${lineNumber} search entry must be hidden`)
    assert(row.website_visibility === 'staging_only', `${file}:${lineNumber} search entry must be staging-only`)
    assert(row.market_context_status === 'BPOM_PENDING', `${file}:${lineNumber} BPOM must remain pending`)
  }
}

export async function validateDataset(dataDirectory = DEFAULT_DATA_DIRECTORY) {
  const verified = await verifyPackage(dataDirectory)
  const coverage = await readCoverage(resolve(dataDirectory, 'core_coverage_report.csv'))
  const drugKeys = new Set()
  const counts = {}
  const drugs = new Map()

  for (const [kind, spec] of Object.entries(JSONL_SPECS)) {
    const keys = new Set()
    let count = 0
    for await (const { row, lineNumber } of streamJsonLines(resolve(dataDirectory, spec.file), spec.file)) {
      count += 1
      for (const field of spec.required) {
        assert(Object.prototype.hasOwnProperty.call(row, field), `${spec.file}:${lineNumber} missing required field ${field}`)
        assert(spec.allowEmpty?.includes(field) || nonEmpty(row[field]) || row[field] === false, `${spec.file}:${lineNumber} empty required field ${field}`)
      }
      assert(row.pipeline_version === undefined || row.pipeline_version === EXPECTED_PIPELINE_VERSION, `${spec.file}:${lineNumber} pipeline version mismatch`)
      const key = spec.key(row)
      assert(!keys.has(key), `${spec.file}:${lineNumber} duplicate primary key`)
      keys.add(key)
      validateStagingInvariant(kind, row, spec.file, lineNumber)
      if (kind === 'drugs') { drugKeys.add(row.drug_id); drugs.set(row.drug_id, row) }
      else assert(drugKeys.has(row.drug_id), `${spec.file}:${lineNumber} references unknown drug_id ${row.drug_id}`)
      if (kind === 'drugs') {
        parseJsonArray(row.ingredient_parts, 'ingredient_parts', spec.file, lineNumber)
        parseJsonArray(row.section_names, 'section_names', spec.file, lineNumber)
        parseJsonArray(row.formulations, 'formulations', spec.file, lineNumber)
        parseJsonArray(row.indication_names, 'indication_names', spec.file, lineNumber)
      }
      if (kind === 'evidence') {
        parseJsonArray(row.concept_ingredients, 'concept_ingredients', spec.file, lineNumber)
        parseJsonArray(row.label_ingredients, 'label_ingredients', spec.file, lineNumber)
      }
    }
    counts[kind] = count
  }

  assert(coverage.size === counts.drugs, `Coverage rows ${coverage.size} do not match drug rows ${counts.drugs}`)
  for (const drugKey of drugKeys) assert(coverage.has(drugKey), `Coverage report is missing ${drugKey}`)
  const candidateCount = [...coverage.values()].filter((row) => csvBoolean(row.core_editorial_candidate)).length
  counts.editorial_candidates = candidateCount
  counts.public_publishable = [...coverage.values()].filter((row) => csvBoolean(row.public_publishable)).length

  for (const [name, expected] of Object.entries(verified.manifest.record_counts)) {
    assert(counts[name] === expected, `Record reconciliation mismatch for ${name}: expected ${expected}, received ${counts[name]}`)
  }

  const amoxicillin = [...drugs.values()].find((row) => row.normalized_name === 'amoxicillin' && row.seed_type === 'ingredient')
  assert(amoxicillin, 'Validated single-ingredient amoxicillin concept is missing')
  assert(amoxicillin.identity_status === 'validated', 'Amoxicillin identity is not validated')
  assert(csvBoolean(coverage.get(amoxicillin.drug_id)?.core_editorial_candidate), 'Amoxicillin is not an editorial candidate')
  const amoxicillinCombination = [...drugs.values()].find((row) => row.normalized_name.includes('amoxicillin +') && row.seed_type === 'combination')
  assert(amoxicillinCombination && amoxicillinCombination.drug_id !== amoxicillin.drug_id, 'Amoxicillin combination was merged into the single ingredient concept')

  return { ...verified, coverage, counts, amoxicillinDrugKey: amoxicillin.drug_id }
}

function rowChecksum(row) {
  return sha256(Buffer.from(JSON.stringify(row)))
}

function drugRecord(row, coverage, amoxicillinDrugKey) {
  const prepared = {
    drug_key: row.drug_id,
    preferred_name: row.preferred_name,
    normalized_name: row.normalized_name,
    slug: row.slug,
    seed_type: row.seed_type,
    ingredient_parts: JSON.stringify(parseJsonArray(row.ingredient_parts, 'ingredient_parts', 'drugs.jsonl', 0)),
    ingredient_count: Number(row.ingredient_count),
    rxcui: row.rxcui || null,
    rxnorm_name: row.rxnorm_name || null,
    rxnorm_tty: row.rxnorm_tty || null,
    match_method: row.match_method || null,
    name_similarity: row.name_similarity ?? null,
    rxnorm_validation_status: row.rxnorm_validation_status || null,
    validation_reason: row.validation_reason || null,
    identity_status: row.identity_status,
    seed_id: row.seed_id || null,
    source_record_id: row.source_record_id || null,
    source_url: row.source_url || null,
    record_kind: row.record_kind || null,
    source_dom_class: row.source_dom_class || null,
    section_names: JSON.stringify(parseJsonArray(row.section_names, 'section_names', 'drugs.jsonl', 0)),
    formulations: JSON.stringify(parseJsonArray(row.formulations, 'formulations', 'drugs.jsonl', 0)),
    indication_names: JSON.stringify(parseJsonArray(row.indication_names, 'indication_names', 'drugs.jsonl', 0)),
    aware_category: row.aware_category || null,
    coverage: JSON.stringify(coverage),
    core_editorial_candidate: csvBoolean(coverage.core_editorial_candidate),
    is_pilot: row.drug_id === amoxicillinDrugKey,
    editorial_status: 'staging',
    public_status: 'hidden',
    publication_eligible: false,
    bpom_status: 'BPOM_PENDING',
    pipeline_version: row.pipeline_version,
    source_created_at: row.created_at || null,
    source_updated_at: row.updated_at || null,
  }
  return { ...prepared, row_checksum: rowChecksum({ ...row, coverage }) }
}

function identifierRecord(row) {
  const prepared = { drug_key: row.drug_id, identifier_system: row.identifier_system, identifier_value: row.identifier_value, is_primary: Boolean(row.is_primary), validation_status: row.validation_status, source_created_at: row.created_at || null }
  return { ...prepared, row_checksum: rowChecksum(row) }
}

function sourceDocumentRecord(row) {
  const prepared = { source_document_key: row.source_document_key, drug_key: row.drug_id, preferred_name: row.preferred_name, source_name: row.source_name, source_document_id: row.source_document_id, source_url: row.source_url || null, validation_status: row.validation_status, usage_scope: row.usage_scope, retrieved_at: row.retrieved_at || null }
  return { ...prepared, row_checksum: rowChecksum(row) }
}

function evidenceRecord(row) {
  const prepared = { evidence_id: row.evidence_id, drug_key: row.drug_id, section_type: row.section_type, source_name: row.source_name, source_document_id: row.source_document_id, source_set_id: row.source_set_id || null, source_section: row.source_section, source_text: row.source_text, source_version: row.source_version || null, concept_ingredients: JSON.stringify(parseJsonArray(row.concept_ingredients, 'concept_ingredients', 'monograph_evidence.jsonl', 0)), label_ingredients: JSON.stringify(parseJsonArray(row.label_ingredients, 'label_ingredients', 'monograph_evidence.jsonl', 0)), ingredient_match_status: row.ingredient_match_status, product_specific: Boolean(row.product_specific), license_status: row.license_status, retrieved_at: row.retrieved_at || null, review_status: 'unreviewed', publication_eligible: false, pipeline_version: row.pipeline_version }
  return { ...prepared, row_checksum: rowChecksum(row) }
}

function searchRecord(row) {
  const prepared = { drug_key: row.drug_id, preferred_name: row.preferred_name, slug: row.slug, identity_status: row.identity_status, search_text: row.search_text, market_context_status: 'BPOM_PENDING', website_visibility: 'staging_only', public_status: 'hidden' }
  return { ...prepared, row_checksum: rowChecksum(row) }
}

const IMPORT_DEFINITIONS = {
  drugs: { table: 'monograph_staging_drugs', conflict: ['drug_key'], preserve: ['is_pilot'], prepare: drugRecord },
  identifiers: { table: 'monograph_staging_identifiers', conflict: ['drug_key', 'identifier_system', 'identifier_value'], prepare: identifierRecord },
  source_documents: { table: 'monograph_staging_source_documents', conflict: ['source_document_key'], prepare: sourceDocumentRecord },
  evidence: { table: 'monograph_staging_evidence', conflict: ['evidence_id'], prepare: evidenceRecord },
  search_index: { table: 'monograph_staging_search_index', conflict: ['drug_key'], prepare: searchRecord },
}

async function upsert(client, definition, record) {
  const columns = Object.keys(record)
  const preserve = new Set([...(definition.preserve || []), ...definition.conflict])
  const updates = columns.filter((column) => !preserve.has(column)).map((column) => `${column} = excluded.${column}`)
  updates.push('updated_at = now()')
  const sql = `
    insert into public.${definition.table} (${columns.join(', ')})
    values (${columns.map((_, index) => `$${index + 1}`).join(', ')})
    on conflict (${definition.conflict.join(', ')}) do update set ${updates.join(', ')}
    where public.${definition.table}.row_checksum is distinct from excluded.row_checksum
    returning (xmax = 0) as inserted
  `
  const result = await client.query(sql, columns.map((column) => record[column]))
  if (!result.rows.length) return 'unchanged'
  return result.rows[0].inserted ? 'inserted' : 'updated'
}

function loadLocalEnv() {
  if (process.env.DATABASE_URL) return
  try {
    const path = resolve('.env.local')
    return readFile(path, 'utf8').then((content) => {
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*([^#=]+)=(.*)$/)
        if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim()
      }
    }).catch(() => undefined)
  } catch { return undefined }
}

function parseArguments(argv) {
  const options = { apply: false, dataDirectory: DEFAULT_DATA_DIRECTORY }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--apply') options.apply = true
    else if (argument === '--dry-run') options.apply = false
    else if (argument === '--dir') options.dataDirectory = resolve(argv[++index] || '')
    else throw new Error(`Unknown argument: ${argument}`)
  }
  return options
}

async function recordFailedRun(client, validated, dataDirectory, startedAt, error) {
  await client.query(`
    insert into public.monograph_staging_import_runs (
      manifest_checksum, pipeline_version, generated_at, source_directory, status,
      expected_counts, result_counts, file_checksums, started_at, completed_at, last_error
    ) values ($1, $2, $3, $4, 'failed', $5::jsonb, '{}'::jsonb, $6::jsonb, $7, now(), $8)
    on conflict (manifest_checksum) do update set
      status = 'failed', attempt_count = public.monograph_staging_import_runs.attempt_count + 1,
      started_at = excluded.started_at, completed_at = now(), last_error = excluded.last_error
  `, [validated.manifestChecksum, validated.manifest.pipeline_version, validated.manifest.generated_at, dataDirectory.replaceAll('\\', '/'), JSON.stringify(validated.manifest.record_counts), JSON.stringify(validated.checksums), startedAt, String(error).slice(0, 4000)])
}

export async function importDataset(dataDirectory = DEFAULT_DATA_DIRECTORY) {
  const validated = await validateDataset(dataDirectory)
  await loadLocalEnv()
  assert(process.env.DATABASE_URL, 'Set the server-only Neon DATABASE_URL before using --apply')
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  const startedAt = new Date().toISOString()
  const stats = Object.fromEntries(Object.keys(IMPORT_DEFINITIONS).map((kind) => [kind, { inserted: 0, updated: 0, unchanged: 0 }]))

  await client.connect()
  try {
    const migrationCheck = await client.query("select to_regclass('public.monograph_staging_drugs') as staging_table")
    assert(migrationCheck.rows[0]?.staging_table, 'Staging schema is missing. Apply database/migrations/006_monograph_staging_v2_2.sql first.')
    await client.query('begin')
    await client.query(`
      insert into public.monograph_staging_import_runs (
        manifest_checksum, pipeline_version, generated_at, source_directory, status,
        expected_counts, file_checksums, started_at, completed_at, last_error
      ) values ($1, $2, $3, $4, 'running', $5::jsonb, $6::jsonb, $7, null, null)
      on conflict (manifest_checksum) do update set
        status = 'running', attempt_count = public.monograph_staging_import_runs.attempt_count + 1,
        expected_counts = excluded.expected_counts, file_checksums = excluded.file_checksums,
        source_directory = excluded.source_directory, started_at = excluded.started_at,
        completed_at = null, last_error = null
    `, [validated.manifestChecksum, validated.manifest.pipeline_version, validated.manifest.generated_at, dataDirectory.replaceAll('\\', '/'), JSON.stringify(validated.manifest.record_counts), JSON.stringify(validated.checksums), startedAt])

    for (const [kind, definition] of Object.entries(IMPORT_DEFINITIONS)) {
      const spec = JSONL_SPECS[kind]
      for await (const { row } of streamJsonLines(resolve(dataDirectory, spec.file), spec.file)) {
        const coverage = kind === 'drugs' ? validated.coverage.get(row.drug_id) : undefined
        const record = definition.prepare(row, coverage, validated.amoxicillinDrugKey)
        const action = await upsert(client, definition, record)
        stats[kind][action] += 1
      }
    }

    const reconciliation = await client.query(`
      select
        (select count(*)::int from public.monograph_staging_drugs) as drugs,
        (select count(*)::int from public.monograph_staging_identifiers) as identifiers,
        (select count(*)::int from public.monograph_staging_source_documents) as source_documents,
        (select count(*)::int from public.monograph_staging_evidence) as evidence,
        (select count(*)::int from public.monograph_staging_search_index) as search_index,
        (select count(*)::int from public.monograph_staging_drugs where core_editorial_candidate) as editorial_candidates,
        (select count(*)::int from public.monograph_staging_drugs where public_status <> 'hidden' or publication_eligible) +
          (select count(*)::int from public.monograph_staging_evidence where publication_eligible) +
          (select count(*)::int from public.monograph_staging_search_index where public_status <> 'hidden' or website_visibility <> 'staging_only') as public_publishable
    `)
    const actual = reconciliation.rows[0]
    for (const [name, expected] of Object.entries(validated.manifest.record_counts)) {
      assert(Number(actual[name]) === expected, `Database reconciliation mismatch for ${name}: expected ${expected}, received ${actual[name]}`)
    }

    const amoxicillinCheck = await client.query(`
      select drug_key, identity_status, core_editorial_candidate, public_status, publication_eligible, is_pilot
      from public.monograph_staging_drugs where drug_key = $1
    `, [validated.amoxicillinDrugKey])
    const pilot = amoxicillinCheck.rows[0]
    assert(pilot?.identity_status === 'validated' && pilot.core_editorial_candidate && pilot.public_status === 'hidden' && !pilot.publication_eligible && pilot.is_pilot, 'Amoxicillin pilot reconciliation failed')

    await client.query(`
      update public.monograph_staging_import_runs
      set status = 'completed', result_counts = $2::jsonb, completed_at = now(), last_error = null
      where manifest_checksum = $1
    `, [validated.manifestChecksum, JSON.stringify({ upserts: stats, reconciled: actual })])
    await client.query('commit')
    return { manifestChecksum: validated.manifestChecksum, stats, reconciled: actual, amoxicillinDrugKey: validated.amoxicillinDrugKey }
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    await recordFailedRun(client, validated, dataDirectory, startedAt, error).catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const validated = await validateDataset(options.dataDirectory)
  console.log(`Package v${validated.manifest.pipeline_version}: checksums and schema contract valid`)
  console.log(`Reconciled source rows: ${JSON.stringify(validated.counts)}`)
  console.log(`Amoxicillin pilot: ${validated.amoxicillinDrugKey} (validated, editorial candidate, unpublished)`)
  if (!options.apply) {
    console.log('Dry run complete. No database write was performed.')
    return
  }
  const result = await importDataset(options.dataDirectory)
  console.log(`Import upserts: ${JSON.stringify(result.stats)}`)
  console.log(`Database reconciliation: ${JSON.stringify(result.reconciled)}`)
  console.log(`Manifest checksum: ${result.manifestChecksum}`)
}

const currentFile = fileURLToPath(import.meta.url)
if (process.argv[1] && currentFile === resolve(process.argv[1])) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
}
