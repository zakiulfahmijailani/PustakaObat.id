import { NextResponse } from 'next/server'
import { revokeCurrentSession } from '@/lib/auth/server'

export async function POST(request: Request) {
  await revokeCurrentSession()
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
}

