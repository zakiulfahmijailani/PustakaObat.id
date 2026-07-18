'use client'

import Link from 'next/link'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function RouteErrorState({ reset, workspace = false }: { reset: () => void; workspace?: boolean }) {
  return (
    <div className={workspace ? 'py-12' : 'container px-4 pb-24 pt-8'} role="alert">
      <div className="mx-auto max-w-2xl rounded-3xl border border-error/25 bg-error/5 p-8 text-center md:p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-error/10 text-error"><AlertTriangle size={28} aria-hidden="true" /></div>
        <h1 className="mt-5 text-2xl font-bold text-text md:text-3xl">Halaman belum dapat dimuat</h1>
        <p className="mx-auto mt-3 max-w-lg text-base leading-7 text-text-muted">Data Anda tidak dihapus. Coba muat ulang bagian ini. Jika gangguan berlanjut, kembali ke halaman sebelumnya dan ulangi beberapa saat lagi.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" onClick={reset}><RotateCcw size={17} /> Coba lagi</Button>
          {!workspace && <Button asChild variant="outline"><Link href="/">Kembali ke beranda</Link></Button>}
        </div>
      </div>
    </div>
  )
}
