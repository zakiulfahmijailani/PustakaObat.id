import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getActiveProfile } from '@/lib/auth/server'
import { canReviewWho } from '@/lib/auth/permissions'
import { reviewWhoMedicine } from '@/lib/who/mutations'

const reviewSchema = z.object({
  medicineId: z.string().uuid(),
  decision: z.enum(['verified', 'rejected', 'needs_revision']),
  note: z.string().trim().max(4000).nullable().optional(),
}).superRefine((value, context) => {
  if (value.decision !== 'verified' && !value.note) {
    context.addIssue({ code: 'custom', path: ['note'], message: 'A review note is required.' })
  }
})

export async function POST(request: Request) {
  const session = await getActiveProfile()
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!canReviewWho(session.profile.role)) return NextResponse.json({ error: 'Insufficient permission.' }, { status: 403 })

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request.' }, { status: 400 })

  try {
    const medicine = await reviewWhoMedicine(parsed.data.medicineId, parsed.data.decision, parsed.data.note || null, session.user.id)
    return NextResponse.json({ medicine })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save the review.' }, { status: 500 })
  }
}
