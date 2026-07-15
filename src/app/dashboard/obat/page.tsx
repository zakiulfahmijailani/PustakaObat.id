import Link from 'next/link'
import { ChevronRight, Edit3, Eye, FileText, Pill, Plus, Search } from 'lucide-react'
import { requireActiveProfile } from '@/lib/auth/server'
import { queryNeon } from '@/lib/neon/server'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { Drug } from '@/types'

type DrugWithCategory = Drug & { drug_categories: { name: string } | null }
export const dynamic = 'force-dynamic'

export default async function MyDrugsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams
  const { profile } = await requireActiveProfile(['admin'])
  const parameters: unknown[] = []
  const conditions: string[] = []
  if (status && status !== 'all') { parameters.push(status); conditions.push(`status = $${parameters.length}`) }
  if (q) { parameters.push(`%${q}%`); conditions.push(`name ILIKE $${parameters.length}`) }
  let drugs: DrugWithCategory[] = []
  let error: Error | null = null
  try {
    const rows = await queryNeon<Drug>(`SELECT * FROM public.drugs ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY updated_at DESC`, parameters)
    drugs = rows.map((drug) => ({ ...drug, drug_categories: null }))
  } catch (queryError) {
    error = queryError instanceof Error ? queryError : new Error('Unknown query error')
  }

  const statusOptions = [
    { label: 'Semua Status', value: 'all' }, { label: 'Draft', value: 'draft' },
    { label: 'Review', value: 'review' }, { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' },
  ]

  return (
    <div className="space-y-10">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div><h1 className="text-3xl font-serif text-text">Manajemen Monografi</h1><p className="mt-1 text-text-muted">Kelola seluruh monografi lokal Apoteq.</p></div>
        {profile.role === 'admin' && <Button size="lg" asChild><Link href="/dashboard/obat/new"><Plus size={20} /> Buat Draft Baru</Link></Button>}
      </div>

      <Card className="border-none bg-surface-2/40"><CardContent className="flex flex-col gap-6 p-6 md:flex-row md:p-8">
        <form className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} /><input name="q" defaultValue={q} placeholder="Cari nama obat" className="w-full rounded-xl border border-border bg-surface py-3 pl-12 pr-4 outline-none focus:border-primary" /><input type="hidden" name="status" value={status || 'all'} /></form>
        <div className="flex gap-2 overflow-x-auto">{statusOptions.map((option) => <Link key={option.value} href={`/dashboard/obat?status=${option.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider ${(status || 'all') === option.value ? 'border-primary bg-primary text-white' : 'border-border text-text-muted'}`}>{option.label}</Link>)}</div>
      </CardContent></Card>

      {error ? <p className="rounded-2xl bg-error/10 p-5 text-error">Monografi tidak dapat dimuat: {error.message}</p> : drugs.length ? <div className="space-y-4">{drugs.map((drug) => <Card key={drug.id} className="border-none bg-surface-2/40 p-2"><CardContent className="flex flex-col justify-between gap-6 p-6 md:flex-row md:items-center">
        <div className="flex items-center gap-5"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary"><Pill size={28} /></div><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-serif text-text">{drug.name}</h2><Badge variant={drug.status === 'published' ? 'success' : drug.status === 'review' ? 'warning' : drug.status === 'archived' ? 'destructive' : 'secondary'}>{drug.status}</Badge></div><p className="mt-1 text-xs font-bold uppercase tracking-wider text-text-muted">{drug.drug_categories?.name || 'Umum'} · {new Date(drug.updated_at).toLocaleDateString('id-ID')}</p></div></div>
        <div className="flex gap-2">{drug.status === 'published' && <Button variant="outline" size="sm" asChild><Link href={`/obat/${drug.slug}`} target="_blank"><Eye size={16} /> Publik</Link></Button>}<Button variant="outline" size="sm" asChild><Link href={`/dashboard/obat/${drug.id}/edit`}><Edit3 size={16} /> Edit</Link></Button><ChevronRight className="self-center text-text-muted" size={20} /></div>
      </CardContent></Card>)}</div> : <div className="rounded-[3rem] border border-dashed border-border bg-surface-2/50 py-20 text-center"><FileText className="mx-auto mb-5 text-text-muted/40" size={42} /><h2 className="text-2xl font-serif text-text">Daftar monografi kosong</h2><p className="mt-2 text-text-muted">{q ? `Tidak ditemukan hasil untuk “${q}”.` : 'Belum ada monografi lokal pada filter ini.'}</p></div>}
    </div>
  )
}
