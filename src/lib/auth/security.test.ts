import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createSessionToken, getSafeRedirectForAccount, hashSessionToken, normalizeEmail } from './security'
import { reviewerRegistrationSchema } from './schemas'

describe('Neon authentication security helpers', () => {
  it('normalizes email addresses deterministically', () => {
    expect(normalizeEmail('  Reviewer@Apoteq.ID ')).toBe('reviewer@apoteq.id')
  })

  it('generates opaque tokens and stores a stable hash', () => {
    const token = createSessionToken()
    expect(token.length).toBeGreaterThan(32)
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashSessionToken(token)).not.toBe(token)
  })

  it('routes account states without trusting a client role', () => {
    expect(getSafeRedirectForAccount('active', 'reviewer')).toBe('/dashboard')
    expect(getSafeRedirectForAccount('active', 'admin')).toBe('/dashboard')
    expect(getSafeRedirectForAccount('active', 'pharmacist')).toBe('/pending-approval')
    expect(getSafeRedirectForAccount('needs_revision', 'reviewer')).toBe('/account/needs-revision')
    expect(getSafeRedirectForAccount('suspended', 'reviewer')).toBe('/account/suspended')
  })

  it('requires a strong reviewer password and professional identity', () => {
    const valid = reviewerRegistrationSchema.safeParse({
      fullName: 'Ayu Reviewer, Apt.',
      email: 'ayu@example.com',
      password: 'Reviewer2026',
      institution: 'Apotek Contoh',
      professionalLicenseNumber: 'STRA-12345',
      sipaNumber: '',
      phone: '',
    })
    expect(valid.success).toBe(true)

    const invalid = reviewerRegistrationSchema.safeParse({
      fullName: 'Ayu Reviewer, Apt.',
      email: 'ayu@example.com',
      password: 'weak',
      institution: 'Apotek Contoh',
      professionalLicenseNumber: '',
    })
    expect(invalid.success).toBe(false)
  })

  it('uses a Neon-only schema and suspends unrotated legacy accounts', () => {
    const migration = readFileSync('database/migrations/004_neon_auth.sql', 'utf8')
    expect(migration).toContain('token_hash')
    expect(migration).toContain("Legacy account requires credential rotation")
    expect(migration).not.toContain('auth.uid()')
    expect(migration).not.toContain('service_role')
  })
})
