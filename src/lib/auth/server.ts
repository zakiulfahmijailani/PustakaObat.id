import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { queryNeon } from '@/lib/neon/server'
import { AUTH_COOKIE_NAME, SESSION_TTL_SECONDS, type AccountStatus, type StaffRole } from './constants'
import { createSessionToken, getSafeRedirectForAccount, hashSessionToken } from './security'

export interface AuthProfile {
  id: string
  email: string
  full_name: string
  role: StaffRole | 'pharmacist' | 'verifier'
  account_status: AccountStatus
  is_active: boolean
  institution: string | null
  sipa_number: string | null
  professional_license_number: string | null
  phone: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

interface SessionRow extends AuthProfile {
  session_id: string
  expires_at: string
}

export async function getAuthenticatedProfile() {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
  if (!token) return null

  const rows = await queryNeon<SessionRow>(`
    SELECT
      s.id AS session_id,
      s.expires_at,
      p.id,
      p.email,
      p.full_name,
      p.role::text AS role,
      p.account_status,
      p.is_active,
      p.institution,
      p.sipa_number,
      p.professional_license_number,
      p.phone,
      p.avatar_url,
      p.created_at,
      p.updated_at
    FROM public.sessions s
    JOIN public.profiles p ON p.id = s.user_id
    WHERE s.token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
    LIMIT 1
  `, [hashSessionToken(token)])

  const profile = rows[0]
  if (!profile) return null

  return {
    user: { id: profile.id, email: profile.email },
    profile,
    session: { id: profile.session_id, expiresAt: profile.expires_at },
  }
}

export async function getActiveProfile() {
  const session = await getAuthenticatedProfile()
  if (!session) return null
  if (!session.profile.is_active || session.profile.account_status !== 'active') return null
  if (!['reviewer', 'admin'].includes(session.profile.role)) return null
  return session
}

export async function requireActiveProfile(allowedRoles?: StaffRole[]) {
  const session = await getAuthenticatedProfile()
  if (!session) redirect('/login')

  const { profile } = session
  if (!profile.is_active || profile.account_status !== 'active') {
    redirect(getSafeRedirectForAccount(profile.account_status, profile.role))
  }

  if (!['reviewer', 'admin'].includes(profile.role)) redirect('/account/setup-required')
  if (allowedRoles && !allowedRoles.includes(profile.role as StaffRole)) redirect('/dashboard')

  return session
}

export async function createDatabaseSession(userId: string, metadata?: { ipAddress?: string | null; userAgent?: string | null }) {
  const token = createSessionToken()
  const tokenHash = hashSessionToken(token)

  await queryNeon(`
    INSERT INTO public.sessions (user_id, token_hash, expires_at, ip_address, user_agent)
    VALUES ($1, $2, now() + interval '7 days', $3, $4)
  `, [userId, tokenHash, metadata?.ipAddress || null, metadata?.userAgent || null])

  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value

  if (token) {
    await queryNeon(`
      UPDATE public.sessions
      SET revoked_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL
    `, [hashSessionToken(token)])
  }

  cookieStore.delete(AUTH_COOKIE_NAME)
}
