import { NextResponse } from 'next/server'

export function POST() {
  return NextResponse.json({
    error: 'Password registration has been retired. Use Google registration at /register.',
  }, { status: 410 })
}
