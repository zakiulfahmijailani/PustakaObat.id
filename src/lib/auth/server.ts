import 'server-only'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { queryNeon } from '@/lib/neon/server'
import { ACTIVE_STAFF_ROLES, WORKSPACE_ROLES, type AccountStatus, type StaffRole, type WorkspaceRole } from './constants'
import { getSafeRedirectForAccount, normalizeEmail } from './security'

export interface AuthProfile {
  id: string
  auth_user_id: number
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

interface GoogleIdentity {
  authUserId: number
  email: string
  name: string
  image: string | null
}

const PROFILE_COLUMNS = `
  p.id,
  p.auth_user_id,
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
`

function parseAuthUserId(value: string) {
  if (!/^\d+$/.test(value)) throw new Error('Invalid Auth.js user identifier.')
  return Number(value)
}

export async function getGoogleIdentity(): Promise<GoogleIdentity | null> {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) return null

  return {
    authUserId: parseAuthUserId(session.user.id),
    email: normalizeEmail(session.user.email),
    name: session.user.name?.trim() || 'Pengguna Apoteq',
    image: session.user.image || null,
  }
}

async function findProfileByAuthUserId(authUserId: number) {
  const rows = await queryNeon<AuthProfile>(`
    SELECT ${PROFILE_COLUMNS}
    FROM public.profiles p
    WHERE p.auth_user_id = $1
    LIMIT 1
  `, [authUserId])

  return rows[0] || null
}

export async function linkExistingProfile(identity: GoogleIdentity) {
  const linked = await findProfileByAuthUserId(identity.authUserId)
  if (linked) return linked

  const candidates = await queryNeon<{ id: string; auth_user_id: number | null }>(`
    SELECT id, auth_user_id
    FROM public.profiles
    WHERE lower(email) = $1
    LIMIT 1
  `, [identity.email])
  const candidate = candidates[0]

  if (!candidate) return null
  if (candidate.auth_user_id && candidate.auth_user_id !== identity.authUserId) {
    throw new Error('Google identity conflict for an existing Apoteq profile.')
  }

  const rows = await queryNeon<AuthProfile>(`
    WITH linked AS (
      UPDATE public.profiles p
      SET auth_user_id = $1,
          auth_provider = 'google',
          auth_linked_at = COALESCE(auth_linked_at, now()),
          avatar_url = COALESCE(avatar_url, $3),
          last_login_at = now()
      WHERE p.id = $2
        AND (p.auth_user_id IS NULL OR p.auth_user_id = $1)
      RETURNING p.*
    ), audit AS (
      INSERT INTO public.audit_logs (
        user_id, action, resource_type, resource_id, metadata
      )
      SELECT id, 'GOOGLE_AUTH_PROFILE_LINKED', 'profile', id,
        jsonb_build_object('auth_user_id', auth_user_id, 'provider', 'google')
      FROM linked
    )
    SELECT
      p.id,
      p.auth_user_id,
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
    FROM linked p
  `, [identity.authUserId, candidate.id, identity.image])

  return rows[0] || null
}

export async function getAuthenticatedProfile(options: { linkByVerifiedEmail?: boolean } = {}) {
  const identity = await getGoogleIdentity()
  if (!identity) return null

  let profile: AuthProfile | null = await findProfileByAuthUserId(identity.authUserId)
  if (!profile && options.linkByVerifiedEmail) profile = await linkExistingProfile(identity)
  if (!profile) return null

  return {
    user: { id: profile.id, authUserId: identity.authUserId, email: profile.email },
    profile,
    session: { provider: 'google' as const },
  }
}

export const WORKSPACE_COOKIE = 'pustakaobat_workspace'

async function getWorkspaceRole(profile: AuthProfile): Promise<WorkspaceRole | null> {
  if (profile.role !== 'super_admin') return profile.role as WorkspaceRole
  const value = (await cookies()).get(WORKSPACE_COOKIE)?.value
  return WORKSPACE_ROLES.includes(value as WorkspaceRole) ? value as WorkspaceRole : null
}

export async function getActiveProfile() {
  const session = await getAuthenticatedProfile()
  if (!session) return null
  if (!session.profile.is_active || session.profile.account_status !== 'active') return null
  if (!ACTIVE_STAFF_ROLES.includes(session.profile.role as StaffRole)) return null
  const activeRole = await getWorkspaceRole(session.profile)
  if (!activeRole) return null
  return { ...session, activeRole }
}

export async function requireActiveProfile(
  allowedRoles?: StaffRole[],
  missingProfileDestination = '/masuk',
) {
  const identity = await getGoogleIdentity()
  if (!identity) redirect('/masuk')

  const session = await getAuthenticatedProfile({ linkByVerifiedEmail: true })
  if (!session) redirect(missingProfileDestination)

  const { profile } = session
  if (!profile.is_active || profile.account_status !== 'active') {
    redirect(getSafeRedirectForAccount(profile.account_status, profile.role))
  }

  if (!ACTIVE_STAFF_ROLES.includes(profile.role as StaffRole)) redirect('/account/setup-required')
  const activeRole = await getWorkspaceRole(profile)
  if (!activeRole) redirect('/super-admin/choose-role')
  if (allowedRoles && !allowedRoles.includes(activeRole as StaffRole)) {
    redirect(getSafeRedirectForAccount(profile.account_status, profile.role))
  }

  return { ...session, activeRole }
}

export function requireReviewer() {
  return requireActiveProfile(['reviewer'], '/reviewer/not-registered')
}

export function requireAdmin() {
  return requireActiveProfile(['admin'], '/admin/access-denied')
}

export function requireEditor() {
  return requireActiveProfile(['editor'], '/editor/access-denied')
}

export async function requireSuperAdmin() {
  const identity = await getGoogleIdentity()
  if (!identity) redirect('/super-admin/login')
  const session = await getAuthenticatedProfile({ linkByVerifiedEmail: true })
  if (!session || !session.profile.is_active || session.profile.account_status !== 'active' || session.profile.role !== 'super_admin') {
    redirect('/super-admin/access-denied')
  }
  return session
}

export const requireReviewerOrAdmin = requireReviewer
