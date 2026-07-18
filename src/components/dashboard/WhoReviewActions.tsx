'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, RotateCcw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

type Decision = 'verified' | 'rejected' | 'needs_revision'

export function WhoReviewActions({ medicineId }: { medicineId: string }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<Decision | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (decision: Decision) => {
    if (decision !== 'verified' && !note.trim()) {
      setMessage('Catatan wajib diisi untuk penolakan atau permintaan perbaikan.')
      return
    }
    setPending(decision)
    setMessage(null)
    const response = await fetch('/api/who/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicineId, decision, note: note.trim() || null }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setMessage(result.error || 'Gagal menyimpan keputusan.')
    else {
      setMessage('Keputusan tersimpan dan riwayat verifikasi diperbarui.')
      setNote('')
      router.refresh()
    }
    setPending(null)
  }

  return (
    <div className="space-y-4 rounded-3xl border border-border bg-surface p-6">
      <div>
        <h2 className="font-serif text-xl text-text">Keputusan apoteker</h2>
        <p className="mt-1 text-sm text-text-muted">Tinjau representasi data PustakaObat.id berdasarkan tautan WHO. Penolakan tidak mengubah sumber asli WHO.</p>
      </div>
      <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan verifikasi (wajib untuk tolak/perlu perbaikan)" rows={4} />
      {message && <p role="status" className="text-sm text-text-muted">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => submit('verified')} disabled={Boolean(pending)}>
          {pending === 'verified' ? <Loader2 className="animate-spin" size={17} /> : <CheckCircle2 size={17} />} Verifikasi
        </Button>
        <Button variant="outline" onClick={() => submit('needs_revision')} disabled={Boolean(pending)}>
          {pending === 'needs_revision' ? <Loader2 className="animate-spin" size={17} /> : <RotateCcw size={17} />} Perlu perbaikan
        </Button>
        <Button variant="destructive" onClick={() => submit('rejected')} disabled={Boolean(pending)}>
          {pending === 'rejected' ? <Loader2 className="animate-spin" size={17} /> : <XCircle size={17} />} Tolak
        </Button>
      </div>
    </div>
  )
}
