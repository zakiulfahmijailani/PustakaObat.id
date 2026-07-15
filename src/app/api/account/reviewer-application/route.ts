import { NextResponse } from 'next/server'
import { getAuthenticatedProfile } from '@/lib/auth/server'
import { reviewerApplicationUpdateSchema } from '@/lib/auth/schemas'
import { getRequestMetadata, isSameOriginMutation } from '@/lib/auth/request'
import { queryNeon } from '@/lib/neon/server'

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const session = await getAuthenticatedProfile()
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (session.profile.role !== 'reviewer' || session.profile.account_status !== 'needs_revision') {
    return NextResponse.json({ error: 'Pengajuan ini tidak sedang menunggu revisi.' }, { status: 403 })
  }

  const parsed = reviewerApplicationUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Data tidak valid.' }, { status: 400 })
  const metadata = getRequestMetadata(request)

  const rows = await queryNeon<{ id: string }>(`
    WITH updated_profile AS (
      UPDATE public.profiles
      SET institution = $2,
          professional_license_number = $3,
          sipa_number = NULLIF($4, ''),
          phone = NULLIF($5, ''),
          account_status = 'pending_review',
          is_active = false,
          rejected_reason = NULL
      WHERE id = $1 AND account_status = 'needs_revision'
      RETURNING id
    ), updated_application AS (
      UPDATE public.reviewer_applications
      SET institution = $2,
          professional_license_number = $3,
          sipa_number = NULLIF($4, ''),
          phone = NULLIF($5, ''),
          application_status = 'pending',
          submitted_at = now(),
          reviewed_by = NULL,
          reviewed_at = NULL
      WHERE profile_id IN (SELECT id FROM updated_profile)
        AND application_status = 'needs_revision'
      RETURNING profile_id
    ), audit AS (
      INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address)
      SELECT id, 'RESUBMIT_REVIEWER_APPLICATION', 'profile', id,
        jsonb_build_object('institution', $2), $6 FROM updated_profile
    )
    SELECT id FROM updated_profile
  `, [session.profile.id, parsed.data.institution, parsed.data.professionalLicenseNumber, parsed.data.sipaNumber, parsed.data.phone, metadata.ipAddress])

  if (!rows[0]) return NextResponse.json({ error: 'Pengajuan tidak dapat diperbarui.' }, { status: 409 })
  return NextResponse.json({ ok: true, redirectTo: '/pending-approval' })
}

