import Link from 'next/link'
import { ArrowRight, BookMarked, CheckCircle2, ClipboardCheck, FileText, HeartHandshake, SearchCheck, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

const statuses = [
  { icon: FileText, title: 'Sedang disiapkan', copy: 'Obat dapat ditemukan sebagai katalog sumber, tetapi belum memiliki monografi Bahasa Indonesia yang diterbitkan.' },
  { icon: ClipboardCheck, title: 'Dalam peninjauan', copy: 'Bahan draf sedang diperiksa secara editorial dan belum ditampilkan sebagai informasi klinis lengkap untuk publik.' },
  { icon: CheckCircle2, title: 'Telah ditinjau', copy: 'Monografi telah diterbitkan beserta informasi sumber, tanggal pembaruan, dan status peninjauannya.' },
]

export const metadata = {
  title: 'Tentang Kami | PustakaObat.id',
  description: 'Pelajari tujuan, prinsip, sumber, dan proses peninjauan informasi di PustakaObat.id.',
}

export default function AboutPage() {
  return (
    <div className="pb-24">
      <section className="border-b border-border bg-surface-2/60 px-4 py-16 md:py-24">
        <div className="container max-w-4xl text-center">
          <Badge className="border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Tentang PustakaObat.id</Badge>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.1] text-text md:text-6xl">Pustaka informasi obat untuk Indonesia.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-text-muted md:text-lg md:leading-8">PustakaObat.id membantu masyarakat menemukan informasi obat yang lebih mudah dipahami, dengan sumber yang dapat ditelusuri dan proses peninjauan yang transparan.</p>
        </div>
      </section>

      <section className="container grid gap-10 px-4 py-16 md:grid-cols-[1fr_1fr] md:py-24">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Tujuan kami</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-text md:text-4xl">Membuat informasi obat lebih jelas, bukan lebih rumit.</h2>
        </div>
        <div className="space-y-5 text-sm leading-7 text-text-muted md:text-base">
          <p>Informasi obat sering kali tersebar, penuh istilah teknis, dan sulit dibandingkan. PustakaObat.id menyusun kembali informasi tersebut dalam Bahasa Indonesia yang lebih mudah dibaca, tanpa menghilangkan konteks penting untuk penggunaan yang aman.</p>
          <p>Kami bukan layanan diagnosis, resep, atau pengganti konsultasi. Informasi di sini dapat membantu Anda memahami obat dan menyiapkan pertanyaan yang tepat untuk dokter atau apoteker.</p>
        </div>
      </section>

      <section className="bg-surface-2/55 px-4 py-16 md:py-24">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Transparansi konten</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-text md:text-4xl">Setiap informasi memiliki status yang jelas.</h2>
            <p className="mt-4 text-sm leading-7 text-text-muted">Kami tidak ingin draf internal terlihat seperti informasi yang sudah final. Status berikut menjelaskan posisi konten yang Anda temui di PustakaObat.id.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {statuses.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="rounded-2xl border border-border bg-surface p-6">
                <Icon className="text-primary" size={25} />
                <h3 className="mt-5 text-lg font-bold text-text">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-muted">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container grid gap-8 px-4 py-16 md:grid-cols-3 md:py-24">
        <div className="rounded-2xl border border-border bg-surface p-6"><BookMarked className="text-primary" size={25} /><h2 className="mt-5 text-lg font-bold text-text">Sumber yang dapat ditelusuri</h2><p className="mt-2 text-sm leading-6 text-text-muted">Informasi klinis disusun dengan merujuk pada sumber resmi dan dokumen primer yang dicatat dalam jejak konten.</p></div>
        <div className="rounded-2xl border border-border bg-surface p-6"><SearchCheck className="text-primary" size={25} /><h2 className="mt-5 text-lg font-bold text-text">Pencarian dua bahasa</h2><p className="mt-2 text-sm leading-6 text-text-muted">Anda dapat mencari menggunakan nama obat Indonesia maupun Inggris untuk menemukan konsep obat yang sama.</p></div>
        <div className="rounded-2xl border border-border bg-surface p-6"><HeartHandshake className="text-primary" size={25} /><h2 className="mt-5 text-lg font-bold text-text">Dikembangkan bertahap</h2><p className="mt-2 text-sm leading-6 text-text-muted">Monografi diterbitkan secara bertahap agar setiap bagian dapat melalui proses editorial dan peninjauan yang sesuai.</p></div>
      </section>

      <section className="container px-4">
        <div className="rounded-3xl border border-warning/25 bg-[#fff8eb] p-7 md:p-10">
          <div className="flex gap-4"><ShieldAlert className="mt-1 shrink-0 text-warning" size={24} /><div><h2 className="text-xl font-bold text-text">Batasan informasi kesehatan</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted">PustakaObat.id hanya untuk edukasi. Jangan memulai, menghentikan, atau mengubah penggunaan obat berdasarkan informasi di situs ini tanpa berbicara dengan dokter atau apoteker. Dalam keadaan darurat, segera hubungi layanan kesehatan terdekat.</p></div></div>
        </div>
      </section>

      <section className="container px-4 pt-16 text-center">
        <h2 className="text-2xl font-bold text-text md:text-3xl">Mulai dari obat yang ingin Anda pahami.</h2>
        <Button asChild size="lg" className="mt-6"><Link href="/obat">Cari obat <ArrowRight size={18} /></Link></Button>
      </section>
    </div>
  )
}
