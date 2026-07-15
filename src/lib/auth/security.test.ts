import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { getSafeRedirectForAccount, normalizeEmail } from './security'
import { reviewerOnboardingSchema } from './schemas'

describe('Neon authentication security helpers', () => {
  it('normalizes email addresses deterministically', () => {
    expect(normalizeEmail('  Reviewer@Apoteq.ID ')).toBe('reviewer@apoteq.id')
  })

  it('routes account states without trusting a client role', () => {
    expect(getSafeRedirectForAccount('active', 'reviewer')).toBe('/dashboard')
    expect(getSafeRedirectForAccount('active', 'admin')).toBe('/dashboard')
    expect(getSafeRedirectForAccount('active', 'pharmacist')).toBe('/pending-approval')
    expect(getSafeRedirectForAccount('needs_revision', 'reviewer')).toBe('/account/needs-revision')
    expect(getSafeRedirectForAccount('suspended', 'reviewer')).toBe('/account/suspended')
  })

  it('requires professional identity without accepting password or role input', () => {
    const valid = reviewerOnboardingSchema.safeParse({
      fullName: 'Ayu Reviewer, Apt.',
      institution: 'Apotek Contoh',
      professionalLicenseNumber: 'STRA-12345',
      sipaNumber: '',
      phone: '',
    })
    expect(valid.success).toBe(true)

    const invalid = reviewerOnboardingSchema.safeParse({
      fullName: 'Ayu Reviewer, Apt.',
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

  it('migrates password sessions to Auth.js database sessions without deleting rollback data', () => {
    const migration = readFileSync('database/migrations/005_google_auth_neon.sql', 'utf8')
    expect(migration).toContain('RENAME TO legacy_password_sessions')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.users')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.accounts')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.sessions')
    expect(migration).toContain('auth_user_id')
    expect(migration).toContain("auth_provider = 'google'")
    expect(migration).not.toContain('DROP TABLE')
  })

  it('enables only verified Google OAuth and retires password endpoints', () => {
    const authConfig = readFileSync('src/auth.ts', 'utf8')
    const loginRoute = readFileSync('src/app/api/auth/login/route.ts', 'utf8')
    const registerRoute = readFileSync('src/app/api/auth/register/route.ts', 'utf8')

    expect(authConfig).toContain("Google({")
    expect(authConfig).toContain('googleProfile.email_verified')
    expect(authConfig).toContain('PostgresAdapter')
    expect(authConfig).not.toContain('Credentials(')
    expect(loginRoute).toContain('status: 410')
    expect(registerRoute).toContain('status: 410')
  })
})
