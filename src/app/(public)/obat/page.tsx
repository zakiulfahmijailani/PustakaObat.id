import Link from 'next/link'
import { BookOpenCheck, Database, Globe2, Languages, Search, ShieldCheck, Stethoscope } from 'lucide-react'
import { CatalogPagination } from '@/components/drug/CatalogPagination'
import { MedicineHeroArt } from '@/components/drug/MedicineHeroArt'
import { MonographLibraryRow, WhoLibraryRow } from '@/components/drug/MedicineLibraryRow'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { AWARE_CATEGORIES, WHO_PAGE_SIZE } from '@/lib/who/constants'
import { getPublicLocalDrugs, getPublicWhoMedicines } from '@/lib/who/queries'

interface SearchParams {
  q?: string
  aware?: string
  essential?: string
  page?: string
}

export const dynamic = 'force-dynamic'

const trustItems = [
  { icon: ShieldCheck, title: 'Sumber resmi', copy: 'WHO dan sumber primer terkurasi' },
  { icon: BookOpenCheck, title: 'Ditinjau apoteker', copy: 'Jejak verifikasi tampil transparan' },
  { icon: Languages, title: 'Bahasa Indonesia', copy: 'Disusun agar mudah dipahami' },
  { icon: Stethoscope, title: 'Edukasi kesehatan', copy: 'Mendukung konsultasi profesional' },
]

