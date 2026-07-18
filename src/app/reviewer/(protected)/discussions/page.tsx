import { InternalDiscussionPage } from '@/components/discussions/InternalDiscussionPage'
import { requireReviewer } from '@/lib/auth/server'

export default async function ReviewerDiscussionsPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>
}) {
  const { profile } = await requireReviewer()
  const { thread } = await searchParams
  return <InternalDiscussionPage profile={profile} basePath="/reviewer/discussions" selectedId={thread} />
}
