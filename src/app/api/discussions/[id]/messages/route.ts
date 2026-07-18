import { NextResponse } from 'next/server'
import { getActiveProfile } from '@/lib/auth/server'
import { getRequestMetadata, isSameOriginMutation } from '@/lib/auth/request'
import { discussionIdSchema, discussionMessageSchema } from '@/lib/discussions/schemas'
import { queryNeon } from '@/lib/neon/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 403 })
  }

  const session = await getActiveProfile()
  if (!session) return NextResponse.json({ error: 'Akses staf diperlukan.' }, { status: 403 })

  const id = discussionIdSchema.safeParse((await params).id)
  const body = discussionMessageSchema.safeParse(await request.json().catch(() => null))
  if (!id.success || !body.success) {
    return NextResponse.json({ error: id.error?.issues[0]?.message || body.error?.issues[0]?.message || 'Pesan tidak valid.' }, { status: 400 })
  }

  const metadata = getRequestMetadata(request)
  const rows = await queryNeon<{ id: string }>(`
    with allowed as (
      select discussion.id
      from public.internal_discussions discussion
      join public.internal_discussion_participants participant on participant.discussion_id = discussion.id
      where discussion.id = $1 and participant.profile_id = $2
    ), message as (
      insert into public.internal_discussion_messages (discussion_id, sender_id, body)
      select id, $2, $3 from allowed
      returning id, discussion_id
    ), touched as (
      update public.internal_discussions
      set updated_at = now()
      where id = (select discussion_id from message)
    ), audit as (
      insert into public.audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address)
      select $2, 'INTERNAL_DISCUSSION_MESSAGE_SENT', 'internal_discussion', discussion_id,
        jsonb_build_object('message_id', id), $4
      from message
    )
    select id from message
  `, [id.data, session.profile.id, body.data.message, metadata.ipAddress])

  if (!rows[0]) return NextResponse.json({ error: 'Percakapan tidak ditemukan atau Anda bukan peserta.' }, { status: 404 })
  return NextResponse.json({ messageId: rows[0].id }, { status: 201 })
}
