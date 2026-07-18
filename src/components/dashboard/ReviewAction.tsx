'use client'

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2, AlertCircle, Shield } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface ReviewActionProps {
  drugId: string
  drugName: string
  userId: string
}

export const ReviewAction = ({ drugId, drugName, userId }: ReviewActionProps) => {
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleApprove = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('drugs')
        .update({
          status: 'published',
          verified_by: userId,
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', drugId)

      if (updateError) throw updateError

      // Log Audit
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'APPROVE_DRUG',
        resource_type: 'drugs',
        resource_id: drugId,
        metadata: { drug_name: drugName, feedback: feedback || 'No feedback provided' }
      })

      router.push('/dashboard/verifikasi')
      router.refresh()
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Gagal mempublikasikan obat.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReject = async () => {
    if (!feedback.trim()) {
      setError('Harap berikan masukan (feedback) mengapa draft ini dikembalikan.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('drugs')
        .update({
          status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', drugId)

      if (updateError) throw updateError

      // Log Audit
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'REJECT_DRUG',
        resource_type: 'drugs',
        resource_id: drugId,
        metadata: { drug_name: drugName, feedback: feedback }
      })

      router.push('/dashboard/verifikasi')
      router.refresh()
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Gagal mengembalikan draft.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-none shadow-2xl bg-surface/50 backdrop-blur-xl rounded-[2.5rem] sticky top-32 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-2 bg-warning/20" />
      <CardHeader className="p-8 md:p-10 space-y-4">
        <Badge variant="warning" className="w-fit">MODE VERIFIKASI</Badge>
        <CardTitle className="text-xl uppercase tracking-widest font-bold">Hasil Peninjauan</CardTitle>
        <CardDescription className="text-sm font-medium leading-relaxed italic">
          Tentukan status monografi ini setelah melakukan peninjauan klinis menyeluruh.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 md:px-10 pb-10 space-y-6">
        {error && (
          <div className="p-4 rounded-2xl bg-error/10 border border-error/20 flex gap-3 text-error text-xs animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={16} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <Textarea
          label="Masukan / Feedback Penulis (Draft)"
          placeholder="Tuliskan catatan perbaikan jika Anda mengembalikan draft ini ke penulis..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="rounded-2xl min-h-[160px] text-sm leading-relaxed border-border"
          disabled={isLoading}
        />

        <div className="grid grid-cols-1 gap-4 pt-4">
          <Button 
            variant="outline" 
            className="w-full rounded-full h-14 border-error/20 text-error hover:bg-error/5 gap-3 font-bold uppercase tracking-widest text-xs"
            onClick={handleReject}
            disabled={isLoading}
          >
            <XCircle size={18} />
            Kembalikan ke Draft
          </Button>
          <Button 
            className="w-full rounded-full h-14 bg-success hover:bg-success/90 text-white gap-3 font-bold uppercase tracking-widest text-xs shadow-xl shadow-success/10"
            onClick={handleApprove}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={22} />}
            Setujui & Publikasikan
          </Button>
        </div>
      </CardContent>
      <CardFooter className="px-10 py-6 bg-surface-2 border-t border-border flex items-center gap-4">
        <Shield size={24} className="text-primary opacity-30" />
        <p className="text-xs text-text-muted font-bold tracking-wide uppercase leading-relaxed">
          Tindakan ini akan tercatat dalam log audit PustakaObat.id.
        </p>
      </CardFooter>
    </Card>
  )
}
