import Link from 'next/link'
import { BookOpen, Home, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <main id="main-content" className="container flex min-h-screen items-center px-4 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BookOpen size={30} aria-hidden="true" /></div>
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.14em] text-primary">404 · Halaman tidak ditemukan</p>
        <h1 className="mt-3 text-4xl font-bold text-text md:text-5xl">Informasi yang Anda cari belum tersedia.</h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-text-muted">Periksa kembali alamat halaman, cari nama obat lain, atau kembali ke beranda PustakaObat.id.</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><Link href="/obat"><Search size={17} /> Cari obat</Link></Button><Button variant="outline" asChild><Link href="/"><Home size={17} /> Beranda</Link></Button></div>
      </div>
    </main>
  )
}
