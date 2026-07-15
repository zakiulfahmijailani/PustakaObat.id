import Link from 'next/link'
import { BadgeCheck, ShieldCheck, UserRoundPlus } from 'lucide-react'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function AccessSelectionPage() {
  return (
    <AuthPageShell eyebrow="Akses staf Apoteq">
      <div className="w-full text-center">
        <h1 className="text-4xl font-serif text-text">Pilih ruang kerja Anda</h1>
        <p className="mx-auto mt-3 max-w-2xl text-text-muted">Reviewer dan Admin menggunakan Google OAuth yang sama, tetapi memiliki dashboard dan kewenangan yang berbeda.</p>
      </div>
      <div className="grid w-full gap-5 md:grid-cols-2">
        <Card className="border-none bg-surface/80 shadow-xl backdrop-blur"><CardContent className="flex h-full flex-col p-8">
          <div className="mb-6 w-fit rounded-2xl bg-primary/10 p-4 text-primary"><BadgeCheck size={30} /></div>
          <h2 className="text-2xl font-serif text-text">Apoteker Reviewer</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-text-muted">Tinjau data WHO, simpan keputusan verifikasi, dan lihat riwayat review profesional Anda.</p>
          <Button asChild className="mt-7"><Link href="/reviewer/login">Masuk sebagai Reviewer</Link></Button>
          <Button asChild variant="ghost" className="mt-2"><Link href="/reviewer/register"><UserRoundPlus size={17} /> Daftar sebagai Reviewer</Link></Button>
        </CardContent></Card>
        <Card className="border border-text/10 bg-text text-white shadow-xl"><CardContent className="flex h-full flex-col p-8">
          <div className="mb-6 w-fit rounded-2xl bg-white/10 p-4 text-white"><ShieldCheck size={30} /></div>
          <h2 className="text-2xl font-serif">Administrator</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-white/70">Kelola data, reviewer, import, dan audit sistem. Akses hanya untuk email yang sudah dipraotorisasi.</p>
          <Button asChild variant="outline" className="mt-7 border-white/30 bg-white text-text hover:bg-white/90"><Link href="/admin/login">Masuk sebagai Admin</Link></Button>
          <p className="mt-4 text-center text-xs text-white/55">Tidak tersedia pendaftaran Admin publik.</p>
        </CardContent></Card>
      </div>
    </AuthPageShell>
  )
}
