import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Clock, ShieldAlert, LogOut, Mail } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      
      <div className="w-full max-w-lg relative z-10 flex flex-col gap-10">
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Link href="/">
            <Logo className="scale-110 mb-2" />
          </Link>
          <div className="h-px w-16 bg-border mb-4" />
        </div>

        <Card className="border-none shadow-2xl bg-surface/50 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
          <CardHeader className="pt-12 text-center pb-2">
            <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center text-warning mx-auto mb-6">
              <Clock size={32} className="animate-pulse" />
            </div>
            <CardTitle className="text-3xl">Pendaftaran Sedang Ditinjau</CardTitle>
            <CardDescription className="text-base text-text-muted mt-2">
              Akun apoteq Anda saat ini sedang menunggu persetujuan dari administrator.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8 pb-10 px-8">
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-surface-2 border border-border flex gap-4 text-sm leading-relaxed text-text">
                <ShieldAlert className="text-primary shrink-0" size={20} />
                <p>
                  Untuk memastikan integritas informasi obat, setiap akun Apoteker Reviewer harus diperiksa secara manual oleh Admin Apoteq.
                </p>
              </div>
              
              <div className="space-y-4 text-center">
                <p className="text-sm text-text-muted">
                  Berapa lama proses ini? Biasanya memakan waktu kurang dari 24 jam di hari kerja. 
                  Anda akan menerima email pemberitahuan segera setelah akun diaktifkan.
                </p>
                <div className="flex justify-center gap-6 pt-2">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">Status</span>
                    <span className="text-sm font-semibold text-warning px-3 py-1 rounded-full bg-warning/5 border border-warning/10 italic">
                      Pending Approval
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="pb-12 pt-0 flex flex-col gap-3">
            <Button variant="primary" className="w-full" asChild>
              <Link href="mailto:admin@apoteq.id">
                <Mail className="mr-2 h-4 w-4" />
                Hubungi Admin
              </Link>
            </Button>
            <form action="/api/auth/logout" method="post" className="w-full">
              <Button variant="ghost" className="w-full text-text-muted hover:text-error" type="submit">
                <LogOut className="mr-2 h-4 w-4" />
                Keluar
              </Button>
            </form>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-text-muted animate-in fade-in duration-1000 delay-300">
          Butuh bantuan segera? Email kami di <span className="text-primary font-medium">support@apoteq.id</span>
        </p>
      </div>
    </div>
  )
}
