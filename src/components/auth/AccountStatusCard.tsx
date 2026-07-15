import Link from 'next/link'
import { AlertTriangle, Ban, FileWarning, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card'

const icons = { needs_revision: FileWarning, rejected: Ban, suspended: AlertTriangle }

export function AccountStatusCard({ status }: { status: keyof typeof icons }) {
  const Icon = icons[status]
  const copy = {
    needs_revision: ['Data perlu diperbarui', 'Admin meminta koreksi pada pengajuan reviewer Anda. Hubungi admin untuk melihat catatan dan memperbarui data.'],
    rejected: ['Pengajuan belum disetujui', 'Pengajuan reviewer tidak dapat disetujui berdasarkan informasi yang diberikan.'],
    suspended: ['Akun ditangguhkan', 'Akses dashboard Anda sedang ditangguhkan. Hubungi Admin Apoteq untuk klarifikasi.'],
  }[status]

  return <div className="min-h-screen flex items-center justify-center bg-background p-4"><Card className="w-full max-w-lg border-none shadow-2xl"><CardHeader className="text-center pt-12"><Icon className="mx-auto mb-5 text-warning" size={48} /><CardTitle className="text-3xl">{copy[0]}</CardTitle><CardDescription className="mt-3 text-base">{copy[1]}</CardDescription></CardHeader><CardContent className="px-8 py-8 text-center text-sm text-text-muted">Status ini hanya mengatur akses akun Apoteq dan tidak mengubah data sumber WHO.</CardContent><CardFooter className="flex flex-col gap-3 pb-10"><Button asChild className="w-full"><Link href="mailto:admin@apoteq.id">Hubungi Admin</Link></Button><form action="/api/auth/logout" method="post" className="w-full"><Button type="submit" variant="ghost" className="w-full"><LogOut size={16} />Keluar</Button></form></CardFooter></Card></div>
}

