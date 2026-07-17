import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('public monograph isolation', () => {
  it('keeps staging tables and raw source_text out of public drug queries', async () => {
    const publicQueries = await readFile(resolve('src/lib/who/queries.ts'), 'utf8')
    const publicDetail = await readFile(resolve('src/app/(public)/obat/[slug]/page.tsx'), 'utf8')
    expect(publicQueries).not.toContain('monograph_staging_')
    expect(publicQueries).not.toContain('source_text')
    expect(publicDetail).not.toContain('monograph_staging_')
    expect(publicDetail).not.toContain('source_text')
  })
})
