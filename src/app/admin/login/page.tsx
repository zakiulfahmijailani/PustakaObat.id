import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton'
import { Card, CardContent } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default function AdminLoginPage() {
  return <AuthPageShell eyebrow="Administrator"><Card className="w-full max-w-md border border-text/10 bg-text text-white shadow-2xl"><CardContent className="p-9 text-center">
    <ShieldCheck className="mx-auto mb-5" size={42} /><h1 className="text-3xl font-serif">Masuk sebagai Admin</h1>
    <p className="mt-3 text-sm leading-relaxed text-white/70">Gunakan akun Google dengan email yang telah dipraotorisasi oleh Apoteq.</p>
    <div className="mt-8 rounded-2xl bg-white p-1 text-text"><GoogleAuthButton label="Masuk sebagai Admin dengan Google" intent="admin_login" /></div>
    <p className="mt-5 text-xs text-white/55">Akun Admin tidak dapat dibuat melalui pendaftaran publik.</p>
    <Link href="/reviewer/login" className="mt-6 inline-block text-sm font-semibold text-white/80 hover:text-white hover:underline">Masuk sebagai Reviewer</Link>
  </CardContent></Card></AuthPageShell>
}
