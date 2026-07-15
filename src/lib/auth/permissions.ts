import type { StaffRole } from './constants'

export const WHO_REVIEW_ROLES: StaffRole[] = ['reviewer', 'admin']

export function canReviewWho(role: string | null | undefined) {
  return Boolean(role && WHO_REVIEW_ROLES.includes(role as StaffRole))
}

export function canAdminWho(role: string | null | undefined) {
  return role === 'admin'
}
