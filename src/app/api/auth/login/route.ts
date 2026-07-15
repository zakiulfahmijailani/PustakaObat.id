import { NextResponse } from 'next/server'

export function POST() {
  return NextResponse.json({
    error: 'Password login has been retired. Use Google sign-in at /masuk.',
  }, { status: 410 })
}
