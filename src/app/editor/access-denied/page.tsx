import Link from 'next/link'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { Button } from '@/components/ui/Button'

export default function EditorAccessDeniedPage() {
  return <AuthPageShell eyebrow="Akses Editor"><div className="max-w-md text-center"><h1 className="font-serif text-3xl text-text">Akses Editor belum tersedia</h1><p className="mt-3 text-text-muted">Akun ini belum ditetapkan sebagai Editor aktif.</p><Button asChild className="mt-7"><Link href="/masuk">Kembali ke login</Link></Button></div></AuthPageShell>
}
