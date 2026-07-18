import { NextResponse } from 'next/server'
import { getActiveProfile } from '@/lib/auth/server'
import { getRequestMetadata, isSameOriginMutation } from '@/lib/auth/request'
import { discussionIdSchema, discussionStatusSchema } from '@/lib/discussions/schemas'
import { queryNeon } from '@/lib/neon/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 403 })
  }

  const session = await getActiveProfile()
  if (!session) return NextResponse.json({ error: 'Akses staf diperlukan.' }, { status: 403 })

  const id = discussionIdSchema.safeParse((await params).id)
  const body = discussionStatusSchema.safeParse(await request.json().catch(() => null))
  if (!id.success || !body.success) {
    return NextResponse.json({ error: 'Status percakapan tidak valid.' }, { status: 400 })
  }

  const metadata = getRequestMetadata(request)
  const rows = await queryNeon<{ id: string }>(`
    with allowed as (
      select discussion.id
      from public.internal_discussions discussion
      join public.internal_discussion_participants participant on participant.discussion_id = discussion.id
      where discussion.id = $1 and participant.profile_id = $2
    ), updated as (
      update public.internal_discussions discussion
      set status = $3
      from allowed
      where discussion.id = allowed.id
      returning discussion.id
    ), audit as (
      insert into public.audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address)
      select $2, 'INTERNAL_DISCUSSION_STATUS_CHANGED', 'internal_discussion', id,
        jsonb_build_object('status', $3::text), $4
      from updated
    )
    select id from updated
  `, [id.data, session.profile.id, body.data.status, metadata.ipAddress])

  if (!rows[0]) return NextResponse.json({ error: 'Percakapan tidak ditemukan atau Anda bukan peserta.' }, { status: 404 })
  return NextResponse.json({ status: body.data.status })
}
