import Link from 'next/link'
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'

export function RegisterForm() {
  return (
    <Card className="w-full max-w-lg border-none bg-surface/50 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-2 pb-8 text-center">
        <CardTitle className="text-3xl">Daftar Apoteker Reviewer</CardTitle>
        <CardDescription>Mulai dengan akun Google. Setelah itu lengkapi identitas profesi untuk diperiksa Admin Apoteq.</CardDescription>
      </CardHeader>
      <CardContent>
        <GoogleAuthButton label="Daftar sebagai Reviewer dengan Google" />
        <div className="mt-6 rounded-2xl border border-border bg-surface-2 p-4 text-sm leading-relaxed text-text-muted">Pendaftaran ini tidak langsung memberikan akses reviewer. Akun baru selalu berstatus <strong>pending review</strong> sampai disetujui admin.</div>
      </CardContent>
      <CardFooter className="flex justify-center pb-8 pt-0 text-center">
        <p className="text-sm text-text-muted">Sudah punya akun? <Link href="/login" className="font-semibold text-primary hover:underline">Masuk di sini</Link></p>
      </CardFooter>
    </Card>
  )
}
