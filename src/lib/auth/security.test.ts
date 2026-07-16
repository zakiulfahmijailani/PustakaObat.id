import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { getSafeRedirectForAccount, normalizeEmail } from './security'
import { getUnlinkedAccountDestination, parseAuthIntent } from './intent'
import { adminPreauthorizationSchema, reviewerOnboardingSchema } from './schemas'

describe('Neon authentication security helpers', () => {
  it('normalizes email addresses deterministically', () => {
    expect(normalizeEmail('  Reviewer@Apoteq.ID ')).toBe('reviewer@apoteq.id')
  })

  it('routes account states without trusting a client role', () => {
    expect(getSafeRedirectForAccount('active', 'reviewer')).toBe('/reviewer/dashboard')
    expect(getSafeRedirectForAccount('active', 'admin')).toBe('/admin/dashboard')
    expect(getSafeRedirectForAccount('active', 'pharmacist')).toBe('/pending-approval')
    expect(getSafeRedirectForAccount('needs_revision', 'reviewer')).toBe('/account/needs-revision')
    expect(getSafeRedirectForAccount('suspended', 'reviewer')).toBe('/account/suspended')
  })

  it('uses auth intent only to route unlinked Google identities', () => {
    expect(parseAuthIntent('reviewer_login')).toBe('reviewer_login')
    expect(parseAuthIntent('reviewer_register')).toBe('reviewer_register')
    expect(parseAuthIntent('admin_login')).toBe('admin_login')
    expect(parseAuthIntent('admin')).toBeNull()
    expect(parseAuthIntent({ role: 'admin' })).toBeNull()

    expect(getUnlinkedAccountDestination('reviewer_login')).toBe('/reviewer/not-registered')
    expect(getUnlinkedAccountDestination('reviewer_register')).toBe('/reviewer/register/complete')
    expect(getUnlinkedAccountDestination('admin_login')).toBe('/admin/access-denied')
    expect(getUnlinkedAccountDestination(null)).toBe('/masuk')
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

  it('keeps reviewer and admin entry points separate without trusting intent as role', () => {
    const intentRoute = readFileSync('src/app/api/auth/intent/route.ts', 'utf8')
    const postLoginRoute = readFileSync('src/app/auth/post-login/route.ts', 'utf8')
    const authServer = readFileSync('src/lib/auth/server.ts', 'utf8')

    expect(intentRoute).toContain('httpOnly: true')
    expect(intentRoute).toContain("sameSite: 'lax'")
    expect(postLoginRoute).toContain('getSafeRedirectForAccount')
    expect(postLoginRoute).toContain('getUnlinkedAccountDestination')
    expect(authServer).toContain("requireActiveProfile(['reviewer', 'admin'], '/reviewer/not-registered')")
    expect(authServer).toContain("requireActiveProfile(['admin'], '/admin/access-denied')")
    expect(intentRoute).not.toContain('profiles.role')
  })

  it('preauthorizes admins without silently promoting an existing reviewer', () => {
    const bootstrap = readFileSync('scripts/bootstrap-admin.mjs', 'utf8')
    const onboarding = readFileSync('src/app/api/auth/reviewer-onboarding/route.ts', 'utf8')
    const adminUsers = readFileSync('src/app/api/admin/users/route.ts', 'utf8')

    expect(bootstrap).toContain("hasFlag('promote-existing-reviewer')")
    expect(bootstrap).toContain("existing[0].role !== 'admin'")
    expect(bootstrap).not.toContain('INSERT INTO public.users')
    expect(bootstrap).not.toContain('INSERT INTO public.accounts')
    expect(bootstrap).not.toContain('INSERT INTO public.sessions')
    expect(onboarding).toContain("'reviewer'::public.user_role, false, 'pending_review'")
    expect(adminUsers).toContain("session.profile.role !== 'admin'")
    expect(adminUsers).toContain("WHERE id = $1 AND role::text = 'reviewer'")
  })

  it('keeps Admin Management server-controlled and reviewer-safe', () => {
    const valid = adminPreauthorizationSchema.safeParse({
      fullName: 'Admin Baru',
      email: '  Admin.Baru@Example.com ',
    })
    expect(valid.success).toBe(true)
    if (valid.success) expect(valid.data.email).toBe('admin.baru@example.com')

    expect(adminPreauthorizationSchema.safeParse({
      fullName: 'A',
      email: 'bukan-email',
    }).success).toBe(false)

    const adminManagement = readFileSync('src/app/api/admin/admins/route.ts', 'utf8')
    expect(adminManagement).toContain('isSameOriginMutation(request)')
    expect(adminManagement).toContain("session.profile.role !== 'admin'")
    expect(adminManagement).toContain("existing[0].role !== 'admin'")
    expect(adminManagement).toContain("'admin'::public.user_role")
    expect(adminManagement).toContain("'ADMIN_PREAUTHORIZED'")
    expect(adminManagement).not.toContain('INSERT INTO public.users')
    expect(adminManagement).not.toContain('INSERT INTO public.accounts')
    expect(adminManagement).not.toContain('INSERT INTO public.sessions')
  })
})
