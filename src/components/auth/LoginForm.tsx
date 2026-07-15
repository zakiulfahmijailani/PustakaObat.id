'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'

const loginSchema = z.object({
  email: z.string().email({ message: 'Email tidak valid' }),
  password: z.string().min(1, { message: 'Password wajib diisi' }),
})

type LoginFormValues = z.infer<typeof loginSchema>

export const LoginForm = () => {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (result.redirectTo) router.push(result.redirectTo)
        throw new Error(result.error || 'Login belum dapat diproses.')
      }
      router.push(result.redirectTo || '/dashboard')
      router.refresh()
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-none shadow-2xl bg-surface/50 backdrop-blur-xl">
      <CardHeader className="space-y-1 pb-8">
        <CardTitle className="text-3xl text-center">Masuk ke Apoteq</CardTitle>
        <CardDescription className="text-center text-text-muted">
          Satu akses untuk Apoteker Reviewer dan Admin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <div className="p-4 rounded-xl bg-error/10 border border-error/20 flex items-center gap-3 text-error text-sm" role="alert"><AlertCircle size={18} /><p>{error}</p></div>}
          <Input label="Email" type="email" autoComplete="email" placeholder="nama@institusi.com" {...register('email')} error={errors.email?.message} disabled={isLoading} />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text">Password</label>
              <span className="text-xs text-text-muted">Reset password segera tersedia</span>
            </div>
            <Input type="password" autoComplete="current-password" placeholder="••••••••••" {...register('password')} error={errors.password?.message} disabled={isLoading} />
          </div>
          <Button type="submit" className="w-full h-12 text-base font-semibold mt-6" disabled={isLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses...</> : 'Masuk Sekarang'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-4 text-center pb-8 pt-0">
        <p className="text-sm text-text-muted">Belum menjadi reviewer?{' '}<Link href="/register" className="text-primary font-semibold hover:underline">Ajukan pendaftaran</Link></p>
      </CardFooter>
    </Card>
  )
}
