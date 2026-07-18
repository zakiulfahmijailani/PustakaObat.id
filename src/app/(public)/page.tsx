import Link from 'next/link'
import { ArrowRight, BookOpenCheck, Calculator, ClipboardCheck, Languages, Search, ShieldCheck, Stethoscope, TableProperties } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/layout/Logo'
import { MedicineSearchForm } from '@/components/drug/MedicineSearchForm'

const principles = [
  { icon: Languages, title: 'Bahasa yang mudah dipahami', copy: 'Penjelasan dirancang untuk membantu masyarakat memahami informasi obat, tanpa menghilangkan konteks pentingnya.' },
  { icon: BookOpenCheck, title: 'Sumber dapat ditelusuri', copy: 'Setiap monografi menyertakan asal informasi dan tanggal pembaruan agar pembaca dapat melihat dasarnya.' },
  { icon: ShieldCheck, title: 'Status peninjauan yang jelas', copy: 'Konten yang telah diterbitkan membedakan informasi yang sudah ditinjau apoteker dari yang masih disiapkan.' },
]

const steps = [
  { number: '01', title: 'Cari nama obat', copy: 'Gunakan nama Indonesia, Inggris, atau nama generik obat yang Anda ketahui.' },
  { number: '02', title: 'Baca ringkasannya', copy: 'Pelajari kegunaan, peringatan, efek samping, dan hal penting lain yang tersedia.' },
  { number: '03', title: 'Periksa sumber & status', copy: 'Lihat sumber informasi serta status peninjauan sebelum menggunakannya sebagai bahan edukasi.' },
]

const userPaths = [
  { icon: Search, title: 'Cari informasi obat', copy: 'Temukan monografi dan sumber resmi obat.', href: '/obat', label: 'Untuk semua pengguna' },
  { icon: Calculator, title: 'Rekomendasi dosis', copy: 'Hitung rekomendasi antibiotik neonatus.', href: '/kalkulator', label: 'Alat klinis' },
  { icon: ClipboardCheck, title: 'Evaluasi pemberian', copy: 'Bandingkan regimen aktual dengan rekomendasi.', href: '/kalkulator?mode=evaluation', label: 'Alat klinis' },
  { icon: TableProperties, title: 'Evaluasi banyak pasien', copy: 'Proses hingga 1.000 kasus melalui satu file Excel.', href: '/kalkulator?mode=batch', label: 'Alat klinis' },
]

export default function HomePage() {
  return (
    <div className="overflow-hidden pb-24">
      <section className="relative isolate px-4 pb-20 pt-10 md:pb-28 md:pt-16">
        <div className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(ellipse_at_top,_rgba(20,83,45,0.12),_transparent_68%)]" />
        <div className="container max-w-5xl text-center">
          <Badge className="border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">Pustaka Obat Indonesia</Badge>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold leading-[1.08] text-text sm:text-5xl md:text-7xl">
            Kenali obat Anda, dengan informasi yang <span className="text-primary">jelas.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-text-muted md:text-lg md:leading-8">
            PustakaObat.id membantu Anda memahami informasi obat dalam Bahasa Indonesia, dengan sumber yang dapat ditelusuri dan proses peninjauan yang transparan.
          </p>

          <MedicineSearchForm prominent className="mx-auto mt-9 max-w-3xl text-left" />
        </div>
      </section>

      <section className="container px-4 pb-8" aria-labelledby="choose-path-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Mulai dari kebutuhan Anda</p><h2 id="choose-path-title" className="mt-2 text-2xl font-bold text-text md:text-3xl">Apa yang ingin Anda lakukan?</h2></div>
          <p className="max-w-md text-sm leading-6 text-text-muted">Informasi publik dan alat klinis dipisahkan agar konteks penggunaannya tetap jelas.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {userPaths.map(({ icon: Icon, title, copy, href, label }) => (
            <Link key={title} href={href} className="group rounded-2xl border border-border bg-surface p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
              <div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={22} aria-hidden="true" /></span><span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text-muted">{label}</span></div>
              <h3 className="mt-5 text-lg font-bold text-text group-hover:text-primary">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-muted">{copy}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary">Buka <ArrowRight size={16} aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container px-4">
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm md:p-10">
          <div className="grid gap-6 md:grid-cols-[0.8fr_2.2fr] md:gap-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Cara menggunakan</p>
              <h2 className="mt-3 text-2xl font-bold leading-tight text-text md:text-3xl">Mulai dari informasi yang Anda perlukan.</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {steps.map((step) => (
                <div key={step.number} className="border-l-2 border-primary/20 pl-4">
                  <p className="text-xs font-bold tracking-widest text-primary">{step.number}</p>
                  <h3 className="mt-2 text-base font-bold text-text">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-text-muted">{step.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container px-4 py-20 md:py-28">
        <div className="grid items-start gap-10 md:grid-cols-[0.9fr_2.1fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Prinsip kami</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-text md:text-4xl">Informasi obat yang lebih mudah dipercaya.</h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-text-muted">Kami tidak menggantikan dokter atau apoteker. PustakaObat.id hadir sebagai titik awal yang jelas untuk memahami obat dan mempersiapkan pertanyaan yang tepat kepada tenaga kesehatan.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {principles.map(({ icon: Icon, title, copy }) => (
              <div key={title} className="rounded-2xl border border-border bg-surface p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={22} /></div>
                <h3 className="mt-5 text-base font-bold text-text">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-muted">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container px-4">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-7 py-10 text-white md:px-14 md:py-16">
          <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[#C99B3B]/20 blur-3xl" />
          <div className="relative grid items-center gap-10 md:grid-cols-[1.4fr_0.6fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/65">PustakaObat.id</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-bold leading-tight md:text-4xl">Informasi yang baik dimulai dari sumber yang jelas.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/80">Baca bagaimana kami menyusun, meninjau, dan menampilkan informasi obat kepada masyarakat.</p>
              <Button variant="secondary" size="lg" asChild className="mt-7 bg-white text-primary hover:bg-white/90">
                <Link href="/tentang">Tentang PustakaObat.id <ArrowRight size={18} /></Link>
              </Button>
            </div>
            <div className="hidden justify-center md:flex">
              <div className="rounded-3xl border border-white/15 bg-white/10 p-3 shadow-2xl"><Logo /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="container max-w-4xl px-4 pt-16 text-center">
        <div className="rounded-2xl border border-warning/20 bg-[#fff8eb] px-6 py-5 text-left text-sm leading-6 text-text-muted">
          <p className="flex gap-3"><Stethoscope className="mt-0.5 shrink-0 text-warning" size={20} /><span><strong className="text-text">Catatan penting.</strong> Informasi pada situs ini ditujukan untuk edukasi dan tidak menggantikan pemeriksaan, diagnosis, resep, atau konsultasi dengan dokter maupun apoteker.</span></p>
        </div>
      </section>
    </div>
  )
}
