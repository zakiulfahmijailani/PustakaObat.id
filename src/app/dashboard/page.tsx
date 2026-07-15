import { redirect } from 'next/navigation'
import { requireActiveProfile } from '@/lib/auth/server'
import { getSafeRedirectForAccount } from '@/lib/auth/security'

export default async function LegacyDashboardPage() {
  const { profile } = await requireActiveProfile()
  redirect(getSafeRedirectForAccount(profile.account_status, profile.role))
}
