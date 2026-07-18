import React from 'react'
import Link from 'next/link'
import { ArrowUpRight, BookOpen, ShieldAlert } from 'lucide-react'
import { Logo } from './Logo'

export const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-border bg-surface-2/70">
      <div className="container grid grid-cols-1 gap-12 py-14 md:grid-cols-[1.5fr_0.7fr_0.9fr] md:py-16">
        <div>
          <Logo className="mb-5" />
          <p className="max-w-md text-sm leading-7 text-text-muted">
            PustakaObat.id adalah perpustakaan informasi obat berbahasa Indonesia. Kami menyajikan sumber yang dapat ditelusuri dan status peninjauan yang jelas.
          </p>
        </div>

        <div>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-text">Jelajahi</h2>
          <ul className="space-y-3 text-sm text-text-muted">
            <li><Link href="/" className="hover:text-primary">Beranda</Link></li>
            <li><Link href="/obat" className="hover:text-primary">Cari obat</Link></li>
            <li><Link href="/tentang" className="hover:text-primary">Tentang kami</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-text">Akses profesional</h2>
          <Link href="/masuk" className="group inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover">
            Masuk admin & reviewer <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-3 max-w-xs text-xs leading-5 text-text-muted">Area editorial dipisahkan dari informasi yang dapat diakses masyarakat.</p>
        </div>
      </div>

      <div className="border-y border-border bg-surface/70">
        <div className="container flex gap-3 py-4 text-xs leading-5 text-text-muted">
          <ShieldAlert className="mt-0.5 shrink-0 text-warning" size={17} aria-hidden="true" />
          <p><strong className="text-text">Untuk edukasi, bukan pengganti konsultasi.</strong> Informasi di PustakaObat.id tidak menggantikan pemeriksaan, diagnosis, resep, atau saran dari dokter maupun apoteker.</p>
        </div>
      </div>

      <div className="container flex flex-col gap-3 py-6 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© {currentYear} PustakaObat.id · Pustaka Obat Indonesia</p>
        <p className="flex items-center gap-1.5"><BookOpen size={14} aria-hidden="true" /> Dibangun untuk akses informasi obat yang lebih jelas.</p>
      </div>
    </footer>
  )
}
