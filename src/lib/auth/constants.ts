export const ACTIVE_STAFF_ROLES = ['editor', 'reviewer', 'admin', 'super_admin'] as const
export type StaffRole = (typeof ACTIVE_STAFF_ROLES)[number]

export const WORKSPACE_ROLES = ['editor', 'reviewer', 'admin'] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

export const ACCOUNT_STATUSES = [
  'pending_review',
  'needs_revision',
  'active',
  'rejected',
  'suspended',
] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]
