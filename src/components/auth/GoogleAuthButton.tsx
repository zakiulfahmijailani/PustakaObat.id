'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function GoogleAuthButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authenticate = async () => {
    setLoading(true)
    setError(null)

    try {
      await signIn('google', { redirectTo: '/auth/post-login' })
    } catch {
      setError('Login Google belum dapat dimulai. Silakan coba lagi.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <div className="flex items-center gap-3 rounded-xl border border-error/20 bg-error/10 p-4 text-sm text-error" role="alert"><AlertCircle size={18} />{error}</div>}
      <Button type="button" variant="outline" className="h-12 w-full bg-white text-base font-semibold" disabled={loading} onClick={authenticate}>
        {loading ? <Loader2 className="animate-spin" size={20} /> : <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full border border-border font-bold text-[#4285F4]">G</span>}
        {loading ? 'Menghubungkan ke Google...' : label}
      </Button>
    </div>
  )
}

