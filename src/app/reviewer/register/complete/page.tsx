import { redirect } from 'next/navigation'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { ReviewerOnboardingForm } from '@/components/auth/ReviewerOnboardingForm'
import { getAuthenticatedProfile, getGoogleIdentity } from '@/lib/auth/server'
import { getSafeRedirectForAccount } from '@/lib/auth/security'

export const dynamic = 'force-dynamic'

export default async function CompleteReviewerRegistrationPage() {
  const identity = await getGoogleIdentity()
  if (!identity) redirect('/reviewer/register')
  const existing = await getAuthenticatedProfile({ linkByVerifiedEmail: true })
  if (existing) redirect(getSafeRedirectForAccount(existing.profile.account_status, existing.profile.role))
  return <AuthPageShell eyebrow="Langkah 2 dari 2"><ReviewerOnboardingForm name={identity.name} email={identity.email} /></AuthPageShell>
}
