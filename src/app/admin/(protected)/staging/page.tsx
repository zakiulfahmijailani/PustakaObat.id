import { StagingQueuePage } from '@/components/staging/StagingQueuePage'
import type { StagingFilters } from '@/lib/staging/queries'

export const dynamic = 'force-dynamic'

export default async function AdminStagingPage({ searchParams }: { searchParams: Promise<StagingFilters> }) {
  return <StagingQueuePage filters={await searchParams} basePath="/admin/staging" />
}
