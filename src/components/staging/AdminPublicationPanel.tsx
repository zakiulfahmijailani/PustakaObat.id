'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { EditorialDraft, MonographPublication } from '@/lib/staging/types'
import { Button } from '@/components/ui/Button'

const SECTION_LABELS: Record<string, string> = {
  indication: 'Indikasi', dosage: 'Dosis dan penggunaan', warnings: 'Peringatan',
  side_effects: 'Efek samping', drug_interactions: 'Interaksi obat',
  specific_populations: 'Populasi khusus', pregnancy: 'Kehamilan',
  clinical_pharmacology: 'Farmakologi klinis', mechanism: 'Mekanisme kerja',
  pharmacokinetics: 'Farmakokinetik', storage: 'Penyimpanan',
  how_supplied: 'Sediaan', contraindication: 'Kontraindikasi',
}

export function AdminPublicationPanel({ drafts, publication, publishedDraftIds }: { drafts: EditorialDraft[]; publication: MonographPublication | null; publishedDraftIds: string[] }) {
  const router = useRouter()
  const published = useMemo(() => new Set(publishedDraftIds), [publishedDraftIds])
  const readyDrafts = useMemo(() => drafts.filter((draft) => draft.status === 'pharmacist_approved' && draft.reviewed_by && draft.reviewed_at && !published.has(draft.id)), [drafts, published])
  const [selectedDraftId, setSelectedDraftId] = useState(readyDrafts[0]?.id || '')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const selectedDraft = readyDrafts.find((draft) => draft.id === selectedDraftId) || readyDrafts[0]

  useEffect(() => {
    if (!readyDrafts.some((draft) => draft.id === selectedDraftId)) setSelectedDraftId(readyDrafts[0]?.id || '')
  }, [readyDrafts, selectedDraftId])

  async function publishSection() {
    if (!selectedDraft) return
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch('/api/staging/editorial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish_section', draftId: selectedDraft.id }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Bagian belum dapat diterbitkan.')
      setMessage(`${SECTION_LABELS[selectedDraft.section_type] || selectedDraft.section_type} berhasil diterbitkan ke publik.`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bagian belum dapat diterbitkan.')
    } finally {
      setPending(false)
    }
  }

  return <section className="rounded-3xl border border-primary/25 bg-primary/5 p-6">
    <div className="flex items-start gap-3"><Send className="mt-1 shrink-0 text-primary" size={21} /><div><h2 className="font-serif text-2xl text-text">Publikasi oleh Admin</h2><p className="mt-2 text-sm leading-relaxed text-text-muted">Setiap bagian yang sudah disetujui Reviewer dapat diterbitkan secara bertahap. Evidence FDA tetap menjadi sumber internal.</p></div></div>
    {publication && <p className="mt-5 rounded-2xl bg-success/10 p-4 text-sm font-medium text-success">{publication.published_section_count} bagian sudah diterbitkan untuk monografi ini.</p>}
    {readyDrafts.length > 0 ? <div className="mt-5 space-y-4">
      <label className="block text-sm font-bold text-text">Bagian yang siap diterbitkan<select value={selectedDraft?.id || ''} onChange={(event) => setSelectedDraftId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm">{readyDrafts.map((draft) => <option key={draft.id} value={draft.id}>{SECTION_LABELS[draft.section_type] || draft.section_type}</option>)}</select></label>
      <div className="flex flex-wrap gap-2">{readyDrafts.map((draft) => <span key={draft.id} className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-bold text-success"><CheckCircle2 size={14} />{SECTION_LABELS[draft.section_type] || draft.section_type}: disetujui</span>)}</div>
      <Button type="button" disabled={pending || !selectedDraft} onClick={publishSection}>{pending ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}{pending ? 'Menerbitkan...' : `Terbitkan ${selectedDraft ? SECTION_LABELS[selectedDraft.section_type] || selectedDraft.section_type : 'bagian'} ke publik`}</Button>
    </div> : <p className="mt-5 rounded-2xl border border-dashed border-border p-5 text-sm text-text-muted">Belum ada bagian baru yang disetujui Reviewer dan menunggu publikasi.</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-surface p-4 text-sm text-text">{message}</p>}
  </section>
}
