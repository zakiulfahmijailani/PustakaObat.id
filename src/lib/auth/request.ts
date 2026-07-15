export function getRequestMetadata(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ipAddress = forwardedFor?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null

  return {
    ipAddress,
    userAgent: request.headers.get('user-agent'),
  }
}

export function isSameOriginMutation(request: Request) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (!origin || !host) return process.env.NODE_ENV !== 'production'

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
