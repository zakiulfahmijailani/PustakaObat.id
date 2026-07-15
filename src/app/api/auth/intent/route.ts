import { NextResponse } from 'next/server'
import {
  AUTH_INTENT_COOKIE,
  AUTH_INTENT_MAX_AGE_SECONDS,
  parseAuthIntent,
} from '@/lib/auth/intent'
import { isSameOriginMutation } from '@/lib/auth/request'

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const payload = await request.json().catch(() => null)
  const intent = parseAuthIntent(payload?.intent)
  if (!intent) {
    return NextResponse.json({ error: 'Invalid authentication intent.' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(AUTH_INTENT_COOKIE, intent, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: AUTH_INTENT_MAX_AGE_SECONDS,
    path: '/',
  })
  return response
}
