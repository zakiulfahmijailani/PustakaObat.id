import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton'
import { Card, CardContent } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default function SuperAdminLoginPage() {
  return <AuthPageShell eyebrow="Super Admin"><Card className="w-full max-w-md border border-text/10 bg-text text-white shadow-2xl"><CardContent className="p-9 text-center"><ShieldCheck className="mx-auto mb-5" size={42} /><h1 className="text-3xl font-serif">Masuk sebagai Super Admin</h1><p className="mt-3 text-sm leading-relaxed text-white/70">Gunakan email Google developer yang sudah dipraotorisasi. Anda akan memilih ruang kerja setelah masuk.</p><div className="mt-8 rounded-2xl bg-white p-1 text-text"><GoogleAuthButton label="Masuk dengan Google" intent="super_admin_login" /></div><Link href="/masuk" className="mt-6 inline-block text-sm font-semibold text-white/80 hover:text-white hover:underline">Kembali ke pilihan akses</Link></CardContent></Card></AuthPageShell>
}
