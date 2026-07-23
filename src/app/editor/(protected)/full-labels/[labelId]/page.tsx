import { FullLabelWorkbench } from '@/components/full-label/FullLabelWorkbench'
import { requireEditor } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

export default async function EditorFullLabelPage({ params }: { params: Promise<{ labelId: string }> }) {
  await requireEditor()
  const { labelId } = await params
  return <FullLabelWorkbench labelId={labelId} backHref="/editor/content" />
}
