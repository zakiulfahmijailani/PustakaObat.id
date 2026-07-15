import { redirect } from 'next/navigation'
import { getGoogleIdentity, linkExistingProfile } from '@/lib/auth/server'
import { getSafeRedirectForAccount } from '@/lib/auth/security'

export const dynamic = 'force-dynamic'

export default async function PostLoginPage() {
  const identity = await getGoogleIdentity()
  if (!identity) redirect('/login')

  const profile = await linkExistingProfile(identity)
  if (!profile) redirect('/register/complete')

  redirect(getSafeRedirectForAccount(profile.account_status, profile.role))
}

