import { FullLabelWorkbench } from '@/components/full-label/FullLabelWorkbench'

export const dynamic = 'force-dynamic'

export default async function ReviewerFullLabelPage({ params }: { params: Promise<{ labelId: string }> }) {
  return <FullLabelWorkbench labelId={(await params).labelId} backHref="/reviewer/staging" />
}
