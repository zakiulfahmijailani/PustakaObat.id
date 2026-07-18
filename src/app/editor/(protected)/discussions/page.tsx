import { InternalDiscussionPage } from '@/components/discussions/InternalDiscussionPage'
import { requireEditor } from '@/lib/auth/server'

export default async function EditorDiscussionsPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>
}) {
  const { profile } = await requireEditor()
  const { thread } = await searchParams
  return <InternalDiscussionPage profile={profile} basePath="/editor/discussions" selectedId={thread} />
}
