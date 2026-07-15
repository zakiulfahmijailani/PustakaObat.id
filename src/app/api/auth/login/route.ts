import { NextResponse } from 'next/server'

export function POST() {
  return NextResponse.json({
    error: 'Password login has been retired. Use Google sign-in at /login.',
  }, { status: 410 })
}
