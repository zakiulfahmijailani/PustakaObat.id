'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'

const registerSchema = z.object({
  full_name: z.string().min(3, 'Nama lengkap minimal 3 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(10, 'Password minimal 10 karakter').regex(/[a-z]/, 'Tambahkan huruf kecil').regex(/[A-Z]/, 'Tambahkan huruf besar').regex(/[0-9]/, 'Tambahkan angka'),
  institution: z.string().min(3, 'Nama institusi/apotek minimal 3 karakter'),
  professional_license_number: z.string().min(4, 'Nomor identitas profesi wajib diisi'),
  sipa_number: z.string().optional(),
  phone: z.string().optional(),
})

type RegisterFormValues = z.infer<typeof registerSchema>

export const RegisterForm = () => {
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (values: RegisterFormValues) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: values.full_name,
          email: values.email,
          password: values.password,
          institution: values.institution,
          professionalLicenseNumber: values.professional_license_number,
          sipaNumber: values.sipa_number || '',
          phone: values.phone || '',
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Pendaftaran belum dapat diproses.')
      setIsSuccess(true)
      setTimeout(() => router.push(result.redirectTo || '/pending-approval'), 1600)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Terjadi kesalahan pendaftaran. Silakan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return <Card className="w-full max-w-lg border-none shadow-2xl bg-surface/50 backdrop-blur-xl"><CardContent className="pt-12 pb-12 flex flex-col items-center text-center gap-6"><div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center text-success"><CheckCircle2 size={48} /></div><div className="space-y-2"><h3 className="text-2xl font-bold text-text">Pengajuan berhasil dikirim</h3><p className="text-text-muted px-8">Admin Apoteq akan memeriksa identitas profesi Anda sebelum akses reviewer diaktifkan.</p></div></CardContent></Card>
  }

  return (
    <Card className="w-full max-w-lg border-none shadow-2xl bg-surface/50 backdrop-blur-xl">
      <CardHeader className="space-y-1 pb-8"><CardTitle className="text-3xl text-center">Daftar Apoteker Reviewer</CardTitle><CardDescription className="text-center text-text-muted">Akun reviewer hanya aktif setelah diperiksa oleh Admin Apoteq.</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {error && <div className="p-4 rounded-xl bg-error/10 border border-error/20 flex items-center gap-3 text-error text-sm" role="alert"><AlertCircle size={18} /><p>{error}</p></div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nama Lengkap" autoComplete="name" placeholder="Nama lengkap dan gelar" {...register('full_name')} error={errors.full_name?.message} disabled={isLoading} />
            <Input label="Email" type="email" autoComplete="email" placeholder="nama@institusi.com" {...register('email')} error={errors.email?.message} disabled={isLoading} />
          </div>
          <Input label="Password" type="password" autoComplete="new-password" placeholder="••••••••••" {...register('password')} error={errors.password?.message} disabled={isLoading} helperText="Minimal 10 karakter, dengan huruf besar, huruf kecil, dan angka." />
          <Input label="Nama Institusi / Apotek" placeholder="Apotek atau institusi tempat bekerja" {...register('institution')} error={errors.institution?.message} disabled={isLoading} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nomor Identitas Profesi / STRA" placeholder="Nomor STRA" {...register('professional_license_number')} error={errors.professional_license_number?.message} disabled={isLoading} />
            <Input label="Nomor SIPA (opsional)" placeholder="Nomor SIPA" {...register('sipa_number')} error={errors.sipa_number?.message} disabled={isLoading} />
          </div>
          <Input label="Nomor Telepon (opsional)" autoComplete="tel" placeholder="08xxxxxxxxxx" {...register('phone')} error={errors.phone?.message} disabled={isLoading} />
          <Button type="submit" className="w-full h-12 text-base font-semibold mt-4" disabled={isLoading}>{isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mengirim pengajuan...</> : 'Ajukan Pendaftaran Reviewer'}</Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-4 text-center pb-8 pt-0"><p className="text-sm text-text-muted">Sudah punya akun?{' '}<Link href="/login" className="text-primary font-semibold hover:underline">Masuk di sini</Link></p></CardFooter>
    </Card>
  )
}
