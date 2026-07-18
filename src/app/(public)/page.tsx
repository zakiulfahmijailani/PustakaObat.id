import Link from 'next/link'
import { ArrowRight, BookOpenCheck, Languages, Search, ShieldCheck, Stethoscope } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/layout/Logo'

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

export default function HomePage() {
  return (
    <div className="overflow-hidden pb-24">
      <section className="relative isolate px-4 pb-20 pt-10 md:pb-28 md:pt-16">
        <div className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(ellipse_at_top,_rgba(20,83,45,0.12),_transparent_68%)]" />
        <div className="container max-w-5xl text-center">
          <Badge className="border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Pustaka Obat Indonesia</Badge>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold leading-[1.08] text-text sm:text-5xl md:text-7xl">
            Kenali obat Anda, dengan informasi yang <span className="text-primary">jelas.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-text-muted md:text-lg md:leading-8">
            PustakaObat.id membantu Anda memahami informasi obat dalam Bahasa Indonesia, dengan sumber yang dapat ditelusuri dan proses peninjauan yang transparan.
          </p>

          <form action="/obat" method="get" className="mx-auto mt-9 flex max-w-3xl items-center rounded-2xl border border-border bg-surface p-2 shadow-[0_18px_50px_-20px_rgba(20,83,45,0.35)] focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
            <label htmlFor="home-medicine-search" className="sr-only">Cari nama obat</label>
            <Search className="ml-4 shrink-0 text-primary" size={22} aria-hidden="true" />
            <input id="home-medicine-search" name="q" type="search" placeholder="Cari obat, misalnya Amoksisilin atau Amoxicillin" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-text-muted sm:text-base" />
            <Button type="submit" className="h-12 shrink-0 px-5 sm:px-7">Cari <span className="hidden sm:inline">obat</span><ArrowRight size={17} /></Button>
          </form>
          <p className="mt-4 text-sm text-text-muted">Coba: <Link href="/obat?q=amoxicillin" className="font-semibold text-primary underline underline-offset-4">amoxicillin</Link>, <Link href="/obat?q=paracetamol" className="font-semibold text-primary underline underline-offset-4">paracetamol</Link>, atau <Link href="/obat?q=metformin" className="font-semibold text-primary underline underline-offset-4">metformin</Link>.</p>
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
              <div className="rounded-3xl border border-white/15 bg-white/10 p-8 backdrop-blur-sm"><Logo className="[&>svg]:text-white [&>span]:text-white [&>span>span:last-child]:text-white/65" /></div>
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
