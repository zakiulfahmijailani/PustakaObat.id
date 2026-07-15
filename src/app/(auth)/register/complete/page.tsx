import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/layout/Logo'
import { ReviewerOnboardingForm } from '@/components/auth/ReviewerOnboardingForm'
import { getAuthenticatedProfile, getGoogleIdentity } from '@/lib/auth/server'
import { getSafeRedirectForAccount } from '@/lib/auth/security'

export const dynamic = 'force-dynamic'

export default async function CompleteReviewerRegistrationPage() {
  const identity = await getGoogleIdentity()
  if (!identity) redirect('/register')

  const existing = await getAuthenticatedProfile({ linkByVerifiedEmail: true })
  if (existing) redirect(getSafeRedirectForAccount(existing.profile.account_status, existing.profile.role))

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-4 py-20">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center gap-8">
        <Link href="/"><Logo className="mb-2 scale-110" /></Link>
        <ReviewerOnboardingForm name={identity.name} email={identity.email} />
      </div>
    </div>
  )
}

