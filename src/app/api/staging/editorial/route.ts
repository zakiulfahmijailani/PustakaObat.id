import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getActiveProfile } from '@/lib/auth/server'
import { isSameOriginMutation } from '@/lib/auth/request'
import { createEditorialDraftFromAiCandidate, publishApprovedMonograph, reviewEditorialDraft, saveEditorialDraft, selectPilotDrug, submitEditorialDraft } from '@/lib/staging/mutations'

const drugKey = z.string().regex(/^DRUG_[A-Z0-9]+$/)
const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('select_pilot'), drugKey }),
  z.object({ action: z.literal('create_from_ai_candidate'), drugKey, sectionType: z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/) }),
  z.object({
    action: z.literal('save_draft'),
    drugKey,
    sectionType: z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/),
    contentIndonesian: z.string().trim().min(40).max(30000),
  }),
  z.object({ action: z.literal('submit_draft'), draftId: z.string().uuid() }),
  z.object({ action: z.literal('publish_monograph'), drugKey }),
  z.object({
    action: z.literal('review_draft'),
    draftId: z.string().uuid(),
    decision: z.enum(['approve', 'changes_requested']),
    note: z.string().trim().max(4000).nullable().optional(),
  }).superRefine((value, context) => {
    if (value.decision === 'changes_requested' && !value.note) {
      context.addIssue({ code: 'custom', path: ['note'], message: 'Catatan wajib untuk permintaan perubahan.' })
    }
  }),
])

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const session = await getActiveProfile()
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request.' }, { status: 400 })

  try {
    const body = parsed.data
    if (body.action === 'select_pilot') {
      if (session.activeRole !== 'admin') return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 })
      return NextResponse.json({ concept: await selectPilotDrug(body.drugKey, session.user.id) })
    }
    if (body.action === 'create_from_ai_candidate' || body.action === 'save_draft' || body.action === 'submit_draft') {
      if (session.activeRole !== 'editor') return NextResponse.json({ error: 'Editor access is required.' }, { status: 403 })
      if (body.action === 'create_from_ai_candidate') return NextResponse.json({ draft: await createEditorialDraftFromAiCandidate(body.drugKey, body.sectionType, session.user.id) })
      if (body.action === 'save_draft') return NextResponse.json({ draft: await saveEditorialDraft(body.drugKey, body.sectionType, body.contentIndonesian, session.user.id) })
      return NextResponse.json({ draft: await submitEditorialDraft(body.draftId, session.user.id) })
    }
    if (body.action === 'publish_monograph') {
      if (session.activeRole !== 'admin') return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 })
      return NextResponse.json({ publication: await publishApprovedMonograph(body.drugKey, session.user.id) })
    }
    if (session.activeRole !== 'reviewer') return NextResponse.json({ error: 'Reviewer access is required.' }, { status: 403 })
    return NextResponse.json({ draft: await reviewEditorialDraft(body.draftId, body.decision, body.note || null, session.user.id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update staging editorial workflow.' }, { status: 500 })
  }
}
