import Link from 'next/link'
import { Database, FileClock, Plus } from 'lucide-react'
import { requireActiveProfile } from '@/lib/auth/server'
import { getStaffWhoMedicines, getWhoImportRuns } from '@/lib/who/queries'
import { WhoAdminControls } from '@/components/dashboard/WhoAdminControls'
import { CatalogPagination } from '@/components/drug/CatalogPagination'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface SearchParams { q?: string; status?: string; page?: string }
export const dynamic = 'force-dynamic'

export default async function AdminWhoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireActiveProfile(['admin'])
  const filters = await searchParams
  const [{ medicines, count, page, error }, { runs }] = await Promise.all([getStaffWhoMedicines(filters), getWhoImportRuns()])

  return (
    <div className="space-y-10">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><Badge variant="destructive" className="mb-4">Admin · WHO Data</Badge><h1 className="text-4xl font-serif text-text">Kelola katalog WHO</h1><p className="mt-2 text-text-muted">Override editorial, soft-hide record, dan pantau batch import tanpa mengubah sumber aslinya.</p></div>
        <Button asChild><Link href="/admin/medicines/new"><Plus size={17} /> Tambah monografi lokal</Link></Button>
      </div>
      <form className="max-w-xl"><input name="q" defaultValue={filters.q} placeholder="Cari record WHO" className="w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none focus:border-primary" /></form>

      {error ? <p className="rounded-2xl bg-error/10 p-5 text-error">Migration WHO belum diterapkan.</p> : <div className="space-y-5">{medicines.map((medicine) => <div key={medicine.id} className="rounded-3xl border border-border bg-surface p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-serif text-2xl text-text">{medicine.editorial_name || medicine.medicine_name}</h2><p className="text-sm text-text-muted">{medicine.source_key}</p></div><div className="flex gap-2"><Badge>{medicine.verification_status}</Badge><Badge variant={medicine.is_active ? 'success' : 'destructive'}>{medicine.is_active ? 'active' : 'inactive'}</Badge></div></div><WhoAdminControls medicine={medicine} /></div>)}<CatalogPagination page={page} count={count} pathname="/admin/imports" params={{ q: filters.q }} /></div>}

      <section className="space-y-5 border-t border-border pt-10"><div className="flex items-center gap-3"><FileClock className="text-primary" /><h2 className="text-2xl font-serif text-text">Riwayat import</h2></div>{runs.length ? <div className="overflow-x-auto rounded-3xl border border-border"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-surface-2 text-xs uppercase tracking-wider text-text-muted"><tr><th className="p-4">Waktu</th><th className="p-4">Status</th><th className="p-4">Record</th><th className="p-4">Inserted</th><th className="p-4">Updated</th><th className="p-4">Skipped</th><th className="p-4">Failed</th><th className="p-4">Error</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id} className="border-t border-border"><td className="p-4">{new Date(run.imported_at).toLocaleString('id-ID')}</td><td className="p-4"><Badge variant={run.status === 'completed' ? 'success' : 'destructive'}>{run.status}</Badge></td><td className="p-4">{run.record_count}</td><td className="p-4">{run.inserted_count}</td><td className="p-4">{run.updated_count}</td><td className="p-4">{run.skipped_count}</td><td className="p-4">{run.failed_count}</td><td className="max-w-60 truncate p-4 text-error">{run.error_message || '—'}</td></tr>)}</tbody></table></div> : <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-6 text-text-muted"><Database size={20} /> Belum ada batch import. Jalankan <code>npm run who:import</code> dari environment aman.</div>}</section>
    </div>
  )
}
