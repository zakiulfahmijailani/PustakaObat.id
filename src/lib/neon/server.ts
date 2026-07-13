import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

let client: NeonQueryFunction<false, false> | null = null

export function isNeonConfigured() {
  return Boolean(process.env.DATABASE_URL)
}

export function getNeonClient() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('Neon is not configured. Set DATABASE_URL on the server.')
  client ??= neon(databaseUrl)
  return client
}

export async function queryNeon<T>(statement: string, parameters: unknown[] = []) {
  const rows = await getNeonClient().query(statement, parameters)
  return rows as T[]
}
