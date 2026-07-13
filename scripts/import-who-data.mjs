import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { prepareWhoCatalog } from './who/catalog.mjs'

const DEFAULT_FILE = resolve('data/import/who/processed/who_medicine_catalog.json')
const DEFAULT_MANIFEST = resolve('data/import/who/manifest.json')

function parseArguments(argv) {
  const options = { apply: false, file: DEFAULT_FILE, manifest: DEFAULT_MANIFEST }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--apply') options.apply = true
    else if (argument === '--dry-run') options.apply = false
    else if (argument === '--file') options.file = resolve(argv[++index] || '')
    else if (argument === '--manifest') options.manifest = resolve(argv[++index] || '')
    else throw new Error(`Unknown argument: ${argument}`)
  }
  return options
}

function fileHash(content) {
  return createHash('sha256').update(content).digest('hex')
}

function serviceCredentials() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using --apply')
  if (key === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('The service-role key must not be the public anon key')
  return { url, key }
}

async function main() {
  const startedAt = new Date().toISOString()
  const options = parseArguments(process.argv.slice(2))
  const [fileBuffer, manifestBuffer] = await Promise.all([readFile(options.file), readFile(options.manifest)])
  const rawRecords = JSON.parse(fileBuffer.toString('utf8'))
  const manifest = JSON.parse(manifestBuffer.toString('utf8'))
  const prepared = prepareWhoCatalog(rawRecords)
  const sourceVersion = rawRecords.find((record) => record?.source_version)?.source_version || 'WHO electronic list snapshot'
  const expectedHash = manifest?.files?.['processed/who_medicine_catalog.json']?.sha256
  const actualHash = fileHash(fileBuffer)
  const manifestHash = fileHash(manifestBuffer)
  if (expectedHash && expectedHash !== actualHash) throw new Error(`Processed catalog hash does not match manifest: ${actualHash}`)

  console.log(`Validated source records: ${rawRecords.length}`)
  console.log(`Ready for import: ${prepared.records.length}`)
  console.log(`Skipped: ${prepared.skipped.length}`)
  console.log(`Failed: ${prepared.failed.length}`)
  console.log(`Dataset checksum: ${prepared.dataset_checksum}`)
  if (prepared.skipped.length) console.log(`Skipped records: ${prepared.skipped.map((item) => item.medicine_name).join(', ')}`)

  if (!options.apply) {
    console.log('Dry run complete. No database write was performed.')
    return
  }

  const { url, key } = serviceCredentials()
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await supabase.rpc('import_who_catalog', {
    _dataset_checksum: prepared.dataset_checksum,
    _manifest_hash: manifestHash,
    _schema_version: prepared.schema_version,
    _source_version: sourceVersion,
    _source_file: options.file.replaceAll('\\', '/'),
    _generated_at: manifest.generated_at || new Date().toISOString(),
    _started_at: startedAt,
    _skipped_count: prepared.skipped.length,
    _failed_count: prepared.failed.length,
    _records: prepared.records,
  })
  if (error) {
    await supabase.from('who_import_runs').insert({
      source_name: 'WHO', source_version: sourceVersion,
      source_file: options.file.replaceAll('\\', '/'), manifest_hash: manifestHash,
      dataset_checksum: prepared.dataset_checksum, schema_version: prepared.schema_version,
      record_count: prepared.records.length, inserted_count: 0, updated_count: 0,
      skipped_count: prepared.skipped.length, failed_count: prepared.records.length,
      status: 'failed', started_at: startedAt, completed_at: new Date().toISOString(),
      error_message: error.message,
    })
    throw new Error(`WHO import failed: ${error.message}. Apply migration 003_who_catalog.sql first.`)
  }
  console.log(`Import result: ${JSON.stringify(data)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
