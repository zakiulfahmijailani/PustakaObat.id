import Link from 'next/link'
import { Database, Globe2, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { WhoMedicineCard } from '@/components/drug/WhoMedicineCard'
import { CatalogPagination } from '@/components/drug/CatalogPagination'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { AWARE_CATEGORIES, WHO_PAGE_SIZE } from '@/lib/who/constants'
import { getPublicWhoMedicines } from '@/lib/who/queries'

interface SearchParams {
  q?: string
  aware?: string
  essential?: string
  page?: string
}

export const dynamic = 'force-dynamic'

export default async function DrugSearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = await searchParams
  const { medicines, count, page, error } = await getPublicWhoMedicines(filters)
  const first = count ? (page - 1) * WHO_PAGE_SIZE + 1 : 0
  const last = Math.min(page * WHO_PAGE_SIZE, count)

  const filterHref = (values: Partial<SearchParams>) => {
    const params = new URLSearchParams()
    const merged = { ...filters, page: undefined, ...values }
    Object.entries(merged).forEach(([key, value]) => value && params.set(key, value))
    const query = params.toString()
    return query ? `/obat?${query}` : '/obat'
  }

  return (
    <div className="container space-y-10 px-4 pb-24">
      <section className="grid gap-8 border-b border-border pb-10 pt-8 lg:grid-cols-[1fr_420px] lg:items-end">
        <div className="max-w-3xl space-y-5">
          <Badge className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest">WHO Medicine Catalog</Badge>
          <h1 className="text-4xl font-serif leading-tight text-text md:text-6xl">
            Informasi obat dari sumber <span className="italic text-primary">resmi WHO.</span>
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-text-muted">
            Telusuri WHO Electronic Essential Medicines List dan klasifikasi antibiotik AWaRe. Status BPOM belum tersedia pada katalog ini.
          </p>
        </div>
        <form action="/obat" method="get" className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
          <input name="q" defaultValue={filters.q} placeholder="Cari nama obat, misalnya amoxicillin" className="w-full rounded-2xl border border-border bg-surface py-4 pl-12 pr-4 shadow-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
          {filters.aware && <input type="hidden" name="aware" value={filters.aware} />}
          {filters.essential && <input type="hidden" name="essential" value={filters.essential} />}
        </form>
      </section>

      <div className="grid gap-10 lg:grid-cols-[250px_1fr]">
        <aside className="space-y-7">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text">
            <SlidersHorizontal size={18} className="text-primary" /> Filter sumber
          </div>
          <div className="flex flex-col gap-2">
            <Link href={filterHref({ aware: undefined, essential: undefined })} className={`rounded-xl px-4 py-3 text-sm font-semibold ${!filters.aware && !filters.essential ? 'bg-primary text-white' : 'text-text-muted hover:bg-surface-2'}`}>Semua obat WHO</Link>
            <Link href={filterHref({ essential: 'true', aware: undefined })} className={`rounded-xl px-4 py-3 text-sm font-semibold ${filters.essential === 'true' ? 'bg-primary text-white' : 'text-text-muted hover:bg-surface-2'}`}>WHO Essential Medicines</Link>
            {AWARE_CATEGORIES.map((category) => (
              <Link key={category} href={filterHref({ aware: category, essential: undefined })} className={`rounded-xl px-4 py-3 text-sm font-semibold ${filters.aware === category ? 'bg-primary text-white' : 'text-text-muted hover:bg-surface-2'}`}>AWaRe · {category}</Link>
            ))}
          </div>
          <div className="rounded-3xl border border-primary/10 bg-primary/5 p-6">
            <Globe2 className="mb-4 text-primary" size={28} />
            <p className="text-sm font-bold text-text">Data WHO, bukan BPOM</p>
            <p className="mt-2 text-xs leading-relaxed text-text-muted">Katalog ini tidak menyatakan registrasi atau ketersediaan obat di Indonesia.</p>
          </div>
        </aside>

        <section className="space-y-8" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-text-muted">{count ? `Menampilkan ${first}–${last} dari ${count} obat` : 'Belum ada hasil yang dapat ditampilkan'}</p>
            {(filters.q || filters.aware || filters.essential) && <Button variant="outline" size="sm" asChild><Link href="/obat">Reset filter</Link></Button>}
          </div>

          {error ? (
            <div className="rounded-[2rem] border border-dashed border-border bg-surface-2/50 px-8 py-20 text-center">
              <Database className="mx-auto mb-5 text-text-muted/40" size={42} />
              <h2 className="text-2xl font-serif text-text">Katalog WHO belum tersambung</h2>
              <p className="mx-auto mt-3 max-w-lg text-text-muted">Data perlu diimpor ke Supabase terlebih dahulu. Kalkulator dan fitur publik lain tetap dapat digunakan.</p>
            </div>
          ) : medicines.length ? (
            <>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{medicines.map((medicine) => <WhoMedicineCard key={medicine.id} medicine={medicine} />)}</div>
              <CatalogPagination page={page} count={count} pathname="/obat" params={{ q: filters.q, aware: filters.aware, essential: filters.essential }} />
            </>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-border bg-surface-2/50 px-8 py-20 text-center">
              <ShieldCheck className="mx-auto mb-5 text-text-muted/40" size={42} />
              <h2 className="text-2xl font-serif text-text">Obat tidak ditemukan</h2>
              <p className="mx-auto mt-3 max-w-lg text-text-muted">Periksa ejaan nama generik atau coba kategori WHO yang lain.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
