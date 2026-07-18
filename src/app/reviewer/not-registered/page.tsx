import Link from 'next/link'
import { UserRoundX } from 'lucide-react'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

export default function ReviewerNotRegisteredPage() {
  return <AuthPageShell eyebrow="Akun belum terdaftar"><Card className="w-full max-w-lg border-none shadow-2xl"><CardContent className="flex flex-col items-center p-10 text-center">
    <UserRoundX className="mb-5 text-primary" size={44} /><h1 className="text-3xl font-serif text-text">Belum ada profil Reviewer</h1>
    <p className="mt-3 text-sm leading-relaxed text-text-muted">Akun Google ini berhasil diverifikasi, tetapi belum memiliki pengajuan Apoteker Reviewer di PustakaObat.id.</p>
    <Button asChild className="mt-7 w-full"><Link href="/reviewer/register">Daftar sebagai Reviewer</Link></Button>
    <LogoutButton variant="outline" className="mt-3 w-full">Ganti akun Google</LogoutButton>
  </CardContent></Card></AuthPageShell>
}
