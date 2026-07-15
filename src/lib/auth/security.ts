import { createHash, randomBytes } from 'node:crypto'

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function getSafeRedirectForAccount(status: string, role: string) {
  if (status === 'active' && (role === 'reviewer' || role === 'admin')) return '/dashboard'
  if (status === 'needs_revision') return '/account/needs-revision'
  if (status === 'rejected') return '/account/rejected'
  if (status === 'suspended') return '/account/suspended'
  return '/pending-approval'
}

