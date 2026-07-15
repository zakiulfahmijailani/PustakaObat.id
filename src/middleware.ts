import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_COOKIE_NAME } from '@/lib/auth/constants'

export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value)
  if (request.nextUrl.pathname.startsWith('/dashboard') && !hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
