import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('private bilingual label storage', () => {
  it('keeps bilingual objects private and bound to the verified translation import', async () => {
    const migration = await readFile(resolve('database/migrations/018_full_label_bilingual_objects.sql'), 'utf8')
    expect(migration).toContain('translation_import_id uuid not null')
    expect(migration).toContain("storage_status in ('uploaded', 'verified', 'failed')")
    expect(migration).not.toContain('publication_eligible true')
    expect(migration).not.toContain('public_status')
  })

  it('prefers one bilingual object but preserves legacy source and overlay fallbacks', async () => {
    const route = await readFile(resolve('src/app/api/full-label/labels/[labelId]/sections/route.ts'), 'utf8')
    expect(route).toContain('readBilingualLabelObject')
    expect(route).toContain('readLabelSectionsFromObject')
    expect(route).toContain('readLabelSectionsFromShard')
    expect(route).toContain('readTranslationsFromOverlay')
    expect(route).toContain("'Vary': 'Cookie'")
  })

  it('deduplicates concurrent object reads and caches translated hashes', async () => {
    const storage = await readFile(resolve('src/lib/full-label/storage.ts'), 'utf8')
    expect(storage).toContain('pendingSectionReads')
    expect(storage).toContain('deduplicateSectionRead')
    expect(storage).toContain('translationCache')
    expect(storage).toContain('3.2.1-bilingual')
  })
})
