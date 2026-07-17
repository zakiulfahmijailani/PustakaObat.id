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
if (!process.env.DATABASE_URL) throw new Error('Set the server-only Neon DATABASE_URL before applying the migration')
const requestedMigration = process.argv[2] || '006_monograph_staging_v2_2.sql'
if (!/^[0-9]{3}_[a-z0-9_-]+\.sql$/i.test(requestedMigration)) {
  throw new Error('Migration filename must be a database/migrations SQL file.')
}
const migrationPath = resolve('database/migrations', requestedMigration)
const migration = await readFile(migrationPath, 'utf8')
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  await client.query(migration)
  const tables = await client.query("select count(*)::int as count from information_schema.tables where table_schema = 'public' and table_name like 'monograph_%'")
  console.log(`Applied ${migrationPath}. Monograph tables present: ${tables.rows[0].count}`)
} finally {
  await client.end()
}
