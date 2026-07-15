import Link from 'next/link'
import { ShieldX } from 'lucide-react'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

export default function AdminAccessDeniedPage() {
  return <AuthPageShell eyebrow="Akses terbatas"><Card className="w-full max-w-lg border-none shadow-2xl"><CardContent className="flex flex-col items-center p-10 text-center">
    <ShieldX className="mb-5 text-error" size={44} /><h1 className="text-3xl font-serif text-text">Akses Admin tidak ditemukan</h1>
    <p className="mt-3 text-sm leading-relaxed text-text-muted">Akun Google ini tidak terhubung dengan profil Admin aktif. Admin harus dipraotorisasi melalui bootstrap atau undangan internal.</p>
    <Button asChild className="mt-7 w-full"><Link href="/reviewer/login">Masuk sebagai Reviewer</Link></Button>
    <LogoutButton variant="outline" className="mt-3 w-full">Ganti akun Google</LogoutButton>
  </CardContent></Card></AuthPageShell>
}
