import { BadgeCheck } from 'lucide-react'
import { queryNeon } from '@/lib/neon/server'
import { ApprovedSectionPublicationQueue, type ApprovedSectionQueueItem } from '@/components/staging/ApprovedSectionPublicationQueue'
import { Badge } from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'

export default async function AdminPublicationQueuePage() {
  const items = await queryNeon<ApprovedSectionQueueItem>(`
    select
      d.id as draft_id,
      d.drug_key,
      s.preferred_name as drug_name,
      s.slug,
      d.section_type,
      d.reviewed_at,
      reviewer.full_name as reviewer_name,
      d.version
    from public.monograph_editorial_drafts d
    join public.monograph_staging_drugs s on s.drug_key = d.drug_key
    join public.profiles reviewer on reviewer.id = d.reviewed_by
    left join public.monograph_publication_sections published on published.editorial_draft_id = d.id
    where d.status = 'pharmacist_approved'
      and d.reviewed_by is not null
      and d.reviewed_at is not null
      and d.reviewed_by is distinct from d.authored_by
      and published.id is null
    order by d.reviewed_at asc, s.preferred_name, d.section_type
  `)

  return <div className="space-y-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><Badge variant="success" className="mb-4"><BadgeCheck className="mr-1" size={13} />Admin · Publication Queue</Badge><h1 className="font-serif text-4xl text-text">Monografi siap terbit</h1><p className="mt-2 max-w-3xl text-text-muted">Hanya bagian Bahasa Indonesia yang sudah disetujui Reviewer yang tampil di sini. Admin dapat menerbitkannya satu per satu.</p></div>
      <p className="text-sm font-bold text-primary">{items.length} bagian menunggu publikasi</p>
    </div>
    <ApprovedSectionPublicationQueue items={items} />
  </div>
}
