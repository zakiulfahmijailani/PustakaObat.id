import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { describeEditorAction, resolveInitialSection } from './editorial-queue'

describe('actionable editorial queues', () => {
  it('prioritizes requested revisions over drafts and new work', () => {
    expect(describeEditorAction({ revision_section_count: 2, draft_section_count: 3, new_section_count: 4 })).toMatchObject({
      kind: 'revision',
      action: 'Perbaiki sekarang',
    })
    expect(describeEditorAction({ revision_section_count: 0, draft_section_count: 1, new_section_count: 4 }).kind).toBe('draft')
    expect(describeEditorAction({ revision_section_count: 0, draft_section_count: 0, new_section_count: 4 }).kind).toBe('new')
  })

  it('opens a requested section only when it belongs to the current work item', () => {
    const sections = ['dosage', 'warnings']
    expect(resolveInitialSection('warnings', sections)).toBe('warnings')
    expect(resolveInitialSection('clinical_pharmacology', sections)).toBe('dosage')
  })

  it('keeps Editor mutations owner-scoped and lets Reviewers return legacy unbound drafts', async () => {
    const mutations = await readFile(resolve('src/lib/staging/mutations.ts'), 'utf8')
    expect(mutations).toContain("authored_by = $2::uuid\n        and status in ('draft', 'changes_requested')")
    expect(mutations).toContain('public.monograph_editorial_drafts.authored_by = $8::uuid')
    expect(mutations).toContain('public.monograph_editorial_drafts.authored_by = $3::uuid')
    expect(mutations).toContain("$2 = 'changes_requested' or (source_label_id is not null")
  })

  it('excludes claimed work and self-review from role queues', async () => {
    const queries = await readFile(resolve('src/lib/staging/queries.ts'), 'utf8')
    const editorQueue = queries.split('export async function getEditorActionQueue')[1].split('export async function getEditorialReviewQueue')[0]
    const reviewerQueue = queries.split('export async function getEditorialReviewQueue')[1].split('export async function getStagedDrugForStaff')[0]
    expect(editorQueue).toContain('not exists (')
    expect(editorQueue).toContain('monograph_full_label_availability ready')
    expect(editorQueue).toContain('ready.translated_section_count > 0')
    expect(editorQueue).toContain('own.authored_by = $1::uuid')
    expect(editorQueue).toContain("own.status in ('draft', 'changes_requested')")
    expect(reviewerQueue).toContain('draft.authored_by is distinct from $1::uuid')
    expect(reviewerQueue).toContain("draft.status = 'submitted'")
  })

  it('only offers fast materialized bilingual labels and validates bindings from the object itself', async () => {
    const queries = await readFile(resolve('src/lib/staging/queries.ts'), 'utf8')
    const binding = await readFile(resolve('src/lib/full-label/editorial-binding.ts'), 'utf8')
    expect(queries).toContain("o.storage_status = 'verified'")
    expect(queries).toContain("bilingual.storage_status = 'verified'")
    expect(binding).toContain('readBilingualLabelObject')
    expect(binding).not.toContain('m.section_types')
  })
})
