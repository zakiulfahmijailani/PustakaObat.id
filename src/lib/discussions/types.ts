import type { StaffRole } from '@/lib/auth/constants'

export interface DiscussionParticipant {
  id: string
  fullName: string
  role: StaffRole
}

export interface StaffRecipient extends DiscussionParticipant {
  email: string
}

export interface DiscussionSummary {
  id: string
  subject: string
  status: 'open' | 'resolved'
  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt: string
  lastMessage: string
  messageCount: number
  participants: DiscussionParticipant[]
}

export interface DiscussionMessage {
  id: string
  body: string
  createdAt: string
  senderId: string
  senderName: string
  senderRole: StaffRole
}

export interface DiscussionDetails extends DiscussionSummary {
  messages: DiscussionMessage[]
}
