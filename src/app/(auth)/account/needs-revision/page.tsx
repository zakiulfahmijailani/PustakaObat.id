import { redirect } from 'next/navigation'
import { getAuthenticatedProfile } from '@/lib/auth/server'
import { ReviewerRevisionForm } from '@/components/auth/ReviewerRevisionForm'

export const dynamic = 'force-dynamic'

export default async function NeedsRevisionPage() {
  const session = await getAuthenticatedProfile()
  if (!session) redirect('/masuk')
  if (session.profile.account_status !== 'needs_revision') {
    redirect(session.profile.role === 'admin' ? '/admin/dashboard' : '/reviewer/dashboard')
  }
  return <div className="min-h-screen flex items-center justify-center bg-background p-4"><ReviewerRevisionForm profile={session.profile} /></div>
}
