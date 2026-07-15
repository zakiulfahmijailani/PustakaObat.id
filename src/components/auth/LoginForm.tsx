import Link from 'next/link'
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'

export function LoginForm() {
  return (
    <Card className="w-full max-w-md border-none bg-surface/50 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-1 pb-8 text-center">
        <CardTitle className="text-3xl">Masuk ke Apoteq</CardTitle>
        <CardDescription>Gunakan akun Google yang terhubung dengan profil Reviewer atau Admin.</CardDescription>
      </CardHeader>
      <CardContent>
        <GoogleAuthButton label="Masuk dengan Google" />
        <p className="mt-5 text-center text-xs leading-relaxed text-text-muted">Apoteq hanya meminta identitas dasar Google: nama, email terverifikasi, dan foto profil. Role tetap ditentukan oleh Neon.</p>
      </CardContent>
      <CardFooter className="flex justify-center pb-8 pt-0 text-center">
        <p className="text-sm text-text-muted">Belum menjadi reviewer? <Link href="/register" className="font-semibold text-primary hover:underline">Ajukan pendaftaran</Link></p>
      </CardFooter>
    </Card>
  )
}
