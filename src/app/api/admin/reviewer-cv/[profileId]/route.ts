import { NextResponse } from 'next/server'
import { getActiveProfile } from '@/lib/auth/server'
import { queryNeon } from '@/lib/neon/server'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const session = await getActiveProfile()
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (session.activeRole !== 'admin') return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 })
  const { profileId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return NextResponse.json({ error: 'Invalid profile ID.' }, { status: 400 })

  const rows = await queryNeon<{ cv_file_name: string; cv_mime_type: string; cv_file_data: Uint8Array }>(`
    select cv_file_name, cv_mime_type, cv_file_data
    from public.reviewer_applications
    where profile_id = $1::uuid and cv_file_data is not null
    order by created_at desc limit 1
  `, [profileId])
  const cv = rows[0]
  if (!cv) return NextResponse.json({ error: 'CV tidak ditemukan.' }, { status: 404 })
  const fileName = cv.cv_file_name.replace(/[^a-zA-Z0-9._ -]/g, '_')
  return new NextResponse(cv.cv_file_data as BodyInit, {
    headers: {
      'Content-Type': cv.cv_mime_type || 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
