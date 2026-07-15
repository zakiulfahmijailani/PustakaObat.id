import { NextResponse } from 'next/server'

export function POST() {
  return NextResponse.json({
    error: 'Use the Auth.js sign-out action.',
  }, { status: 410 })
}

