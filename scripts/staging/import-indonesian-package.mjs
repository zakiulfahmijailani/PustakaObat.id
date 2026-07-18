import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

export const DEFAULT_DATA_DIRECTORY = resolve('data/imports/website_export_indonesian')
const PIPELINE_VERSION = 'codex-id-1.0'
const FILES = {
  names: 'drug_names_indonesian.jsonl',
  aliases: 'drug_search_alias_candidates.jsonl',
  drafts: 'indonesian_monograph_candidates.jsonl',
  manifest: 'import_manifest.json',
  quality: 'quality_report.json',
}

function assert(condition, message) { if (!condition) throw new Error(message) }
function sha256(value) { return createHash('sha256').update(value).digest('hex') }
async function hashFile(path) {
  const hash = createHash('sha256')
  const stream = createReadStream(path)
  for await (const chunk of stream) hash.update(chunk)
  return hash.digest('hex')
}

async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')) }
async function readJsonl(path) {
  const rows = []
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })
  for await (const line of lines) if (line.trim()) rows.push(JSON.parse(line))
  return rows
}
function nonEmpty(value) { return value !== null && value !== undefined && String(value).trim() !== '' }
function rowChecksum(row) { return sha256(JSON.stringify(row)) }

export async function validatePackage(dataDirectory = DEFAULT_DATA_DIRECTORY) {
  const manifest = await readJson(resolve(dataDirectory, FILES.manifest))
  const quality = await readJson(resolve(dataDirectory, FILES.quality))
  assert(manifest.pipeline_version === PIPELINE_VERSION, `Unsupported Indonesian pipeline version: ${manifest.pipeline_version}`)
  assert(quality.qc_passed_for_staging_review === true && quality.fatal_total === 0, 'Indonesian package fatal QC did not pass')
  assert(quality.publication.public_publishable === false, 'Indonesian package unexpectedly contains public content')

  const checksums = {}
  for (const [file, expected] of Object.entries(manifest.files || {})) {
    const path = resolve(dataDirectory, file)
    const actual = await hashFile(path)
    assert(actual === expected.sha256, `Checksum mismatch for ${file}`)
    checksums[file] = actual
  }

  const names = await readJsonl(resolve(dataDirectory, FILES.names))
  const aliases = await readJsonl(resolve(dataDirectory, FILES.aliases))
  const drafts = await readJsonl(resolve(dataDirectory, FILES.drafts))
  const nameKeys = new Set(names.map((row) => row.drug_id))
  assert(names.length === 99 && nameKeys.size === names.length, 'Expected 99 unique Indonesian drug names')
  assert(aliases.length === 242, `Expected 242 aliases, received ${aliases.length}`)
  assert(drafts.length === 364, `Expected 364 Indonesian draft sections, received ${drafts.length}`)
  assert(new Set(aliases.map((row) => `${row.drug_id}\u0000${row.normalized_alias}\u0000${row.language}`)).size === aliases.length, 'Duplicate Indonesian alias key')
  assert(new Set(drafts.map((row) => `${row.drug_id}\u0000${row.section_type}`)).size === drafts.length, 'Duplicate Indonesian draft key')
  for (const row of [...names, ...aliases, ...drafts]) {
    assert(nonEmpty(row.drug_id), 'Indonesian row missing drug_id')
    assert(row.publication_eligible === false && row.is_public !== true, 'Indonesian row is not staging-only')
  }
  return { manifest, quality, checksums, names, aliases, drafts }
}

