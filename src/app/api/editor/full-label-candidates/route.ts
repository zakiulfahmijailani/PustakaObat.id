import { NextResponse } from 'next/server'
import { getActiveProfile } from '@/lib/auth/server'
import { queryNeon } from '@/lib/neon/server'
import { getFullLabelCandidates } from '@/lib/staging/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function withTimeout<T>(operation: Promise<T>, milliseconds: number) {
  return Promise.race<T>([
    operation,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Full-label metadata timed out.')), milliseconds)
    }),
  ])
}

export async function GET(request: Request) {
  const session = await getActiveProfile()
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (session.activeRole !== 'editor') return NextResponse.json({ error: 'Editor access is required.' }, { status: 403 })

  const drugKey = new URL(request.url).searchParams.get('drugKey') || ''
  if (!/^DRUG_[A-Z0-9]+$/.test(drugKey)) return NextResponse.json({ error: 'Drug key tidak valid.' }, { status: 400 })

  try {
    const concepts = await queryNeon<{ rxcui: string | null }>(`
      select rxcui
      from public.monograph_staging_drugs
      where drug_key = $1 and editorial_status = 'staging' and public_status = 'hidden'
      limit 1
    `, [drugKey])

    const candidates = await withTimeout(getFullLabelCandidates(concepts[0]?.rxcui || null), 5000)
    return NextResponse.json({ candidates }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Editor full-label candidate query failed', { drugKey, error })
    return NextResponse.json({ error: 'Bahan sumber FDA belum tersedia.' }, { status: 503 })
  }
}
