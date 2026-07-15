import { Building2, Mail, Phone, ShieldCheck } from 'lucide-react'
import { requireReviewer } from '@/lib/auth/server'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'

export default async function ReviewerProfilePage() {
  const { profile } = await requireReviewer()
  const details = [
    { label: 'Email Google', value: profile.email, icon: Mail },
    { label: 'Institusi / Apotek', value: profile.institution || 'Belum diisi', icon: Building2 },
    { label: 'Nomor telepon', value: profile.phone || 'Belum diisi', icon: Phone },
    { label: 'Identitas profesi / STRA', value: profile.professional_license_number || 'Belum diisi', icon: ShieldCheck },
  ]
  return <div className="space-y-8"><div><Badge className="mb-4">Reviewer aktif</Badge><h1 className="text-4xl font-serif text-text">{profile.full_name}</h1><p className="mt-2 text-text-muted">Profil profesi yang digunakan untuk identitas dan audit verifikasi.</p></div><div className="grid gap-5 md:grid-cols-2">{details.map((detail) => <Card key={detail.label} className="border-none bg-surface-2/50"><CardContent className="flex gap-4 p-6"><detail.icon className="mt-1 text-primary" size={21} /><div><p className="text-xs font-bold uppercase tracking-wider text-text-muted">{detail.label}</p><p className="mt-2 text-text">{detail.value}</p></div></CardContent></Card>)}</div><p className="rounded-2xl border border-border bg-surface p-5 text-sm text-text-muted">Perubahan identitas profesi yang sensitif perlu diperiksa Admin agar jejak verifikasi tetap dapat dipercaya.</p></div>
}
