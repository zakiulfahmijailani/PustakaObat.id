import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Shield, Search, Pill, ChevronRight, BadgeCheck, Clock, User, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'

export default async function VerificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = createClient()
  const { data: { user } } = await (await supabase).auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await (await supabase)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'verifier' && profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  let query = (await supabase)
    .from('drugs')
    .select(`
      *,
      drug_categories(name),
      submitted_by_profile:profiles!drugs_submitted_by_fkey(full_name)
    `)
    .eq('status', 'review')
    .order('updated_at', { ascending: true }) // First in, first out

  if (q) {
    query = query.ilike('name', `%${q}%`)
  }

  const { data: drugs } = await query

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden">
        <div className="animate-in fade-in slide-in-from-left-4 duration-700">
          <Badge variant="warning" className="px-5 py-2 rounded-full uppercase text-xs font-bold tracking-wide bg-warning/5 border-warning/10 text-warning mb-4">
            Akses Verifikator
          </Badge>
          <h2 className="text-3xl font-serif text-text leading-tight font-semibold">Antrean Verifikasi Monografi</h2>
          <p className="text-text-muted mt-1 leading-relaxed">
            Review draft monografi obat sebelum dipublikasikan ke halaman publik PustakaObat.id.
          </p>
        </div>
        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-700">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wide">Kapasitas Queue</span>
            <span className="text-2xl font-bold text-text">{drugs?.length || 0}</span>
          </div>
          <div className="w-px h-10 bg-border" />
          <Shield size={32} className="text-primary opacity-20" />
        </div>
      </div>

      <div className="grid lg:grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
        <form action="" method="get" className="relative group max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" size={18} />
          <input 
            name="q"
            defaultValue={q}
            type="text" 
            placeholder="Cari dalam antrean..." 
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-surface-2/40 border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
          />
        </form>

        {drugs && drugs.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {drugs.map((drug) => (
              <Card key={drug.id} className="border-none bg-surface-2/40 hover:bg-surface-2 transition-all p-2 rounded-3xl group">
                <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-10">
                  <div className="flex items-center gap-8 flex-1 min-w-0">
                    <div className="w-16 h-16 rounded-2xl bg-warning/5 flex items-center justify-center text-warning group-hover:scale-110 transition-transform duration-500 shrink-0">
                      <Pill size={32} />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-3">
                        <h4 className="text-2xl font-bold font-serif text-text truncate group-hover:text-primary transition-colors">
                          {drug.name}
                        </h4>
                        <Badge variant="warning" className="h-6">UNDER REVIEW</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-text-muted uppercase tracking-widest">
                        <span className="flex items-center gap-2">
                          <User size={14} className="text-primary" />
                          {drug.submitted_by_profile?.full_name || 'Pharmacist'}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span className="flex items-center gap-2">
                          <Clock size={14} className="text-primary" />
                          SUBMITTED: {new Date(drug.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span>{drug.drug_categories?.name || 'UMUM'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Button size="lg" className="rounded-2xl h-14 px-8 gap-3 shadow-xl shadow-primary/10" asChild>
                      <Link href={`/dashboard/verifikasi/${drug.id}`}>
                        <BadgeCheck size={20} />
                        Mulai Verifikasi
                        <ChevronRight size={18} />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-10 bg-surface-2/40 rounded-[4rem] border border-dashed border-border px-8">
            <div className="w-24 h-24 rounded-full bg-border/20 flex items-center justify-center text-text-muted/20">
              <Shield size={48} />
            </div>
            <div className="space-y-4">
              <h3 className="text-3xl font-serif text-text">Antrean Kosong</h3>
              <p className="text-text-muted max-w-sm mx-auto leading-relaxed text-lg">
                Bagus! Semua draft monografi telah ditinjau. Belum ada tugas verifikasi baru untuk Anda saat ini.
              </p>
            </div>
            <Button variant="outline" size="lg" className="rounded-full px-12 h-14" asChild>
              <Link href="/dashboard">Kembali ke Ringkasan</Link>
            </Button>
          </div>
        )}
      </div>

      <div className="pt-20 border-t border-border flex flex-col items-center text-center gap-6">
        <AlertCircle size={48} className="text-primary opacity-20" />
        <h4 className="text-xl font-serif">Protokol Verifikasi</h4>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl">
          {[
            'Verifikasi keakuratan terminologi medis.',
            'Pastikan dosis sesuai dengan referensi klinis.',
            'Gunakan nada bahasa profesional & edukatif.'
          ].map((text, i) => (
            <div key={i} className="p-6 rounded-2xl bg-surface-2 border border-border text-xs font-bold text-text-muted uppercase tracking-widest leading-loose">
              {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
