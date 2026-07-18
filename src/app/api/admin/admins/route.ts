import { NextResponse } from 'next/server'
import { getActiveProfile } from '@/lib/auth/server'
import { adminPreauthorizationSchema } from '@/lib/auth/schemas'
import { getRequestMetadata, isSameOriginMutation } from '@/lib/auth/request'
import { queryNeon } from '@/lib/neon/server'

interface ExistingProfile {
  id: string
  role: string
}

interface AdminProfile {
  id: string
  email: string
  full_name: string
  account_status: string
  is_active: boolean
  auth_user_id: number | null
  auth_provider: string | null
  auth_linked_at: string | null
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const session = await getActiveProfile()
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (session.activeRole !== 'admin') {
    return NextResponse.json({ error: 'Insufficient permission.' }, { status: 403 })
  }

  const parsed = adminPreauthorizationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Permintaan tidak valid.' }, { status: 400 })
  }

  const { email, fullName } = parsed.data
  const existing = await queryNeon<ExistingProfile>(`
    SELECT id, role::text AS role
    FROM public.profiles
    WHERE lower(email) = $1
    LIMIT 1
  `, [email])

  if (existing[0] && existing[0].role !== 'admin') {
    return NextResponse.json({
      error: 'Email ini sudah terdaftar sebagai Reviewer. Promosi role tidak dapat dilakukan dari form ini.',
    }, { status: 409 })
  }

  const metadata = getRequestMetadata(request)

  try {
    const rows = existing[0]
      ? await queryNeon<AdminProfile>(`
          WITH updated_admin AS (
            UPDATE public.profiles
            SET full_name = $2,
                role = 'admin'::public.user_role,
                account_status = 'active',
                is_active = true,
                approved_by = $3,
                approved_at = COALESCE(approved_at, now()),
                rejected_reason = NULL
            WHERE id = $1 AND role::text = 'admin'
            RETURNING id, email, full_name, account_status, is_active,
              auth_user_id, auth_provider, auth_linked_at
          ), audit AS (
            INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address)
            SELECT $3, 'ADMIN_PREAUTHORIZATION_UPDATED', 'profile', id,
              jsonb_build_object('email', email, 'provider', 'google'), $4
            FROM updated_admin
          )
          SELECT * FROM updated_admin
        `, [existing[0].id, fullName, session.profile.id, metadata.ipAddress])
      : await queryNeon<AdminProfile>(`
          WITH inserted_admin AS (
            INSERT INTO public.profiles (
              email, password_hash, full_name, role, account_status, is_active,
              approved_by, approved_at, rejected_reason
            )
            VALUES (
              $1, NULL, $2, 'admin'::public.user_role, 'active', true,
              $3, now(), NULL
            )
            RETURNING id, email, full_name, account_status, is_active,
              auth_user_id, auth_provider, auth_linked_at
          ), audit AS (
            INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address)
            SELECT $3, 'ADMIN_PREAUTHORIZED', 'profile', id,
              jsonb_build_object('email', email, 'provider', 'google'), $4
            FROM inserted_admin
          )
          SELECT * FROM inserted_admin
        `, [email, fullName, session.profile.id, metadata.ipAddress])

    if (!rows[0]) return NextResponse.json({ error: 'Profil Admin tidak dapat disimpan.' }, { status: 409 })
    return NextResponse.json({ admin: rows[0] }, { status: existing[0] ? 200 : 201 })
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      return NextResponse.json({ error: 'Email atau identitas Google sudah digunakan profil lain.' }, { status: 409 })
    }
    console.error('Admin preauthorization failed', error)
    return NextResponse.json({ error: 'Admin belum dapat disimpan. Coba kembali.' }, { status: 500 })
  }
}
