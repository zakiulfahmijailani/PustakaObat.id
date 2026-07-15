import { CheckCircle2, KeyRound, ShieldCheck, UserPlus, XCircle } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/server'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  await requireAdmin()
  const checks = [
    { name: 'DATABASE_URL', configured: Boolean(process.env.DATABASE_URL), description: 'Koneksi server-only ke Neon PostgreSQL.' },
    { name: 'AUTH_SECRET', configured: Boolean(process.env.AUTH_SECRET), description: 'Secret penandatanganan Auth.js.' },
    { name: 'AUTH_GOOGLE_ID', configured: Boolean(process.env.AUTH_GOOGLE_ID), description: 'Google OAuth Web Client ID.' },
    { name: 'AUTH_GOOGLE_SECRET', configured: Boolean(process.env.AUTH_GOOGLE_SECRET), description: 'Google OAuth Client Secret.' },
  ]
  return <div className="space-y-8"><div><Badge variant="destructive" className="mb-4">Admin only</Badge><h1 className="text-4xl font-serif text-text">Pengaturan sistem</h1><p className="mt-2 text-text-muted">Status konfigurasi ditampilkan tanpa pernah mengekspos nilai rahasia.</p></div><div className="grid gap-4 md:grid-cols-2">{checks.map((check) => <Card key={check.name} className="border-none bg-surface-2/50"><CardContent className="flex gap-4 p-6">{check.configured ? <CheckCircle2 className="text-success" /> : <XCircle className="text-error" />}<div><div className="flex flex-wrap items-center gap-2"><code className="font-bold text-text">{check.name}</code><Badge variant={check.configured ? 'success' : 'destructive'}>{check.configured ? 'configured' : 'missing'}</Badge></div><p className="mt-2 text-sm text-text-muted">{check.description}</p></div></CardContent></Card>)}</div><Card className="border-none bg-error/5"><CardContent className="p-7"><UserPlus className="mb-4 text-error" /><h2 className="text-xl font-serif">Praotorisasi Admin Google</h2><p className="mt-2 text-sm text-text-muted">Admin tidak dapat mendaftar dari halaman publik. Jalankan perintah berikut dari lingkungan tepercaya dengan <code>DATABASE_URL</code> production untuk memasukkan email Google yang diizinkan.</p><pre className="mt-4 overflow-x-auto rounded-xl bg-text p-4 text-xs text-white"><code>npm run admin:bootstrap -- --email admin@example.com --name &quot;Admin Apoteq&quot;</code></pre><p className="mt-3 text-xs text-text-muted">Jangan memasukkan data secara manual ke tabel Auth.js <code>users</code>, <code>accounts</code>, atau <code>sessions</code>. Tabel tersebut akan terisi saat pemilik email login dengan Google.</p></CardContent></Card><div className="grid gap-5 md:grid-cols-2"><Card className="border-none bg-primary/5"><CardContent className="p-7"><ShieldCheck className="mb-4 text-primary" /><h2 className="text-xl font-serif">Pemisahan role</h2><p className="mt-2 text-sm text-text-muted">Role selalu dibaca dari profil Neon. Auth intent hanya mengatur pengalaman masuk.</p></CardContent></Card><Card className="border-none bg-surface-2/50"><CardContent className="p-7"><KeyRound className="mb-4 text-primary" /><h2 className="text-xl font-serif">Rahasia server</h2><p className="mt-2 text-sm text-text-muted">Ubah nilai environment melalui Vercel atau environment lokal, bukan melalui browser.</p></CardContent></Card></div></div>
}
