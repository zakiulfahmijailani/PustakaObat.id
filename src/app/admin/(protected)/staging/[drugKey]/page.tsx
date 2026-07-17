import { StagingDetailPage } from '@/components/staging/StagingDetailPage'

export const dynamic = 'force-dynamic'

export default async function AdminStagingDetailPage({ params }: { params: Promise<{ drugKey: string }> }) {
  return <StagingDetailPage drugKey={(await params).drugKey} basePath="/admin/staging" />
}
