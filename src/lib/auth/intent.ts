export const AUTH_INTENTS = [
  'reviewer_login',
  'reviewer_register',
  'editor_login',
  'admin_login',
  'super_admin_login',
] as const

export type AuthIntent = (typeof AUTH_INTENTS)[number]

export const AUTH_INTENT_COOKIE = 'apoteq_auth_intent'
export const AUTH_INTENT_MAX_AGE_SECONDS = 60 * 10

export function parseAuthIntent(value: unknown): AuthIntent | null {
  return typeof value === 'string' && AUTH_INTENTS.includes(value as AuthIntent)
    ? value as AuthIntent
    : null
}

export function getUnlinkedAccountDestination(intent: AuthIntent | null) {
  if (intent === 'reviewer_register') return '/reviewer/register/complete'
  if (intent === 'reviewer_login') return '/reviewer/not-registered'
  if (intent === 'editor_login') return '/editor/access-denied'
  if (intent === 'admin_login') return '/admin/access-denied'
  if (intent === 'super_admin_login') return '/super-admin/access-denied'
  return '/masuk'
}
