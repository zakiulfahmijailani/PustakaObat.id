import { BookOpenCheck, Languages, ShieldCheck, Stethoscope } from 'lucide-react'
import { MedicineHeroArt } from '@/components/drug/MedicineHeroArt'
import { MedicineSearchForm } from '@/components/drug/MedicineSearchForm'

const trustPoints = [
  { icon: ShieldCheck, title: 'Sumber resmi', copy: 'WHO dan sumber primer terkurasi' },
  { icon: BookOpenCheck, title: 'Ditinjau apoteker', copy: 'Jejak verifikasi tampil transparan' },
  { icon: Languages, title: 'Bahasa Indonesia', copy: 'Disusun agar mudah dipahami' },
  { icon: Stethoscope, title: 'Edukasi kesehatan', copy: 'Mendukung konsultasi profesional' },
]

export default function HomePage() {
  return (
    <main className="container px-4 pb-16 pt-6 md:pb-20 md:pt-8">
      <section className="grid items-center gap-8 md:grid-cols-[1.25fr_0.75fr] md:gap-14" aria-labelledby="home-title">
        <div>
          <h1 id="home-title" className="max-w-3xl text-4xl font-normal leading-[1.02] tracking-[-0.055em] text-text sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="block">Pusat rujukan</span>
            <span className="block"><span className="text-primary">informasi obat</span> untuk</span>
            <span className="block">Indonesia.</span>
          </h1>
          <p className="mt-7 max-w-3xl text-base leading-8 text-text-muted md:text-lg">
            Cari nama obat untuk membaca informasi penting dalam Bahasa Indonesia, bersumber jelas, dan diterbitkan melalui peninjauan apoteker.
          </p>
          <MedicineSearchForm prominent className="mt-8 max-w-2xl" />
        </div>
        <MedicineHeroArt />
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Keunggulan PustakaObat.id">
        {trustPoints.map(({ icon: Icon, title, copy }) => (
          <div key={title} className="flex gap-4 rounded-2xl border border-border bg-surface px-5 py-6">
            <Icon className="mt-0.5 shrink-0 text-primary" size={23} aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-text">{title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-text-muted">{copy}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
