import { StagingDetailPage } from '@/components/staging/StagingDetailPage'

export const dynamic = 'force-dynamic'

export default async function ReviewerStagingDetailPage({ params, searchParams }: { params: Promise<{ drugKey: string }>; searchParams: Promise<{ section?: string }> }) {
  return <StagingDetailPage drugKey={(await params).drugKey} basePath="/reviewer/staging" initialSection={(await searchParams).section} />
}
