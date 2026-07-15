'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'

export function ReviewerRevisionForm({ profile }: { profile: { institution: string | null; professional_license_number: string | null; sipa_number: string | null; phone?: string | null } }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  return <Card className="w-full max-w-xl border-none shadow-2xl"><CardHeader><CardTitle className="text-3xl">Perbarui pengajuan reviewer</CardTitle><CardDescription>Perbaiki data profesi lalu kirim kembali untuk diperiksa admin.</CardDescription></CardHeader><CardContent><form className="space-y-5" onSubmit={async (event) => {
    event.preventDefault(); setLoading(true); setError(null)
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch('/api/account/reviewer-application', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution: form.get('institution'), professionalLicenseNumber: form.get('professionalLicenseNumber'), sipaNumber: form.get('sipaNumber'), phone: form.get('phone') }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Pengajuan belum dapat diperbarui.')
      router.push(result.redirectTo || '/pending-approval'); router.refresh()
    } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : 'Pengajuan belum dapat diperbarui.') } finally { setLoading(false) }
  }}>
    {error && <div className="flex gap-2 rounded-xl bg-error/10 p-4 text-sm text-error"><AlertCircle size={17} />{error}</div>}
    <Input name="institution" label="Institusi / Apotek" defaultValue={profile.institution || ''} required />
    <Input name="professionalLicenseNumber" label="Nomor Identitas Profesi / STRA" defaultValue={profile.professional_license_number || ''} required />
    <Input name="sipaNumber" label="Nomor SIPA (opsional)" defaultValue={profile.sipa_number || ''} />
    <Input name="phone" label="Nomor Telepon (opsional)" defaultValue={profile.phone || ''} />
    <Button type="submit" className="w-full" disabled={loading}>{loading ? <><Loader2 className="animate-spin" size={16} />Mengirim...</> : 'Kirim ulang pengajuan'}</Button>
  </form></CardContent></Card>
}

