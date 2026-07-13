import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { normalizeAwareCategories, prepareWhoCatalog, slugifyMedicineName } from './catalog.mjs'

describe('WHO catalog import contract', () => {
  it('normalizes AWaRe arrays, JSON arrays, and strings', () => {
    expect(normalizeAwareCategories(['Access'])).toEqual(['Access'])
    expect(normalizeAwareCategories('["Watch"]')).toEqual(['Watch'])
    expect(normalizeAwareCategories('Reserve')).toEqual(['Reserve'])
  })

  it('generates stable URL-safe slugs', () => {
    expect(slugifyMedicineName('Amoxicillin + clavulanic acid')).toBe('amoxicillin-clavulanic-acid')
  })

  it('prepares the repository snapshot deterministically and removes scraper navigation labels', async () => {
    const raw = JSON.parse(await readFile('data/import/who/processed/who_medicine_catalog.json', 'utf8'))
    const first = prepareWhoCatalog(raw)
    const second = prepareWhoCatalog(raw)

    expect(first.records).toHaveLength(960)
    expect(first.skipped.map((item) => item.medicine_name).sort()).toEqual(['First choice', 'Second choice'])
    expect(first.records.some((record) => /^(first|second) choice$/i.test(record.medicine_name))).toBe(false)
    expect(new Set(first.records.map((record) => record.source_key)).size).toBe(first.records.length)
    expect(new Set(first.records.map((record) => record.slug)).size).toBe(first.records.length)
    expect(first.dataset_checksum).toBe(second.dataset_checksum)
  })

  it('rejects duplicate stable WHO identifiers', () => {
    const record = {
      medicine_id: '315', medicine_name: 'Abacavir', is_who_eeml: true,
      aware_category: [], data_status: 'WHO_ONLY', source_name: 'WHO',
    }
    expect(() => prepareWhoCatalog([record, { ...record, medicine_name: 'Duplicate' }])).toThrow(/Duplicate WHO source key/)
  })
})
