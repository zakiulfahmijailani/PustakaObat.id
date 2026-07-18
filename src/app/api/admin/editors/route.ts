import { NextResponse } from 'next/server'
import { getActiveProfile } from '@/lib/auth/server'
import { adminPreauthorizationSchema } from '@/lib/auth/schemas'
import { getRequestMetadata, isSameOriginMutation } from '@/lib/auth/request'
import { queryNeon } from '@/lib/neon/server'

interface ExistingProfile { id: string; role: string }

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const session = await getActiveProfile()
  if (!session || session.activeRole !== 'admin') return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 })
  const parsed = adminPreauthorizationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Permintaan tidak valid.' }, { status: 400 })
  const { email, fullName } = parsed.data
  const existing = await queryNeon<ExistingProfile>('select id, role::text as role from public.profiles where lower(email) = $1 limit 1', [email])
  if (existing[0] && existing[0].role !== 'editor') return NextResponse.json({ error: 'Email ini sudah memiliki peran lain. Gunakan proses perubahan role yang teraudit.' }, { status: 409 })
  const metadata = getRequestMetadata(request)
  try {
    const rows = existing[0] ? await queryNeon<{ id: string; email: string; full_name: string }>(`with updated as (update public.profiles set full_name = $2, account_status = 'active', is_active = true, approved_by = $3, approved_at = coalesce(approved_at, now()), rejected_reason = null where id = $1 and role::text = 'editor' returning id, email, full_name), audit as (insert into public.audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address) select $3, 'EDITOR_PREAUTHORIZATION_UPDATED', 'profile', id, jsonb_build_object('email', email, 'provider', 'google'), $4 from updated) select * from updated`, [existing[0].id, fullName, session.profile.id, metadata.ipAddress]) : await queryNeon<{ id: string; email: string; full_name: string }>(`with inserted as (insert into public.profiles (email, password_hash, full_name, role, account_status, is_active, approved_by, approved_at, rejected_reason) values ($1, null, $2, 'editor'::public.user_role, 'active', true, $3, now(), null) returning id, email, full_name), audit as (insert into public.audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address) select $3, 'EDITOR_PREAUTHORIZED', 'profile', id, jsonb_build_object('email', email, 'provider', 'google'), $4 from inserted) select * from inserted`, [email, fullName, session.profile.id, metadata.ipAddress])
    if (!rows[0]) return NextResponse.json({ error: 'Profil Editor tidak dapat disimpan.' }, { status: 409 })
    return NextResponse.json({ editor: rows[0] }, { status: existing[0] ? 200 : 201 })
  } catch (error) { console.error('Editor preauthorization failed', error); return NextResponse.json({ error: 'Editor belum dapat disimpan. Coba kembali.' }, { status: 500 }) }
}
