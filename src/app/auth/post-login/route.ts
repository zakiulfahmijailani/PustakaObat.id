import { NextRequest, NextResponse } from 'next/server'
import { getGoogleIdentity, linkExistingProfile } from '@/lib/auth/server'
import {
  AUTH_INTENT_COOKIE,
  getUnlinkedAccountDestination,
  parseAuthIntent,
} from '@/lib/auth/intent'
import { getSafeRedirectForAccount } from '@/lib/auth/security'

export const dynamic = 'force-dynamic'

function redirectAndClearIntent(request: NextRequest, destination: string) {
  const response = NextResponse.redirect(new URL(destination, request.url))
  response.cookies.delete(AUTH_INTENT_COOKIE)
  return response
}

export async function GET(request: NextRequest) {
  const identity = await getGoogleIdentity()
  if (!identity) return redirectAndClearIntent(request, '/masuk')

  const intent = parseAuthIntent(request.cookies.get(AUTH_INTENT_COOKIE)?.value)

  try {
    const profile = await linkExistingProfile(identity)
    if (!profile) {
      return redirectAndClearIntent(request, getUnlinkedAccountDestination(intent))
    }

    return redirectAndClearIntent(
      request,
      getSafeRedirectForAccount(profile.account_status, profile.role),
    )
  } catch {
    return redirectAndClearIntent(request, '/masuk?error=identity_conflict')
  }
}