export default async function DrugSearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = await searchParams
  const [{ medicines, count, page, error }, monographs] = await Promise.all([
    getPublicWhoMedicines(filters),
    getPublicLocalDrugs(filters.q),
  ])
  const first = count ? (page - 1) * WHO_PAGE_SIZE + 1 : 0
  const last = Math.min(page * WHO_PAGE_SIZE, count)

  const filterHref = (values: Partial<SearchParams>) => {
    const params = new URLSearchParams()
    const merged = { ...filters, page: undefined, ...values }
    Object.entries(merged).forEach(([key, value]) => value && params.set(key, value))
    const query = params.toString()
    return query ? `/obat?${query}` : '/obat'
  }

  const hasFilters = Boolean(filters.q || filters.aware || filters.essential)

  return (
    <div className="container px-4 pb-24">
      <section className="grid gap-8 pb-6 pt-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="max-w-2xl">
          <Badge className="mb-5 border border-primary/30 bg-primary/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]">Pustaka informasi obat Apoteq</Badge>
          <h1 className="max-w-xl text-4xl font-serif leading-[1.08] tracking-tight text-text md:text-6xl">
            Pusat rujukan <span className="text-primary">informasi obat</span> untuk Indonesia.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-text-muted md:text-lg">
            Cari nama obat untuk membaca informasi penting dalam Bahasa Indonesia, bersumber jelas, dan diterbitkan melalui peninjauan apoteker.
          </p>

          <form action="/obat" method="get" className="mt-7 flex max-w-xl overflow-hidden rounded-xl border-2 border-text bg-surface shadow-[0_4px_0_var(--color-text)] focus-within:ring-4 focus-within:ring-primary/10">
            <label htmlFor="medicine-search" className="sr-only">Cari nama obat</label>
            <Search className="ml-4 mt-4 shrink-0 text-text-muted" size={20} aria-hidden="true" />
            <input id="medicine-search" name="q" defaultValue={filters.q} placeholder="Cari nama obat, misalnya amoxicillin" className="min-w-0 flex-1 bg-transparent px-3 py-4 text-base outline-none placeholder:text-text-muted/70" />
            {filters.aware && <input type="hidden" name="aware" value={filters.aware} />}
            {filters.essential && <input type="hidden" name="essential" value={filters.essential} />}
            <button type="submit" className="bg-primary px-6 font-semibold text-white hover:bg-primary-hover">Cari</button>
          </form>
          <p className="mt-4 text-sm text-text-muted">
            Contoh: <Link className="font-medium text-primary underline underline-offset-4" href="/obat?q=amoxicillin">amoxicillin</Link>,{' '}
            <Link className="font-medium text-primary underline underline-offset-4" href="/obat?q=paracetamol">paracetamol</Link>, atau{' '}
            <Link className="font-medium text-primary underline underline-offset-4" href="/obat?q=metformin">metformin</Link>.
          </p>
        </div>
        <MedicineHeroArt />
      </section>

      <section className="my-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Keunggulan pustaka obat">
        {trustItems.map(({ icon: Icon, title, copy }) => (
          <div key={title} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
            <Icon className="mt-0.5 shrink-0 text-primary" size={22} aria-hidden="true" />
            <div><p className="text-sm font-bold text-text">{title}</p><p className="mt-1 text-xs leading-relaxed text-text-muted">{copy}</p></div>
          </div>
        ))}
      </section>

      <section className="mt-12" aria-live="polite">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-text pb-3">
          <div>
            <h2 className="font-serif text-3xl font-semibold text-text">Daftar Obat</h2>
            <p className="mt-1 text-sm text-text-muted">Monografi terbit ditampilkan lebih dahulu; profil WHO menjadi katalog sumber pendukung.</p>
          </div>
          <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
            {monographs.length} monografi · {count} profil WHO
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border py-4">
          <span className="mr-1 text-xs font-bold uppercase tracking-widest text-text-muted">Filter WHO</span>
          <Link href={filterHref({ aware: undefined, essential: undefined })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${!filters.aware && !filters.essential ? 'border-primary bg-primary text-white' : 'border-border bg-surface hover:border-primary hover:text-primary'}`}>Semua</Link>
          <Link href={filterHref({ essential: 'true', aware: undefined })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filters.essential === 'true' ? 'border-primary bg-primary text-white' : 'border-border bg-surface hover:border-primary hover:text-primary'}`}>Essential Medicines</Link>
          {AWARE_CATEGORIES.map((category) => (
            <Link key={category} href={filterHref({ aware: category, essential: undefined })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filters.aware === category ? 'border-primary bg-primary text-white' : 'border-border bg-surface hover:border-primary hover:text-primary'}`}>AWaRe · {category}</Link>
          ))}
          {hasFilters && <Button variant="ghost" size="sm" asChild className="ml-auto"><Link href="/obat">Reset pencarian</Link></Button>}
        </div>

        {error ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-2/50 px-8 py-16 text-center">
            <Database className="mx-auto mb-4 text-text-muted/40" size={38} />
            <h2 className="text-2xl font-serif text-text">Pustaka belum tersambung</h2>
            <p className="mx-auto mt-2 max-w-lg text-text-muted">Sumber data obat sedang tidak tersedia. Silakan coba kembali beberapa saat lagi.</p>
          </div>
        ) : (
          <>
            {page === 1 && monographs.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-2 px-3 pb-1 pt-5 text-xs font-bold uppercase tracking-[0.16em] text-primary"><BookOpenCheck size={16} /> Monografi terverifikasi</div>
                {monographs.map((drug) => <MonographLibraryRow key={drug.id} drug={drug} />)}
              </div>
            )}

            {medicines.length > 0 ? (
              <div className="mt-2">
                <div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-1 pt-5">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-text-muted"><Globe2 size={16} /> Katalog sumber WHO</p>
                  <p className="text-xs text-text-muted">Menampilkan {first}–{last} dari {count}</p>
                </div>
                {medicines.map((medicine) => <WhoLibraryRow key={medicine.id} medicine={medicine} />)}
                <div className="mt-8"><CatalogPagination page={page} count={count} pathname="/obat" params={{ q: filters.q, aware: filters.aware, essential: filters.essential }} /></div>
              </div>
            ) : monographs.length === 0 ? (
              <div className="px-8 py-16 text-center">
                <Globe2 className="mx-auto mb-4 text-text-muted/40" size={38} />
                <h2 className="text-2xl font-serif text-text">Obat tidak ditemukan</h2>
                <p className="mx-auto mt-2 max-w-lg text-text-muted">Periksa ejaan nama generik atau coba istilah pencarian yang lebih singkat.</p>
              </div>
            ) : null}
          </>
        )}
      </section>

      <aside className="mt-12 flex gap-4 rounded-xl border border-primary/25 bg-primary/5 p-5 text-sm leading-relaxed text-text-muted">
        <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={22} />
        <p><strong className="text-text">Informasi untuk edukasi.</strong> Pustaka ini tidak menggantikan pemeriksaan, diagnosis, resep, atau konsultasi dengan dokter dan apoteker.</p>
      </aside>
    </div>
  )
}
