import type { AuthProfile } from '@/lib/auth/server'
import { getDiscussionDetails, getDiscussionRecipients, getDiscussionSummaries } from '@/lib/discussions/queries'
import { discussionIdSchema } from '@/lib/discussions/schemas'
import { InternalDiscussionWorkspace } from './InternalDiscussionWorkspace'

export async function InternalDiscussionPage({
  profile,
  basePath,
  selectedId,
}: {
  profile: AuthProfile
  basePath: string
  selectedId?: string
}) {
  const [discussions, recipients] = await Promise.all([
    getDiscussionSummaries(profile.id),
    getDiscussionRecipients(profile.id),
  ])
  const requestedId = discussionIdSchema.safeParse(selectedId)
  const activeId = requestedId.success ? requestedId.data : discussions[0]?.id
  const selectedDiscussion = activeId ? await getDiscussionDetails(profile.id, activeId) : null

  return (
    <InternalDiscussionWorkspace
      discussions={discussions}
      recipients={recipients}
      selectedDiscussion={selectedDiscussion}
      viewer={{ id: profile.id, fullName: profile.full_name, role: profile.role }}
      basePath={basePath}
    />
  )
}
