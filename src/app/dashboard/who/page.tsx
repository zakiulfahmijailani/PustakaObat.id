import Link from 'next/link'
import { BookOpenCheck, Search } from 'lucide-react'
import { requireActiveProfile } from '@/lib/auth/server'
import { WHO_REVIEW_ROLES } from '@/lib/auth/permissions'
import { getStaffWhoMedicines } from '@/lib/who/queries'
import { CatalogPagination } from '@/components/drug/CatalogPagination'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface SearchParams { q?: string; status?: string; page?: string }

export const dynamic = 'force-dynamic'

export default async function WhoReviewQueuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireActiveProfile(WHO_REVIEW_ROLES)
  const filters = await searchParams
  const status = filters.status || 'pending'
  const { medicines, count, page, error } = await getStaffWhoMedicines({ ...filters, status })
  const statuses = [
    ['pending', 'Pending'], ['verified', 'Verified'], ['needs_revision', 'Perlu perbaikan'], ['rejected', 'Ditolak'],
  ]

  return (
    <div className="space-y-8">
      <div>
        <Badge className="mb-4">WHO Review Workspace</Badge>
        <h1 className="text-4xl font-serif text-text">Verifikasi data obat WHO</h1>
        <p className="mt-2 max-w-2xl text-text-muted">Tinjau akurasi representasi data sumber sebelum memberi status verifikasi Apoteq.</p>
      </div>
      <form className="relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
        <input name="q" defaultValue={filters.q} placeholder="Cari nama obat" className="w-full rounded-2xl border border-border bg-surface py-3 pl-11 pr-4 outline-none focus:border-primary" />
        <input type="hidden" name="status" value={status} />
      </form>
      <div className="flex flex-wrap gap-2">{statuses.map(([value, label]) => <Button key={value} size="sm" variant={status === value ? 'primary' : 'outline'} asChild><Link href={`/reviewer/medicines?status=${value}${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ''}`}>{label}</Link></Button>)}</div>

      {error ? <p className="rounded-2xl bg-error/10 p-5 text-error">Katalog WHO belum tersedia. Pastikan migration dan import sudah dijalankan.</p> : medicines.length ? (
        <div className="space-y-4">{medicines.map((medicine) => (
          <Link key={medicine.id} href={`/reviewer/medicines/${medicine.id}`} className="flex flex-col gap-5 rounded-3xl border border-border bg-surface p-6 transition-colors hover:border-primary/30 md:flex-row md:items-center md:justify-between">
            <div><h2 className="font-serif text-2xl text-text">{medicine.editorial_name || medicine.medicine_name}</h2><p className="mt-1 text-sm text-text-muted">WHO · {medicine.data_status}{medicine.aware_category ? ` · AWaRe ${medicine.aware_category}` : ''}</p></div>
            <div className="flex items-center gap-3"><Badge variant={medicine.verification_status === 'verified' ? 'success' : medicine.verification_status === 'rejected' ? 'destructive' : 'warning'}>{medicine.verification_status.replace('_', ' ')}</Badge><BookOpenCheck className="text-primary" size={20} /></div>
          </Link>
        ))}<CatalogPagination page={page} count={count} pathname="/reviewer/medicines" params={{ q: filters.q, status }} /></div>
      ) : <p className="rounded-3xl border border-dashed border-border p-16 text-center text-text-muted">Tidak ada record pada antrean ini.</p>}
    </div>
  )
}
