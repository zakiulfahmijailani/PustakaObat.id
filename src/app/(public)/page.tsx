import { CheckCircle2, Globe2, Heart, ShieldCheck } from 'lucide-react'
import { MedicineHeroArt } from '@/components/drug/MedicineHeroArt'
import { MedicineSearchForm } from '@/components/drug/MedicineSearchForm'

const trustPoints = [
  { icon: ShieldCheck, title: 'Sumber resmi', copy: 'Data obat dari sumber yang dapat ditelusuri.' },
  { icon: CheckCircle2, title: 'Ditinjau apoteker', copy: 'Halaman terverifikasi ditandai khusus.' },
  { icon: Globe2, title: 'Bahasa Indonesia', copy: 'Cari dalam bahasa Indonesia atau Inggris.' },
  { icon: Heart, title: 'Gratis & nirlaba', copy: 'Untuk pendidikan dan pelayanan kesehatan.' },
]

export default function HomePage() {
  return (
    <main className="container px-4 pb-16 pt-9 md:pb-20 md:pt-12">
      <section className="grid items-center gap-8 md:grid-cols-[1.15fr_0.85fr] md:gap-12" aria-labelledby="home-title">
        <div>
          <h1 id="home-title" className="max-w-xl font-[Georgia,serif] text-4xl font-semibold leading-[1.2] tracking-[-0.03em] text-text md:text-5xl">
            Pusat rujukan <span className="text-primary">informasi obat</span> Nusantara.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-text-muted md:text-lg">
            Platform yang menyediakan informasi obat terlengkap menggunakan rujukan resmi dan diverifikasi apoteker, demi akurasi pelayanan kesehatan.
          </p>
          <MedicineSearchForm prominent className="mt-7 max-w-2xl" />
        </div>
        <MedicineHeroArt />
      </section>

      <aside className="mx-auto mt-12 max-w-3xl rounded-xl border border-error/80 bg-[#f9ecec] px-6 py-5 text-center text-sm leading-7 text-[#8c2b2b] md:text-base" aria-label="Catatan penyimpanan">
        <strong>Catatan:</strong> penyimpanan permanen tidak aktif di lingkungan ini — data hanya bertahan selama halaman terbuka.
      </aside>

      <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Keunggulan PustakaObat.id">
        {trustPoints.map(({ icon: Icon, title, copy }) => (
          <div key={title} className="flex gap-3 rounded-2xl border border-border bg-surface p-5">
            <Icon className="mt-0.5 shrink-0 text-primary" size={23} aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-text">{title}</h2>
              <p className="mt-2 text-sm leading-7 text-text-muted">{copy}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
