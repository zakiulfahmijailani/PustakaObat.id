import { InternalDiscussionPage } from '@/components/discussions/InternalDiscussionPage'
import { requireAdmin } from '@/lib/auth/server'

export default async function AdminDiscussionsPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>
}) {
  const { profile } = await requireAdmin()
  const { thread } = await searchParams
  return <InternalDiscussionPage profile={profile} basePath="/admin/discussions" selectedId={thread} />
}
