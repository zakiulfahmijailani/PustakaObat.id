'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import type { EditorialDraft } from '@/lib/staging/types'

const labels: Record<string, string> = { indication: 'Indikasi', dosage: 'Dosis dan penggunaan', warnings: 'Peringatan', side_effects: 'Efek samping', drug_interactions: 'Interaksi obat', specific_populations: 'Populasi khusus', pregnancy: 'Kehamilan', clinical_pharmacology: 'Farmakologi klinis', mechanism: 'Mekanisme kerja', pharmacokinetics: 'Farmakokinetik', storage: 'Penyimpanan', how_supplied: 'Sediaan', contraindication: 'Kontraindikasi' }

export function EditorialReviewPanel({ drafts, actorId }: { drafts: EditorialDraft[]; actorId: string }) {
  const router = useRouter()
  const sections = useMemo(() => drafts.map((draft) => draft.section_type), [drafts])
  const [section, setSection] = useState(sections[0] || '')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const draft = drafts.find((item) => item.section_type === section)

  async function review(decision: 'approve' | 'changes_requested') {
    if (!draft) return
    setPending(true); setMessage(null)
    try {
      const response = await fetch('/api/staging/editorial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'review_draft', draftId: draft.id, decision, note }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Keputusan tidak dapat disimpan.')
      setMessage(decision === 'approve' ? 'Draf disetujui.' : 'Draf dikembalikan kepada Editor dengan catatan.')
      router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Terjadi kesalahan.') }
    finally { setPending(false) }
  }

  if (!drafts.length) return <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-text-muted">Belum ada draf yang dikirim Editor untuk monografi ini.</p>
  const canReview = draft?.status === 'submitted' && draft.authored_by !== actorId
  return <div className="space-y-6"><label className="text-sm font-bold text-text">Bagian monografi<select value={section} onChange={(event) => { setSection(event.target.value); setNote(''); setMessage(null) }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm">{sections.map((item) => <option key={item} value={item}>{labels[item] || item}</option>)}</select></label>{draft && <><div className="rounded-2xl border border-border bg-surface-2/40 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-bold text-text">Draf Editor</p><span className="text-xs font-bold uppercase tracking-wider text-text-muted">{draft.status.replaceAll('_', ' ')}</span></div><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-text">{draft.content_indonesian}</p></div>{canReview ? <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-5"><Textarea label="Catatan untuk Editor" value={note} onChange={(event) => setNote(event.target.value)} disabled={pending} helperText="Catatan wajib jika meminta revisi." /><div className="flex flex-wrap gap-3"><Button type="button" disabled={pending} onClick={() => review('approve')}><CheckCircle2 size={17} />Setujui informasi</Button><Button type="button" variant="outline" disabled={pending || !note.trim()} onClick={() => review('changes_requested')}><Undo2 size={17} />Minta revisi</Button></div></div> : <div className="rounded-2xl bg-surface-2 p-5 text-sm text-text-muted">{draft.status === 'submitted' ? 'Draf ini ditulis oleh akun Anda sehingga harus diperiksa Reviewer lain.' : draft.reviewer_note || 'Belum ada tindakan review yang diperlukan.'}</div>}</>}{message && <p role="status" className="rounded-xl bg-surface-2 p-4 text-sm text-text">{message}</p>}</div>
}