function loadLocalEnv() {
  if (process.env.DATABASE_URL) return
  return readFile(resolve('.env.local'), 'utf8').then((content) => {
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([^#=]+)=(.*)$/)
      if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim()
    }
  }).catch(() => undefined)
}

async function upsert(client, table, columns, values, conflictColumns) {
  const preserved = new Set(conflictColumns)
  const updates = columns.filter((column) => !preserved.has(column)).map((column) => `${column} = excluded.${column}`)
  updates.push('updated_at = now()')
  const sql = `insert into public.${table} (${columns.join(', ')}) values (${columns.map((_, index) => `$${index + 1}`).join(', ')}) on conflict (${conflictColumns.join(', ')}) do update set ${updates.join(', ')} where public.${table}.row_checksum is distinct from excluded.row_checksum returning (xmax = 0) as inserted`
  const result = await client.query(sql, values)
  if (!result.rows.length) return 'unchanged'
  return result.rows[0].inserted ? 'inserted' : 'updated'
}

export async function importPackage(dataDirectory = DEFAULT_DATA_DIRECTORY) {
  const validated = await validatePackage(dataDirectory)
  await loadLocalEnv()
  assert(process.env.DATABASE_URL, 'Set DATABASE_URL before using --apply')
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  const stats = { names: { inserted: 0, updated: 0, unchanged: 0 }, aliases: { inserted: 0, updated: 0, unchanged: 0 }, drafts: { inserted: 0, updated: 0, unchanged: 0 } }
  try {
    const schema = await client.query("select to_regclass('public.monograph_staging_indonesian_names') as names_table")
    assert(schema.rows[0]?.names_table, 'Indonesian staging schema is missing; run indonesian:migrate first')
    const existing = await client.query('select drug_key from public.monograph_staging_drugs')
    const drugKeys = new Set(existing.rows.map((row) => row.drug_key))
    for (const row of [...validated.names, ...validated.aliases, ...validated.drafts]) assert(drugKeys.has(row.drug_id), `Unknown existing staging drug: ${row.drug_id}`)
    await client.query('begin')
    for (const row of validated.names) {
      const record = { drug_key: row.drug_id, preferred_name_source: row.preferred_name_source, preferred_name_indonesian: row.preferred_name_indonesian, naming_status: row.naming_status, requires_pharmacist_review: true, publication_eligible: false, is_public: false, pipeline_version: row.pipeline_version, row_checksum: rowChecksum(row) }
      const action = await upsert(client, 'monograph_staging_indonesian_names', Object.keys(record), Object.values(record), ['drug_key']); stats.names[action] += 1
    }
    for (const row of validated.aliases) {
      const record = { drug_key: row.drug_id, alias: row.alias, normalized_alias: row.normalized_alias, language_code: row.language, alias_type: row.alias_type, priority: Number(row.priority), review_status: row.review_status, publication_eligible: false, is_public: false, pipeline_version: row.pipeline_version, row_checksum: rowChecksum(row) }
      const action = await upsert(client, 'monograph_staging_indonesian_aliases', Object.keys(record), Object.values(record), ['drug_key', 'normalized_alias', 'language_code']); stats.aliases[action] += 1
    }
    for (const row of validated.drafts) {
      const record = { drug_key: row.drug_id, section_type: row.section_type, title_indonesian: row.title_indonesian, content_indonesian: row.content_indonesian, source_evidence_ids: JSON.stringify(row.source_evidence_ids), missing_information: row.missing_information || '', safety_notes: row.safety_notes || '', automatic_qc_issues: JSON.stringify(row.automatic_qc_issues || []), generation_method: row.generation_method, review_status: row.review_status, requires_pharmacist_review: true, publication_eligible: false, is_public: false, pipeline_version: row.pipeline_version, row_checksum: rowChecksum(row) }
      const action = await upsert(client, 'monograph_staging_indonesian_drafts', Object.keys(record), Object.values(record), ['drug_key', 'section_type']); stats.drafts[action] += 1
    }
    await client.query('commit')
    return { stats, manifest: validated.manifest }
  } catch (error) { await client.query('rollback').catch(() => undefined); throw error } finally { await client.end() }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const directoryArgument = process.argv.indexOf('--dir')
  const dataDirectory = directoryArgument >= 0 ? resolve(process.argv[directoryArgument + 1] || '') : DEFAULT_DATA_DIRECTORY
  const validated = await validatePackage(dataDirectory)
  console.log(`Indonesian package ${validated.manifest.pipeline_version}: checksums and QC valid`)
  console.log(`Rows: names=${validated.names.length}, aliases=${validated.aliases.length}, drafts=${validated.drafts.length}`)
  if (!apply) { console.log('Dry run complete. No database write was performed.'); return }
  const result = await importPackage(dataDirectory)
  console.log(`Indonesian staging upserts: ${JSON.stringify(result.stats)}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
