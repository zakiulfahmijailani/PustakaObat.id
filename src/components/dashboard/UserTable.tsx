'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2, PauseCircle, RotateCcw, User as UserIcon, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Textarea'

export interface AdminProfileRow {
  id: string
  email: string
  full_name: string
  role: string
  account_status: string
  is_active: boolean
  institution: string | null
  sipa_number: string | null
  professional_license_number: string | null
  phone: string | null
  created_at: string
  last_login_at: string | null
  application_status: string | null
  review_note: string | null
  submitted_at: string | null
}

export const UserTable = ({ profiles, currentUserId }: { profiles: AdminProfileRow[]; currentUserId: string }) => {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const router = useRouter()

  const performAction = async (profileId: string, action: 'approve' | 'reject' | 'needs_revision' | 'suspend' | 'reactivate') => {
    setLoading(`${profileId}:${action}`)
    setError(null)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, action, note: notes[profileId] || '' }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Perubahan belum dapat disimpan.')
      router.refresh()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Perubahan belum dapat disimpan.')
    } finally {
      setLoading(null)
    }
  }

  return <div className="space-y-5">
    {error && <div className="rounded-xl border border-error/20 bg-error/10 p-4 text-sm text-error flex gap-3" role="alert"><AlertCircle size={18} />{error}</div>}
    {profiles.map((profile) => {
      const pending = ['pending_review', 'needs_revision'].includes(profile.account_status)
      const busy = loading?.startsWith(profile.id)
      return <Card key={profile.id} className="border-none bg-surface-2/40 rounded-3xl"><CardContent className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex gap-5 min-w-0"><div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-white ${profile.is_active ? 'bg-primary' : 'bg-text-muted/50'}`}>{profile.full_name?.charAt(0) || <UserIcon />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-serif text-text">{profile.full_name}</h2><Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>{profile.role}</Badge><Badge variant={profile.account_status === 'active' ? 'success' : profile.account_status === 'rejected' || profile.account_status === 'suspended' ? 'destructive' : 'warning'}>{profile.account_status.replace('_', ' ')}</Badge></div><p className="mt-1 text-sm text-text-muted">{profile.email}</p><p className="mt-2 text-xs text-text-muted">{profile.institution || 'Institusi belum diisi'} · STRA/profesi: {profile.professional_license_number || '—'} · SIPA: {profile.sipa_number || '—'}</p></div></div>
          <p className="text-xs text-text-muted">Diajukan {new Date(profile.submitted_at || profile.created_at).toLocaleDateString('id-ID')}</p>
        </div>
        {profile.role === 'reviewer' && profile.id !== currentUserId && <div className="space-y-3 border-t border-border pt-5">
          <Textarea placeholder="Catatan admin (wajib untuk tolak, revisi, atau penangguhan)" value={notes[profile.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [profile.id]: event.target.value }))} />
          <div className="flex flex-wrap gap-2">
            {pending && <Button size="sm" onClick={() => performAction(profile.id, 'approve')} disabled={busy}>{loading === `${profile.id}:approve` ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}Setujui</Button>}
            {pending && <Button size="sm" variant="outline" onClick={() => performAction(profile.id, 'needs_revision')} disabled={busy}><RotateCcw size={15} />Minta revisi</Button>}
            {pending && <Button size="sm" variant="destructive" onClick={() => performAction(profile.id, 'reject')} disabled={busy}><XCircle size={15} />Tolak</Button>}
            {profile.account_status === 'active' && <Button size="sm" variant="destructive" onClick={() => performAction(profile.id, 'suspend')} disabled={busy}><PauseCircle size={15} />Tangguhkan</Button>}
            {['suspended', 'rejected'].includes(profile.account_status) && <Button size="sm" onClick={() => performAction(profile.id, 'reactivate')} disabled={busy}><CheckCircle2 size={15} />Aktifkan kembali</Button>}
          </div>
        </div>}
      </CardContent></Card>
    })}
  </div>
}
