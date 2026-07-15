import { NextResponse } from 'next/server'
import { getActiveProfile } from '@/lib/auth/server'
import { adminUserActionSchema } from '@/lib/auth/schemas'
import { getRequestMetadata, isSameOriginMutation } from '@/lib/auth/request'
import { queryNeon } from '@/lib/neon/server'

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const session = await getActiveProfile()
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (session.profile.role !== 'admin') return NextResponse.json({ error: 'Insufficient permission.' }, { status: 403 })
  const admin = session.profile
  const metadata = getRequestMetadata(request)
  const parsed = adminUserActionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Permintaan tidak valid.' }, { status: 400 })
  }
  if (parsed.data.profileId === admin.id) {
    return NextResponse.json({ error: 'Admin tidak dapat mengubah status akunnya sendiri.' }, { status: 400 })
  }

  const statusByAction = {
    approve: 'active',
    reject: 'rejected',
    needs_revision: 'needs_revision',
    suspend: 'suspended',
    reactivate: 'active',
  } as const
  const applicationStatusByAction: Record<string, string | null> = {
    approve: 'approved',
    reject: 'rejected',
    needs_revision: 'needs_revision',
    suspend: null,
    reactivate: null,
  }
  const accountStatus = statusByAction[parsed.data.action]
  const applicationStatus = applicationStatusByAction[parsed.data.action]

  const rows = await queryNeon<{ id: string; account_status: string; is_active: boolean }>(`
    WITH updated_profile AS (
      UPDATE public.profiles
      SET account_status = $2,
          is_active = ($2 = 'active'),
          approved_by = CASE WHEN $2 = 'active' THEN $3 ELSE approved_by END,
          approved_at = CASE WHEN $2 = 'active' THEN now() ELSE approved_at END,
          rejected_reason = CASE WHEN $2 IN ('rejected', 'suspended') THEN NULLIF($4, '') ELSE NULL END
      WHERE id = $1 AND role::text = 'reviewer'
      RETURNING id, account_status, is_active
    ), updated_application AS (
      UPDATE public.reviewer_applications
      SET application_status = COALESCE($5, application_status),
          review_note = NULLIF($4, ''),
          reviewed_by = $3,
          reviewed_at = now()
      WHERE profile_id IN (SELECT id FROM updated_profile)
        AND application_status IN ('pending', 'needs_revision')
      RETURNING id
    ), audit AS (
      INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address)
      SELECT $3, 'REVIEWER_ACCOUNT_' || upper($6), 'profile', id,
        jsonb_build_object('account_status', account_status, 'note', NULLIF($4, '')), $7
      FROM updated_profile
    )
    SELECT * FROM updated_profile
  `, [
    parsed.data.profileId,
    accountStatus,
    admin.id,
    parsed.data.note,
    applicationStatus,
    parsed.data.action,
    metadata.ipAddress,
  ])

  if (!rows[0]) return NextResponse.json({ error: 'Akun reviewer tidak ditemukan.' }, { status: 404 })
  return NextResponse.json({ profile: rows[0] })
}
