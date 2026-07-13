import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { canAdminWho, canReviewWho } from '@/lib/auth/permissions'
import { WHO_BPOM_DISCLAIMER } from './constants'
import { normalizeWhoSearchQuery } from './queries'

describe('WHO authorization policy', () => {
  it('allows pharmacy staff to review but blocks public users', () => {
    expect(canReviewWho('pharmacist')).toBe(true)
    expect(canReviewWho('verifier')).toBe(true)
    expect(canReviewWho('admin')).toBe(true)
    expect(canReviewWho(null)).toBe(false)
  })

  it('reserves catalog administration for admins', () => {
    expect(canAdminWho('admin')).toBe(true)
    expect(canAdminWho('pharmacist')).toBe(false)
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
  it('uses upsert without overwriting verification or editorial fields', () => {
    const sql = readFileSync('supabase/migrations/003_who_catalog.sql', 'utf8')
    const updateClause = sql.split('on conflict (source_key) do update set')[1].split('where public.who_medicines.payload_checksum')[0]
    expect(updateClause).toBeTruthy()
    expect(updateClause).not.toContain('verification_status =')
    expect(updateClause).not.toContain('editorial_name =')
    expect(sql).toContain('insert into public.who_medicine_verifications')
  })
})
