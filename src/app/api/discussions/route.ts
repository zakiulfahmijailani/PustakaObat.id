import { NextResponse } from 'next/server'
import { ACTIVE_STAFF_ROLES } from '@/lib/auth/constants'
import { getActiveProfile } from '@/lib/auth/server'
import { getRequestMetadata, isSameOriginMutation } from '@/lib/auth/request'
import { createDiscussionSchema } from '@/lib/discussions/schemas'
import { queryNeon } from '@/lib/neon/server'

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 403 })
  }

  const session = await getActiveProfile()
  if (!session || !ACTIVE_STAFF_ROLES.includes(session.profile.role as typeof ACTIVE_STAFF_ROLES[number])) {
    return NextResponse.json({ error: 'Akses staf diperlukan.' }, { status: 403 })
  }

  const parsed = createDiscussionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Data percakapan tidak valid.' }, { status: 400 })
  }

  const participantIds = parsed.data.participantIds.filter((id) => id !== session.profile.id)
  if (participantIds.length === 0) {
    return NextResponse.json({ error: 'Pilih minimal satu penerima selain diri Anda.' }, { status: 400 })
  }

  const eligibleRecipients = await queryNeon<{ id: string }>(`
    select id
    from public.profiles
    where id = any($1::uuid[])
      and role::text = any($2::text[])
      and account_status = 'active'
      and is_active = true
  `, [participantIds, [...ACTIVE_STAFF_ROLES]])

  if (eligibleRecipients.length !== participantIds.length) {
    return NextResponse.json({ error: 'Salah satu penerima tidak tersedia atau tidak memiliki akses staf.' }, { status: 400 })
  }

  const metadata = getRequestMetadata(request)
  const rows = await queryNeon<{ id: string }>(`
    with discussion as (
      insert into public.internal_discussions (subject, created_by)
      values ($1, $2)
      returning id
    ), participants as (
      insert into public.internal_discussion_participants (discussion_id, profile_id)
      select discussion.id, participant.profile_id
      from discussion
      cross join unnest(array_append($3::uuid[], $2::uuid)) as participant(profile_id)
      on conflict do nothing
    ), first_message as (
      insert into public.internal_discussion_messages (discussion_id, sender_id, body)
      select id, $2, $4 from discussion
      returning discussion_id
    ), audit as (
      insert into public.audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address)
      select $2, 'INTERNAL_DISCUSSION_CREATED', 'internal_discussion', id,
        jsonb_build_object('participant_count', $5::int), $6
      from discussion
    )
    select id from discussion
  `, [parsed.data.subject, session.profile.id, participantIds, parsed.data.message, participantIds.length + 1, metadata.ipAddress])

  return NextResponse.json({ discussionId: rows[0].id }, { status: 201 })
}
