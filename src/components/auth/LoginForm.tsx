import Link from 'next/link'
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'

export function LoginForm({ intent = 'reviewer_login' }: { intent?: 'reviewer_login' | 'editor_login' | 'admin_login' }) {
  const isEditor = intent === 'editor_login'
  return (
    <Card className="w-full max-w-md border-none bg-surface/50 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-1 pb-8 text-center">
        <CardTitle className="text-3xl">Masuk sebagai {isEditor ? 'Editor' : 'Reviewer'}</CardTitle>
        <CardDescription>{isEditor ? 'Gunakan akun Google yang terhubung dengan profil Editor Anda.' : 'Gunakan akun Google yang terhubung dengan profil Apoteker Reviewer Anda.'}</CardDescription>
      </CardHeader>
      <CardContent>
        <GoogleAuthButton label="Masuk dengan Google" intent={intent} />
        <p className="mt-5 text-center text-xs leading-relaxed text-text-muted">Login tidak membuat akun baru. Akses ruang kerja diberikan oleh administrator.</p>
      </CardContent>
      <CardFooter className="flex justify-center pb-8 pt-0 text-center">
        {!isEditor && <p className="text-sm text-text-muted">Belum menjadi reviewer? <Link href="/reviewer/register" className="font-semibold text-primary hover:underline">Ajukan pendaftaran</Link></p>}
      </CardFooter>
    </Card>
  )
}
