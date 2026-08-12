import Link from 'next/link'
import { AlertTriangle, ClipboardCheck, Search } from 'lucide-react'
import { getEditorialReviewQueue, type StagingFilters } from '@/lib/staging/queries'
import { MONOGRAPH_SECTION_LABELS } from '@/lib/full-label/section-mapping'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CatalogPagination } from '@/components/drug/CatalogPagination'

export async function EditorialReviewQueue({ filters, actorId }: { filters: StagingFilters; actorId: string }) {
  const { items, count, page, error } = await getEditorialReviewQueue(filters, actorId)
  return <div className="space-y-6">
    <form className="grid gap-3 rounded-3xl border border-border bg-surface p-5 md:grid-cols-[1fr_auto]">
      <label className="relative"><span className="sr-only">Cari antrean review</span><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} /><input name="q" defaultValue={filters.q} placeholder="Cari draf yang menunggu keputusan" className="min-h-11 w-full rounded-xl border border-border bg-surface pl-11 pr-4 text-sm" /></label>
      <Button type="submit">Cari</Button>
    </form>
    {error ? <p className="rounded-2xl bg-error/10 p-5 text-error">Antrean review belum dapat dibuka.</p> : items.length ? <div className="space-y-4">
      {items.map((item) => <Link key={item.drug_key} href={`/reviewer/staging/${item.drug_key}?section=${encodeURIComponent(item.section_types[0] || '')}`} className="block rounded-3xl border border-border bg-surface p-6 transition-colors hover:border-primary/40">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge variant="warning">{item.submitted_count} bagian menunggu keputusan</Badge>{item.unbound_count > 0 && <Badge variant="destructive"><AlertTriangle className="mr-1" size={13} />{item.unbound_count} evidence belum terikat</Badge>}</div><h2 className="mt-3 font-serif text-2xl text-text">{item.preferred_name}</h2><p className="mt-2 text-sm text-text-muted">Bagian: {item.section_types.map((section) => MONOGRAPH_SECTION_LABELS[section] || section).join(', ')}</p><p className="mt-2 text-xs text-text-muted">Menunggu sejak {new Date(item.oldest_submitted_at).toLocaleString('id-ID')}</p>{item.unbound_count > 0 && <p className="mt-3 text-sm leading-relaxed text-error">Bagian tanpa evidence tidak boleh disetujui; kembalikan ke Editor dengan catatan yang jelas.</p>}</div>
          <span className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-bold text-primary"><ClipboardCheck size={17} />Beri keputusan</span>
        </div>
      </Link>)}
      <CatalogPagination page={page} count={count} pathname="/reviewer/staging" params={{ q: filters.q }} />
    </div> : <div className="rounded-3xl border border-dashed border-border p-14 text-center"><ClipboardCheck className="mx-auto mb-4 text-primary opacity-40" size={38} /><p className="font-bold text-text">Tidak ada draf yang menunggu keputusan Anda.</p><p className="mt-2 text-sm text-text-muted">Draf buatan Anda sendiri dan draf yang belum dikirim tidak masuk antrean ini.</p></div>}
  </div>
}
