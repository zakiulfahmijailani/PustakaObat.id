import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { queryNeon } from '@/lib/neon/server'
import { createDatabaseSession } from '@/lib/auth/server'
import { loginSchema } from '@/lib/auth/schemas'
import { getSafeRedirectForAccount, normalizeEmail } from '@/lib/auth/security'
import { getRequestMetadata, isSameOriginMutation } from '@/lib/auth/request'

export const runtime = 'nodejs'

interface LoginProfile {
  id: string
  email: string
  password_hash: string
  role: string
  account_status: string
  is_active: boolean
}

const DUMMY_HASH = '$2b$12$rh7Xj7ksB7cG3PTeDGQZxuRnyhKnUMGOomTMs5ZoiRu6R40ap89dG'

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const metadata = getRequestMetadata(request)
  const parsed = loginSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Data login tidak valid.' }, { status: 400 })
  }

  const email = normalizeEmail(parsed.data.email)
  const attempts = await queryNeon<{ email_failures: number; ip_failures: number }>(`
    SELECT
      count(*) FILTER (WHERE email_key = $1)::int AS email_failures,
      count(*) FILTER (WHERE $2::text IS NOT NULL AND ip_address = $2)::int AS ip_failures
    FROM public.auth_login_attempts
    WHERE succeeded = false
      AND attempted_at > now() - interval '15 minutes'
      AND (email_key = $1 OR ($2::text IS NOT NULL AND ip_address = $2))
  `, [email, metadata.ipAddress])

  if ((attempts[0]?.email_failures || 0) >= 5 || (attempts[0]?.ip_failures || 0) >= 20) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' }, { status: 429 })
  }

  const profiles = await queryNeon<LoginProfile>(`
    SELECT id, email, password_hash, role::text AS role, account_status, is_active
    FROM public.profiles
    WHERE lower(email) = $1
    LIMIT 1
  `, [email])
  const profile = profiles[0]
  const passwordValid = await bcrypt.compare(parsed.data.password, profile?.password_hash || DUMMY_HASH)

  await queryNeon(`
    INSERT INTO public.auth_login_attempts (email_key, ip_address, succeeded)
    VALUES ($1, $2, $3)
  `, [email, metadata.ipAddress, Boolean(profile && passwordValid)])

  if (!profile || !passwordValid) {
    return NextResponse.json({ error: 'Email atau password tidak sesuai.' }, { status: 401 })
  }

  if (profile.account_status === 'rejected' || profile.account_status === 'suspended') {
    return NextResponse.json({
      error: profile.account_status === 'suspended' ? 'Akun ini sedang ditangguhkan.' : 'Pengajuan akun ini tidak disetujui.',
      redirectTo: getSafeRedirectForAccount(profile.account_status, profile.role),
    }, { status: 403 })
  }

  await queryNeon(`
    DELETE FROM public.sessions WHERE expires_at <= now() OR revoked_at IS NOT NULL;
  `)
  await createDatabaseSession(profile.id, metadata)
  await queryNeon(`
    WITH updated AS (
      UPDATE public.profiles SET last_login_at = now() WHERE id = $1 RETURNING id
    )
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address)
    SELECT id, 'LOGIN', 'profile', id, jsonb_build_object('account_status', $2), $3 FROM updated
  `, [profile.id, profile.account_status, metadata.ipAddress])

  return NextResponse.json({
    ok: true,
    redirectTo: getSafeRedirectForAccount(profile.account_status, profile.role),
  })
}
