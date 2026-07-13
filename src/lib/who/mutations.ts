import { queryNeon } from '@/lib/neon/server'
import type { WhoMedicine } from '@/types'

export type WhoReviewDecision = 'verified' | 'rejected' | 'needs_revision'

export async function reviewWhoMedicine(recordId: string, decision: WhoReviewDecision, note: string | null, actorId: string) {
  const rows = await queryNeon<{ review_who_medicine: WhoMedicine }>(
    'select public.review_who_medicine($1::uuid, $2::text, $3::text, $4::uuid) as review_who_medicine',
    [recordId, decision, note, actorId],
  )
  return rows[0]?.review_who_medicine
}

export async function adminUpdateWhoMedicine(
  recordId: string,
  editorialName: string,
  publicationStatus: WhoMedicine['publication_status'],
  isActive: boolean,
  actorId: string,
) {
  const rows = await queryNeon<{ admin_update_who_medicine: WhoMedicine }>(
    'select public.admin_update_who_medicine($1::uuid, $2::text, $3::text, $4::boolean, $5::uuid) as admin_update_who_medicine',
    [recordId, editorialName, publicationStatus, isActive, actorId],
  )
  return rows[0]?.admin_update_who_medicine
}
