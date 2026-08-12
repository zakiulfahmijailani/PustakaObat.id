import { ClipboardCheck } from 'lucide-react'
import { EditorialReviewQueue } from '@/components/reviewer/EditorialReviewQueue'
import { requireReviewer } from '@/lib/auth/server'
import type { StagingFilters } from '@/lib/staging/queries'

export const dynamic = 'force-dynamic'

export default async function ReviewerStagingPage({ searchParams }: { searchParams: Promise<StagingFilters> }) {
  const { user } = await requireReviewer()
  return <div className="space-y-8"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Antrean tindakan saya</p><h1 className="mt-2 flex items-center gap-3 font-serif text-4xl text-text"><ClipboardCheck size={32} />Review editorial</h1><p className="mt-2 max-w-3xl text-text-muted">Hanya draf terkirim yang boleh Anda putuskan yang tampil. Draf buatan Anda sendiri otomatis dikeluarkan untuk mencegah konflik kepentingan.</p></div><EditorialReviewQueue filters={await searchParams} actorId={user.id} /></div>
}
