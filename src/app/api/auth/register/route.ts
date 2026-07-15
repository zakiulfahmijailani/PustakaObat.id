import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { queryNeon } from '@/lib/neon/server'
import { reviewerRegistrationSchema } from '@/lib/auth/schemas'
import { normalizeEmail } from '@/lib/auth/security'
import { getRequestMetadata, isSameOriginMutation } from '@/lib/auth/request'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const metadata = getRequestMetadata(request)
  const parsed = reviewerRegistrationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Data pendaftaran tidak valid.' }, { status: 400 })
  }

  const email = normalizeEmail(parsed.data.email)

  if (metadata.ipAddress) {
    const recent = await queryNeon<{ count: number }>(`
      SELECT count(*)::int AS count
      FROM public.audit_logs
      WHERE action = 'REGISTER_REVIEWER'
        AND ip_address = $1
        AND created_at > now() - interval '1 hour'
    `, [metadata.ipAddress])

    if ((recent[0]?.count || 0) >= 3) {
      return NextResponse.json({ error: 'Terlalu banyak pendaftaran. Coba kembali beberapa saat lagi.' }, { status: 429 })
    }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  try {
    const rows = await queryNeon<{ profile_id: string }>(`
      WITH new_profile AS (
        INSERT INTO public.profiles (
          email, password_hash, full_name, role, is_active, account_status,
          institution, sipa_number, phone, professional_license_number
        ) VALUES (
          $1, $2, $3, 'reviewer'::public.user_role, false, 'pending_review',
          $4, NULLIF($5, ''), NULLIF($6, ''), $7
        )
        RETURNING id
      ), new_application AS (
        INSERT INTO public.reviewer_applications (
          profile_id, institution, professional_license_number, sipa_number, phone
        )
        SELECT id, $4, $7, NULLIF($5, ''), NULLIF($6, '') FROM new_profile
        RETURNING id, profile_id
      ), audit AS (
        INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address)
        SELECT profile_id, 'REGISTER_REVIEWER', 'reviewer_application', id,
          jsonb_build_object('email', $1, 'institution', $4), $8
        FROM new_application
      )
      SELECT profile_id FROM new_application
    `, [
      email,
      passwordHash,
      parsed.data.fullName,
      parsed.data.institution,
      parsed.data.sipaNumber,
      parsed.data.phone,
      parsed.data.professionalLicenseNumber,
      metadata.ipAddress,
    ])

    if (!rows[0]) throw new Error('Reviewer application was not created.')
    return NextResponse.json({ ok: true, redirectTo: '/pending-approval' }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('profiles_email') || message.includes('duplicate key')) {
      return NextResponse.json({ error: 'Email tersebut sudah terdaftar.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Pendaftaran belum dapat diproses. Silakan coba lagi.' }, { status: 500 })
  }
}
