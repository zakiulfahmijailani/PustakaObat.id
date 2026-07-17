import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Client } from 'pg'

async function loadLocalEnv() {
  if (process.env.DATABASE_URL) return
  const content = await readFile(resolve('.env.local'), 'utf8').catch(() => '')
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/)
    if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim()
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

await loadLocalEnv()
assert(process.env.DATABASE_URL, 'Set the server-only Neon DATABASE_URL before verification')
const manifest = JSON.parse(await readFile(resolve('data/imports/website_export/import_manifest.json'), 'utf8'))
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  const counts = (await client.query(`
    select
      (select count(*)::int from public.monograph_staging_drugs) drugs,
      (select count(*)::int from public.monograph_staging_identifiers) identifiers,
      (select count(*)::int from public.monograph_staging_source_documents) source_documents,
      (select count(*)::int from public.monograph_staging_evidence) evidence,
      (select count(*)::int from public.monograph_staging_search_index) search_index,
      (select count(*)::int from public.monograph_staging_drugs where core_editorial_candidate) editorial_candidates,
      (select count(*)::int from public.who_medicines) who_medicines,
      (select count(*)::int from public.drugs) public_drugs
  `)).rows[0]
  for (const name of ['drugs', 'identifiers', 'source_documents', 'evidence', 'search_index', 'editorial_candidates']) {
    assert(counts[name] === manifest.record_counts[name], `${name} expected ${manifest.record_counts[name]}, received ${counts[name]}`)
  }
  const unsafe = (await client.query(`
    select
      (select count(*)::int from public.monograph_staging_drugs where editorial_status <> 'staging' or public_status <> 'hidden' or publication_eligible) concepts,
      (select count(*)::int from public.monograph_staging_evidence where review_status <> 'unreviewed' or publication_eligible) evidence,
      (select count(*)::int from public.monograph_staging_search_index where public_status <> 'hidden' or website_visibility <> 'staging_only') search_entries,
      (select count(*)::int from public.monograph_editorial_drafts where publication_eligible) drafts
  `)).rows[0]
  assert(Object.values(unsafe).every((value) => value === 0), `Unsafe staging state detected: ${JSON.stringify(unsafe)}`)

  const amoxicillin = (await client.query("select drug_key, identity_status, core_editorial_candidate, is_pilot, public_status, publication_eligible from public.monograph_staging_drugs where normalized_name = 'amoxicillin' and seed_type = 'ingredient'" )).rows[0]
  assert(amoxicillin?.identity_status === 'validated' && amoxicillin.core_editorial_candidate && amoxicillin.is_pilot, 'Amoxicillin pilot is not validated and editorial-ready')
  assert(amoxicillin.public_status === 'hidden' && amoxicillin.publication_eligible === false, 'Amoxicillin was unexpectedly published')
  const combination = (await client.query("select drug_key from public.monograph_staging_drugs where normalized_name like 'amoxicillin +%' and seed_type = 'combination' limit 1")).rows[0]
  assert(combination && combination.drug_key !== amoxicillin.drug_key, 'Combination record was merged into amoxicillin')
  const run = (await client.query("select status, attempt_count from public.monograph_staging_import_runs order by updated_at desc limit 1")).rows[0]
  assert(run?.status === 'completed', 'Latest staging import did not complete')
  assert(counts.who_medicines > 0, 'Existing WHO catalog is unexpectedly empty')
  console.log(JSON.stringify({ counts, unsafe, amoxicillin, combination, import_run: run }, null, 2))
  console.log('Staging verification passed: hidden, unreviewed, non-publishable, idempotent-keyed, WHO preserved.')
} finally {
  await client.end()
}
