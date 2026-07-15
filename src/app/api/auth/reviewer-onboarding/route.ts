import { NextResponse } from 'next/server'
import { queryNeon } from '@/lib/neon/server'
import { reviewerOnboardingSchema } from '@/lib/auth/schemas'
import { getGoogleIdentity, linkExistingProfile } from '@/lib/auth/server'
import { getSafeRedirectForAccount } from '@/lib/auth/security'
import { getRequestMetadata, isSameOriginMutation } from '@/lib/auth/request'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const identity = await getGoogleIdentity()
  if (!identity) return NextResponse.json({ error: 'Sesi Google tidak ditemukan.' }, { status: 401 })

  const existingProfile = await linkExistingProfile(identity)
  if (existingProfile) {
    return NextResponse.json({
      ok: true,
      redirectTo: getSafeRedirectForAccount(existingProfile.account_status, existingProfile.role),
    })
  }

  const parsed = reviewerOnboardingSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Data pendaftaran tidak valid.' }, { status: 400 })
  }

  const metadata = getRequestMetadata(request)
  if (metadata.ipAddress) {
    const recent = await queryNeon<{ count: number }>(`
      SELECT count(*)::int AS count
      FROM public.audit_logs
      WHERE action = 'REVIEWER_ONBOARDING_COMPLETED'
        AND ip_address = $1
        AND created_at > now() - interval '1 hour'
    `, [metadata.ipAddress])

    if ((recent[0]?.count || 0) >= 3) {
      return NextResponse.json({ error: 'Terlalu banyak pendaftaran. Coba kembali beberapa saat lagi.' }, { status: 429 })
    }
  }

  try {
    const rows = await queryNeon<{ profile_id: string }>(`
      WITH new_profile AS (
        INSERT INTO public.profiles (
          email, password_hash, full_name, role, is_active, account_status,
          institution, sipa_number, phone, professional_license_number,
          avatar_url, auth_user_id, auth_provider, auth_linked_at, last_login_at
        ) VALUES (
          $1, NULL, $2, 'reviewer'::public.user_role, false, 'pending_review',
          $3, NULLIF($4, ''), NULLIF($5, ''), $6,
          $7, $8, 'google', now(), now()
        )
        RETURNING id
      ), new_application AS (
        INSERT INTO public.reviewer_applications (
          profile_id, institution, professional_license_number, sipa_number, phone
        )
        SELECT id, $3, $6, NULLIF($4, ''), NULLIF($5, '') FROM new_profile
        RETURNING id, profile_id
      ), audit AS (
        INSERT INTO public.audit_logs (
          user_id, action, resource_type, resource_id, metadata, ip_address
        )
        SELECT profile_id, 'REVIEWER_ONBOARDING_COMPLETED', 'reviewer_application', id,
          jsonb_build_object('email', $1, 'institution', $3, 'provider', 'google'), $9
        FROM new_application
      )
      SELECT profile_id FROM new_application
    `, [
      identity.email,
      parsed.data.fullName,
      parsed.data.institution,
      parsed.data.sipaNumber,
      parsed.data.phone,
      parsed.data.professionalLicenseNumber,
      identity.image,
      identity.authUserId,
      metadata.ipAddress,
    ])

    if (!rows[0]) throw new Error('Reviewer application was not created.')
    return NextResponse.json({ ok: true, redirectTo: '/pending-approval' }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('profiles_email') || message.includes('profiles_auth_user_id') || message.includes('duplicate key')) {
      return NextResponse.json({ error: 'Akun Google ini sudah terhubung ke profil Apoteq.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Pendaftaran belum dapat diproses. Silakan coba lagi.' }, { status: 500 })
  }
}

