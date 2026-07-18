'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'

const schema = z.object({
  fullName: z.string().min(3, 'Nama lengkap minimal 3 karakter'),
  institution: z.string().min(3, 'Nama institusi/apotek minimal 3 karakter'),
  professionalLicenseNumber: z.string().min(4, 'Nomor identitas profesi wajib diisi'),
  sipaNumber: z.string().optional(),
  phone: z.string().optional(),
})

type Values = z.infer<typeof schema>

export function ReviewerOnboardingForm({ name, email }: { name: string; email: string }) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: name },
  })

  const submit = async (values: Values) => {
    setError(null)
    const response = await fetch('/api/auth/reviewer-onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(result.error || 'Pendaftaran belum dapat diproses.')
      return
    }

    setSuccess(true)
    router.push(result.redirectTo || '/pending-approval')
    router.refresh()
  }

  if (success) {
    return <Card className="w-full max-w-lg border-none shadow-2xl"><CardContent className="flex flex-col items-center gap-5 py-12 text-center"><CheckCircle2 className="text-success" size={48} /><h2 className="text-2xl font-bold">Pengajuan berhasil dikirim</h2><p className="text-text-muted">Admin PustakaObat.id akan memeriksa identitas profesi Anda.</p></CardContent></Card>
  }

  return (
    <Card className="w-full max-w-lg border-none bg-surface/50 shadow-2xl backdrop-blur-xl">
      <CardHeader className="pb-8 text-center">
        <CardTitle className="text-3xl">Lengkapi Profil Reviewer</CardTitle>
        <CardDescription>Google telah memverifikasi <strong>{email}</strong>. Akses reviewer tetap memerlukan persetujuan admin.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(submit)} className="space-y-5">
          {error && <div className="flex items-center gap-3 rounded-xl border border-error/20 bg-error/10 p-4 text-sm text-error" role="alert"><AlertCircle size={18} />{error}</div>}
          <Input label="Nama Lengkap" autoComplete="name" {...register('fullName')} error={errors.fullName?.message} disabled={isSubmitting} />
          <Input label="Email Google" value={email} readOnly disabled helperText="Email berasal dari akun Google terverifikasi dan tidak dapat diubah di sini." />
          <Input label="Nama Institusi / Apotek" {...register('institution')} error={errors.institution?.message} disabled={isSubmitting} />
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Nomor Identitas Profesi / STRA" {...register('professionalLicenseNumber')} error={errors.professionalLicenseNumber?.message} disabled={isSubmitting} />
            <Input label="Nomor SIPA (opsional)" {...register('sipaNumber')} error={errors.sipaNumber?.message} disabled={isSubmitting} />
          </div>
          <Input label="Nomor Telepon (opsional)" autoComplete="tel" {...register('phone')} error={errors.phone?.message} disabled={isSubmitting} />
          <Button type="submit" className="h-12 w-full" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="animate-spin" size={18} />Mengirim pengajuan...</> : 'Ajukan Pendaftaran Reviewer'}</Button>
        </form>
      </CardContent>
    </Card>
  )
}
