import type { UserRole } from '@/types'

export const WHO_REVIEW_ROLES: UserRole[] = ['pharmacist', 'verifier', 'admin']

export function canReviewWho(role: UserRole | null | undefined) {
  return Boolean(role && WHO_REVIEW_ROLES.includes(role))
}

export function canAdminWho(role: UserRole | null | undefined) {
  return role === 'admin'
}
