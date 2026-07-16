'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Clock3, Loader2, ShieldCheck, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

export interface ManagedAdminRow {
  id: string
  email: string
  full_name: string
  account_status: string
  is_active: boolean
  auth_user_id: number | null
  auth_provider: string | null
  auth_linked_at: string | null
  last_login_at: string | null
  created_at: string
  google_email: string | null
  google_email_verified: string | null
}

export function AdminManagement({ admins, currentAdminId }: { admins: ManagedAdminRow[]; currentAdminId: string }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Admin belum dapat disimpan.')

      setSuccess(`${result.admin.email} berhasil dipraotorisasi sebagai Admin.`)
      setFullName('')
      setEmail('')
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Admin belum dapat disimpan.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="space-y-8">
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
      <Card className="h-fit border-none bg-error/5">
        <CardContent className="p-7">
          <UserPlus className="mb-5 text-error" size={30} />
          <h2 className="text-2xl font-serif text-text">Tambah Admin</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">Masukkan email Google yang akan digunakan. Akses baru tertaut setelah pemilik email masuk melalui halaman login Admin.</p>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <Input label="Nama lengkap" value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={3} maxLength={150} required autoComplete="name" placeholder="Nama Admin" />
            <Input label="Email Google" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} required autoComplete="email" placeholder="admin@example.com" helperText="Email harus sama persis dengan akun Google saat login pertama." />
            {error && <div className="flex gap-3 rounded-xl border border-error/20 bg-error/10 p-4 text-sm text-error" role="alert"><AlertCircle size={18} className="shrink-0" />{error}</div>}
            {success && <div className="flex gap-3 rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-success" role="status"><CheckCircle2 size={18} className="shrink-0" />{success}</div>}
            <Button className="w-full" disabled={loading} type="submit">{loading ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />}{loading ? 'Menyimpan...' : 'Praotorisasi Admin'}</Button>
          </form>
          <p className="mt-4 text-xs leading-5 text-text-muted">Form ini tidak dapat mempromosikan akun Reviewer. Perubahan role yang disengaja harus melalui proses terpisah dan teraudit.</p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4"><div><h2 className="text-2xl font-serif text-text">Admin terdaftar</h2><p className="mt-1 text-sm text-text-muted">{admins.length} profil Admin di Neon</p></div></div>
        {admins.map((admin) => {
          const linked = Boolean(admin.auth_user_id && admin.google_email)
          const active = admin.account_status === 'active' && admin.is_active
          return <Card key={admin.id} className="border-none bg-surface-2/40">
            <CardContent className="p-6">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-serif text-text">{admin.full_name}</h3>{admin.id === currentAdminId && <Badge>Anda</Badge>}<Badge variant={active ? 'success' : 'destructive'}>{active ? 'Aktif' : admin.account_status.replace('_', ' ')}</Badge></div>
                  <p className="mt-1 break-all text-sm text-text-muted">{admin.email}</p>
                </div>
                <Badge variant={linked ? 'success' : 'warning'} className="w-fit">{linked ? <CheckCircle2 size={13} className="mr-1" /> : <Clock3 size={13} className="mr-1" />}{linked ? 'Google tertaut' : 'Menunggu login pertama'}</Badge>
              </div>
              <div className="mt-5 grid gap-3 border-t border-border pt-4 text-xs text-text-muted sm:grid-cols-2">
                <p>Provider: <span className="font-medium text-text">{admin.auth_provider || 'Belum tertaut'}</span></p>
                <p>Login terakhir: <span className="font-medium text-text">{admin.last_login_at ? new Date(admin.last_login_at).toLocaleString('id-ID') : 'Belum pernah'}</span></p>
                {admin.google_email && <p className="sm:col-span-2">Identitas Google: <span className="font-medium text-text">{admin.google_email}</span></p>}
              </div>
            </CardContent>
          </Card>
        })}
      </div>
    </div>
  </div>
}
