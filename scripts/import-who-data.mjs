import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'
import { prepareWhoCatalog } from './who/catalog.mjs'

const DEFAULT_FILE = resolve('data/imports/who/processed/who_medicine_catalog.json')
const DEFAULT_MANIFEST = resolve('data/imports/who/manifest.json')

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

function databaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Set the server-only Neon DATABASE_URL before using --apply')
  return url
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

  const sql = neon(databaseUrl())
  try {
    const rows = await sql.query(
      'select public.import_who_catalog($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::integer, $9::integer, $10::jsonb) as result',
      [
        prepared.dataset_checksum,
        manifestHash,
        prepared.schema_version,
        sourceVersion,
        options.file.replaceAll('\\', '/'),
        manifest.generated_at || new Date().toISOString(),
        startedAt,
        prepared.skipped.length,
        prepared.failed.length,
        JSON.stringify(prepared.records),
      ],
    )
    console.log(`Import result: ${JSON.stringify(rows[0]?.result || null)}`)
  } catch (error) {
    throw new Error(`WHO import failed: ${error instanceof Error ? error.message : error}. Apply database/migrations/003_who_catalog.sql to Neon first.`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
