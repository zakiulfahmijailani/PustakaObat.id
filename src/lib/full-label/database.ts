import 'server-only'

import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

let client: NeonQueryFunction<false, false> | null = null

function getFullLabelClient() {
  const databaseUrl =
    process.env.PUSTAKAOBAT_FULL_LABEL_DATABASE_URL
    || process.env.PUSTAKAOBAT_TEST_DATABASE_URL
    || process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('Full-label database is not configured.')
  }

  client ??= neon(databaseUrl)
  return client
}

export async function queryFullLabelNeon<T>(statement: string, parameters: unknown[] = []) {
  const rows = await getFullLabelClient().query(statement, parameters)
  return rows as T[]
}
