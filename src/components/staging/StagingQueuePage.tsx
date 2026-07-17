import Link from 'next/link'
import { FlaskConical, Search, ShieldAlert } from 'lucide-react'
import { requireReviewer } from '@/lib/auth/server'
import { getStagedDrugConcepts, type StagingFilters } from '@/lib/staging/queries'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CatalogPagination } from '@/components/drug/CatalogPagination'

export async function StagingQueuePage({ filters, basePath }: { filters: StagingFilters; basePath: string }) {
  await requireReviewer()
  const { concepts, count, page, error } = await getStagedDrugConcepts(filters)
  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4 flex flex-wrap gap-2"><Badge variant="warning">Staging evidence v2.2</Badge><Badge variant="destructive"><ShieldAlert className="mr-1" size={13} />Tidak siap publikasi</Badge></div>
        <h1 className="text-4xl font-serif text-text">Workbench monografi staging</h1>
        <p className="mt-2 max-w-3xl text-text-muted">Evidence sumber belum ditinjau, BPOM masih pending, dan semua konsep tetap hidden. Workbench ini hanya tersedia untuk reviewer dan admin.</p>
      </div>
      <form className="grid gap-3 rounded-3xl border border-border bg-surface p-5 md:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative"><span className="sr-only">Cari konsep staging</span><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} /><input name="q" defaultValue={filters.q} placeholder="Cari nama atau alias staging" className="min-h-11 w-full rounded-xl border border-border bg-surface pl-11 pr-4 text-sm" /></label>
        <select name="identity" defaultValue={filters.identity || ''} className="min-h-11 rounded-xl border border-border bg-surface px-4 text-sm"><option value="">Semua identitas</option><option value="validated">Validated</option><option value="provisional">Provisional</option></select>
        <select name="candidate" defaultValue={filters.candidate || ''} className="min-h-11 rounded-xl border border-border bg-surface px-4 text-sm"><option value="">Semua readiness</option><option value="true">Editorial candidate</option><option value="false">Belum candidate</option></select>
        <Button type="submit">Terapkan filter</Button>
      </form>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant={filters.pilot === 'true' ? 'primary' : 'outline'} asChild><Link href={`${basePath}?pilot=true`}><FlaskConical size={15} />Pilot</Link></Button><Button size="sm" variant="outline" asChild><Link href={basePath}>Reset</Link></Button></div>
      {error ? <p className="rounded-2xl bg-error/10 p-5 text-error">Schema staging belum tersedia atau Neon tidak dapat diakses.</p> : concepts.length ? (
        <div className="space-y-4">
          {concepts.map((concept) => <Link key={concept.drug_key} href={`${basePath}/${concept.drug_key}`} className="block rounded-3xl border border-border bg-surface p-6 transition-colors hover:border-primary/40">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div><div className="flex flex-wrap gap-2">{concept.is_pilot && <Badge><FlaskConical className="mr-1" size={13} />Pilot</Badge>}<Badge variant={concept.identity_status === 'validated' ? 'success' : 'warning'}>{concept.identity_status}</Badge>{concept.core_editorial_candidate && <Badge variant="secondary">Editorial candidate</Badge>}<Badge variant="outline">{concept.seed_type}</Badge></div><h2 className="mt-4 font-serif text-2xl text-text">{concept.preferred_name}</h2><p className="mt-1 text-xs text-text-muted">{concept.drug_key} · {concept.rxcui ? `RxCUI ${concept.rxcui}` : 'RxCUI belum tervalidasi'}</p></div>
              <div className="grid grid-cols-3 gap-5 text-center"><div><strong className="block text-xl text-text">{concept.covered_section_count || 0}</strong><span className="text-xs text-text-muted">bagian</span></div><div><strong className="block text-xl text-text">{concept.evidence_count || 0}</strong><span className="text-xs text-text-muted">evidence</span></div><div><strong className="block text-xl text-text">{concept.source_count || 0}</strong><span className="text-xs text-text-muted">sumber</span></div></div>
            </div>
          </Link>)}
          <CatalogPagination page={page} count={count} pathname={basePath} params={{ q: filters.q, identity: filters.identity, candidate: filters.candidate, pilot: filters.pilot }} />
        </div>
      ) : <p className="rounded-3xl border border-dashed border-border p-14 text-center text-text-muted">Tidak ada konsep staging yang cocok.</p>}
    </div>
  )
}
