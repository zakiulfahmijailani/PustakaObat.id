import Link from 'next/link'
import { FilePenLine, Search } from 'lucide-react'
import { describeEditorAction } from '@/lib/staging/editorial-queue'
import { getEditorActionQueue, type StagingFilters } from '@/lib/staging/queries'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CatalogPagination } from '@/components/drug/CatalogPagination'

export async function EditorContentQueue({ filters, actorId }: { filters: StagingFilters; actorId: string }) {
  const { concepts, count, page, error } = await getEditorActionQueue(filters, actorId)
  return <div className="space-y-6"><form className="grid gap-3 rounded-3xl border border-border bg-surface p-5 md:grid-cols-[1fr_auto]"><label className="relative"><span className="sr-only">Cari pekerjaan editorial</span><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} /><input name="q" defaultValue={filters.q} placeholder="Cari pekerjaan berdasarkan nama obat" className="min-h-11 w-full rounded-xl border border-border bg-surface pl-11 pr-4 text-sm" /></label><Button type="submit">Cari</Button></form>{error ? <p className="rounded-2xl bg-error/10 p-5 text-error">Antrean pekerjaan belum dapat dibuka.</p> : concepts.length ? <div className="space-y-4">{concepts.map((concept) => {
    const summary = describeEditorAction(concept)
    return <Link key={concept.drug_key} href={`/editor/content/${concept.drug_key}`} className="block rounded-3xl border border-border bg-surface p-6 transition-colors hover:border-primary/40"><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge variant={summary.kind === 'revision' ? 'warning' : summary.kind === 'draft' ? 'secondary' : 'success'}>{summary.label}</Badge>{concept.is_pilot && <Badge>Prioritas</Badge>}</div><h2 className="mt-3 font-serif text-2xl text-text">{concept.preferred_name}</h2><p className="mt-2 text-sm leading-relaxed text-text-muted">{summary.instruction}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted"><span>{concept.revision_section_count} revisi</span><span>{concept.draft_section_count} draf aktif</span><span>{concept.new_section_count} bagian baru</span></div></div><span className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-bold text-primary"><FilePenLine size={17} />{summary.action}</span></div></Link>
  })}<CatalogPagination page={page} count={count} pathname="/editor/content" params={{ q: filters.q }} /></div> : <div className="rounded-3xl border border-dashed border-border p-14 text-center"><FilePenLine className="mx-auto mb-4 text-primary opacity-40" size={38} /><p className="font-bold text-text">Tidak ada tindakan editorial saat ini.</p><p className="mt-2 text-sm text-text-muted">Draf yang sedang ditinjau tidak ditampilkan di antrean tindakan.</p></div>}</div>
}
