export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function getSafeRedirectForAccount(status: string, role: string) {
  if (status === 'active' && role === 'reviewer') return '/reviewer/dashboard'
  if (status === 'active' && role === 'admin') return '/admin/dashboard'
  if (status === 'needs_revision') return '/account/needs-revision'
  if (status === 'rejected') return '/account/rejected'
  if (status === 'suspended') return '/account/suspended'
  return '/pending-approval'
}
