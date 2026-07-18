import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { canAdminWho, canReviewWho } from '@/lib/auth/permissions'
import { WHO_BPOM_DISCLAIMER } from './constants'
import { normalizeWhoSearchQuery } from './queries'

describe('WHO authorization policy', () => {
  it('allows reviewers but blocks admin, legacy, and public roles from clinical review', () => {
    expect(canReviewWho('reviewer')).toBe(true)
    expect(canReviewWho('admin')).toBe(false)
    expect(canReviewWho('pharmacist')).toBe(false)
    expect(canReviewWho('verifier')).toBe(false)
    expect(canReviewWho(null)).toBe(false)
  })

  it('reserves catalog administration for admins', () => {
    expect(canAdminWho('admin')).toBe(true)
    expect(canAdminWho('reviewer')).toBe(false)
  })
})

describe('WHO public catalog behavior', () => {
  it('normalizes case and punctuation for partial search', () => {
    expect(normalizeWhoSearchQuery('  Acétyl-Salicylic  ')).toBe('acetyl-salicylic')
  })

  it('uses an explicit BPOM disclaimer', () => {
    expect(WHO_BPOM_DISCLAIMER).toContain('tidak menunjukkan status registrasi BPOM')
  })
})

describe('WHO migration safety', () => {
  it('targets Neon Postgres and preserves verification and editorial fields during upsert', () => {
    const sql = readFileSync('database/migrations/003_who_catalog.sql', 'utf8')
    const updateClause = sql.split('on conflict (source_key) do update set')[1].split('where public.who_medicines.payload_checksum')[0]
    expect(updateClause).toBeTruthy()
    expect(updateClause).not.toContain('verification_status =')
    expect(updateClause).not.toContain('editorial_name =')
    expect(sql).toContain('insert into public.who_medicine_verifications')
    const executableSql = sql.replace(/^--.*$/gm, '')
    expect(executableSql).not.toContain('auth.uid()')
    expect(executableSql).not.toContain('service_role')
    expect(executableSql).not.toContain('to anon')
  })
})
