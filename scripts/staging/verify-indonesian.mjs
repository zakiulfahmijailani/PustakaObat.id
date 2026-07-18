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

await loadLocalEnv()
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  const result = await client.query(`
    select
      (select count(*)::int from public.monograph_staging_drugs) as staging_drugs,
      (select count(*)::int from public.monograph_staging_indonesian_names) as indonesian_names,
      (select count(*)::int from public.monograph_staging_indonesian_aliases) as indonesian_aliases,
      (select count(*)::int from public.monograph_staging_indonesian_drafts) as indonesian_drafts,
      (select count(*)::int from public.monograph_staging_indonesian_drafts where publication_eligible) as public_drafts,
      (select count(*)::int from public.monograph_staging_indonesian_drafts where review_status = 'draft_ai') as ai_drafts
  `)
  const amoxicillin = await client.query(`
    select n.preferred_name_indonesian, a.alias, d.section_type, d.review_status, d.publication_eligible
    from public.monograph_staging_indonesian_names n
    join public.monograph_staging_indonesian_aliases a on a.drug_key = n.drug_key
    join public.monograph_staging_indonesian_drafts d on d.drug_key = n.drug_key
    where n.preferred_name_source = 'Amoxicillin'
    order by d.section_type
    limit 5
  `)
  console.log(JSON.stringify({ counts: result.rows[0], amoxicillin: amoxicillin.rows }, null, 2))
} finally { await client.end() }
