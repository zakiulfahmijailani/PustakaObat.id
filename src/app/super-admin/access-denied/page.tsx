import Link from 'next/link'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { Button } from '@/components/ui/Button'

export default function SuperAdminAccessDeniedPage() {
  return <AuthPageShell eyebrow="Akses ditolak"><div className="max-w-md text-center"><h1 className="font-serif text-3xl text-text">Akun ini bukan Super Admin</h1><p className="mt-3 text-text-muted">Gunakan email Google developer yang telah dipraotorisasi.</p><Button asChild className="mt-7"><Link href="/masuk">Kembali ke login</Link></Button></div></AuthPageShell>
}
