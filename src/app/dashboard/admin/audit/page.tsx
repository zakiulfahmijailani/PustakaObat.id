import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Clock, Search, Activity, Database } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import { Profile } from '@/types'

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; q?: string }>
}) {
  const { action, q } = await searchParams
  const supabase = createClient()
  const { data: { user } } = await (await supabase).auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Admin Check
  const { data: profile } = await (await supabase)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  let query = (await supabase)
    .from('audit_logs')
    .select(`
      *,
      profile:profiles!audit_logs_user_id_fkey(full_name, role)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (action && action !== 'all') {
    query = query.eq('action', action)
  }

  const { data: logs } = await query

  const actionOptions = [
    { label: 'Semua Aktivitas', value: 'all' },
    { label: 'Login', value: 'LOGIN' },
    { label: 'Create Drug', value: 'CREATE_DRUG' },
    { label: 'Update Drug', value: 'UPDATE_DRUG' },
    { label: 'Approve Drug', value: 'APPROVE_DRUG' },
    { label: 'Reject Drug', value: 'REJECT_DRUG' },
    { label: 'Answer Question', value: 'ANSWER_QUESTION' },
    { label: 'Review WHO', value: 'REVIEW_WHO_MEDICINE' },
    { label: 'Update WHO', value: 'UPDATE_WHO_MEDICINE' },
  ]

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden">
        <div className="animate-in fade-in slide-in-from-left-4 duration-700">
          <Badge variant="destructive" className="px-5 py-2 rounded-full border-error/20 text-error bg-error/5 uppercase text-[10px] font-bold tracking-widest mb-4">
            Security & Compliance
          </Badge>
          <h2 className="text-3xl font-serif text-text leading-tight">Log Audit Sistem</h2>
          <p className="text-text-muted mt-1 leading-relaxed">
            Pantau seluruh aktivitas administratif dan editorial di platform apoteq.
          </p>
        </div>
        <div className="flex items-center gap-6 animate-in fade-in slide-in-from-right-4 duration-700">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Log Retention</span>
            <span className="text-2xl font-bold text-text">90 Hari</span>
          </div>
          <div className="w-px h-10 bg-border" />
          <Database size={32} className="text-primary opacity-20" />
        </div>
      </div>

      {/* Filters */}
      <Card className="border-none bg-surface-2/40 rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row gap-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <form action="" method="get">
              <input 
                name="q"
                type="text" 
                defaultValue={q}
                placeholder="Cari dalam log audit..." 
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
              <input type="hidden" name="action" value={action || 'all'} />
            </form>
          </div>
          
          <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            {actionOptions.map((opt) => (
              <Link 
                key={opt.value}
                href={`/dashboard/admin/audit?action=${opt.value}${q ? `&q=${q}` : ''}`}
                className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap border-2 transition-all ${
                  (action || 'all') === opt.value
                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/10'
                    : 'bg-transparent text-text-muted border-border hover:border-primary/30'
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
        <div className="space-y-4">
          {logs && logs.length > 0 ? (
            logs.map((log) => (
              <Card key={log.id} className="border-none bg-surface-2/40 hover:bg-surface-2 transition-all p-2 rounded-[2.5rem] group">
                <CardContent className="p-6 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-8 flex-1 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 transition-transform duration-500">
                      <Activity size={24} />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge className="font-bold tracking-widest text-[10px] uppercase py-1 shadow-sm">
                          {log.action}
                        </Badge>
                        <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
                          {new Date(log.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-lg font-serif text-text leading-tight font-medium">
                        {(log.profile as unknown as Profile | null)?.full_name || 'System'} <span className="text-text-muted font-sans font-normal text-sm lowercase">performed</span> {log.action.toLowerCase().replace('_', ' ')} <span className="text-text-muted font-sans font-normal text-sm lowercase">on</span> {log.resource_type || 'system'}
                      </p>
                      {log.metadata && (
                        <div className="p-4 rounded-xl bg-surface-2 border border-border text-xs font-medium text-text-muted font-mono overflow-hidden truncate">
                          {JSON.stringify(log.metadata)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 pr-4">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest leading-none">IP ADDRESS</span>
                      <span className="text-xs font-bold font-sans mt-1 text-primary italic">
                        {log.ip_address || '127.0.0.1'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 bg-surface-2/50 rounded-[3rem] border border-dashed border-border px-8">
              <div className="w-20 h-20 rounded-full bg-border/20 flex items-center justify-center text-text-muted/40">
                <Clock size={40} />
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-serif text-text">Belum ada log aktivitas</h3>
                <p className="text-text-muted max-w-sm mx-auto leading-relaxed text-base italic">
                  Seluruh tindakan user yang krusial akan dicatat secara otomatis di sini.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="pt-10 flex justify-center pb-20">
          <p className="text-xs text-text-muted/60 italic max-w-lg text-center leading-relaxed font-medium">
            * Seluruh audit log disimpan secara permanen untuk keperluan kepatuhan medis dan keamanan data farmakologi Indonesia.
          </p>
        </div>
      </div>
    </div>
  )
}
