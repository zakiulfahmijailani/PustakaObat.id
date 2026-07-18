import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getActiveProfile } from '@/lib/auth/server'
import { canAdminWho } from '@/lib/auth/permissions'
import { adminUpdateWhoMedicine } from '@/lib/who/mutations'
import { isSameOriginMutation } from '@/lib/auth/request'

const updateSchema = z.object({
  medicineId: z.string().uuid(),
  editorialName: z.string().trim().max(300),
  publicationStatus: z.enum(['published', 'hidden']),
  isActive: z.boolean(),
})

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const session = await getActiveProfile()
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!canAdminWho(session.activeRole)) return NextResponse.json({ error: 'Insufficient permission.' }, { status: 403 })

  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request.' }, { status: 400 })

  try {
    const medicine = await adminUpdateWhoMedicine(
      parsed.data.medicineId,
      parsed.data.editorialName,
      parsed.data.publicationStatus,
      parsed.data.isActive,
      session.user.id,
    )
    return NextResponse.json({ medicine })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update the medicine.' }, { status: 500 })
  }
}
