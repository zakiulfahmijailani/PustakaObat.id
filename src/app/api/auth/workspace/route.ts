import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedProfile, WORKSPACE_COOKIE } from '@/lib/auth/server'
import { isSameOriginMutation } from '@/lib/auth/request'
import { WORKSPACE_ROLES, type WorkspaceRole } from '@/lib/auth/constants'

const schema = z.object({ workspace: z.enum(WORKSPACE_ROLES) })

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const session = await getAuthenticatedProfile({ linkByVerifiedEmail: true })
  if (!session || !session.profile.is_active || session.profile.account_status !== 'active' || session.profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access is required.' }, { status: 403 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Workspace is invalid.' }, { status: 400 })

  const destinations: Record<WorkspaceRole, string> = {
    editor: '/editor/dashboard', reviewer: '/reviewer/dashboard', admin: '/admin/dashboard',
  }
  const response = NextResponse.json({ redirectTo: destinations[parsed.data.workspace] })
  response.cookies.set(WORKSPACE_COOKIE, parsed.data.workspace, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  return response
}
