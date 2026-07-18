import 'server-only'

import { ACTIVE_STAFF_ROLES } from '@/lib/auth/constants'
import { queryNeon } from '@/lib/neon/server'
import type {
  DiscussionDetails,
  DiscussionMessage,
  DiscussionParticipant,
  DiscussionSummary,
  StaffRecipient,
} from './types'

interface RawDiscussion {
  id: string
  subject: string
  status: 'open' | 'resolved'
  created_by: string
  created_by_name: string
  created_at: string
  updated_at: string
  last_message: string | null
  message_count: number
  participants: Array<{ id: string; full_name: string; role: DiscussionParticipant['role'] }>
}

function mapDiscussion(row: RawDiscussion): DiscussionSummary {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessage: row.last_message || '',
    messageCount: Number(row.message_count),
    participants: row.participants.map((participant) => ({
      id: participant.id,
      fullName: participant.full_name,
      role: participant.role,
    })),
  }
}

export async function getDiscussionRecipients(viewerId: string) {
  const rows = await queryNeon<{ id: string; full_name: string; email: string; role: StaffRecipient['role'] }>(`
    select id, full_name, email, role::text as role
    from public.profiles
    where id <> $1
      and role::text = any($2::text[])
      and account_status = 'active'
      and is_active = true
    order by
      case role::text when 'super_admin' then 0 when 'admin' then 1 when 'reviewer' then 2 else 3 end,
      full_name
  `, [viewerId, [...ACTIVE_STAFF_ROLES]])

  return rows.map((row) => ({ id: row.id, fullName: row.full_name, email: row.email, role: row.role }))
}

export async function getDiscussionSummaries(viewerId: string) {
  const rows = await queryNeon<RawDiscussion>(`
    select
      d.id,
      d.subject,
      d.status,
      d.created_by,
      creator.full_name as created_by_name,
      d.created_at,
      d.updated_at,
      (select body from public.internal_discussion_messages where discussion_id = d.id order by created_at desc limit 1) as last_message,
      (select count(*)::int from public.internal_discussion_messages where discussion_id = d.id) as message_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object('id', participant.id, 'full_name', participant.full_name, 'role', participant.role::text)
          order by participant.full_name
        ) filter (where participant.id is not null),
        '[]'::jsonb
      ) as participants
    from public.internal_discussions d
    join public.internal_discussion_participants mine
      on mine.discussion_id = d.id and mine.profile_id = $1
    join public.profiles creator on creator.id = d.created_by
    join public.internal_discussion_participants membership on membership.discussion_id = d.id
    join public.profiles participant on participant.id = membership.profile_id
    group by d.id, creator.full_name
    order by d.updated_at desc
    limit 100
  `, [viewerId])

  return rows.map(mapDiscussion)
}

export async function getDiscussionDetails(viewerId: string, discussionId: string) {
  const summaries = await queryNeon<RawDiscussion>(`
    select
      d.id,
      d.subject,
      d.status,
      d.created_by,
      creator.full_name as created_by_name,
      d.created_at,
      d.updated_at,
      (select body from public.internal_discussion_messages where discussion_id = d.id order by created_at desc limit 1) as last_message,
      (select count(*)::int from public.internal_discussion_messages where discussion_id = d.id) as message_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object('id', participant.id, 'full_name', participant.full_name, 'role', participant.role::text)
          order by participant.full_name
        ) filter (where participant.id is not null),
        '[]'::jsonb
      ) as participants
    from public.internal_discussions d
    join public.internal_discussion_participants mine
      on mine.discussion_id = d.id and mine.profile_id = $1
    join public.profiles creator on creator.id = d.created_by
    join public.internal_discussion_participants membership on membership.discussion_id = d.id
    join public.profiles participant on participant.id = membership.profile_id
    where d.id = $2
    group by d.id, creator.full_name
  `, [viewerId, discussionId])

  if (!summaries[0]) return null

  const messages = await queryNeon<{
    id: string
    body: string
    created_at: string
    sender_id: string
    sender_name: string
    sender_role: DiscussionMessage['senderRole']
  }>(`
    select
      message.id,
      message.body,
      message.created_at,
      message.sender_id,
      sender.full_name as sender_name,
      sender.role::text as sender_role
    from public.internal_discussion_messages message
    join public.profiles sender on sender.id = message.sender_id
    where message.discussion_id = $1
    order by message.created_at
  `, [discussionId])

  return {
    ...mapDiscussion(summaries[0]),
    messages: messages.map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.created_at,
      senderId: message.sender_id,
      senderName: message.sender_name,
      senderRole: message.sender_role,
    })),
  } satisfies DiscussionDetails
}
