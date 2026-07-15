export const AUTH_COOKIE_NAME = 'apoteq_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

export const ACTIVE_STAFF_ROLES = ['reviewer', 'admin'] as const
export type StaffRole = (typeof ACTIVE_STAFF_ROLES)[number]

export const ACCOUNT_STATUSES = [
  'pending_review',
  'needs_revision',
  'active',
  'rejected',
  'suspended',
] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

