'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, CircleAlert, FilePenLine, Undo2 } from 'lucide-react'
import { BoundEvidencePanel } from '@/components/full-label/BoundEvidencePanel'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import type { EditorialDraft, IndonesianCandidateDraft } from '@/lib/staging/types'

const labels: Record<string, string> = { indication: 'Indikasi', dosage: 'Dosis dan penggunaan', warnings: 'Peringatan', side_effects: 'Efek samping', drug_interactions: 'Interaksi obat', specific_populations: 'Populasi khusus', pregnancy: 'Kehamilan', clinical_pharmacology: 'Farmakologi klinis', mechanism: 'Mekanisme kerja', pharmacokinetics: 'Farmakokinetik', storage: 'Penyimpanan', how_supplied: 'Sediaan', contraindication: 'Kontraindikasi' }

export function EditorialReviewPanel({ drafts, aiCandidates = [], actorId, drugName }: { drafts: EditorialDraft[]; aiCandidates?: IndonesianCandidateDraft[]; actorId: string; drugName: string }) {
  const router = useRouter()
  const sections = useMemo(() => [...new Set([...drafts.map((draft) => draft.section_type), ...aiCandidates.map((candidate) => candidate.section_type)])], [aiCandidates, drafts])
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

  const submitted = drafts.filter((draft) => draft.status === 'submitted').length
  const approved = drafts.filter((draft) => draft.status === 'pharmacist_approved').length
  const changesRequested = drafts.filter((draft) => draft.status === 'changes_requested').length

  if (!sections.length) return <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-text-muted"><FilePenLine className="mb-3 text-primary" size={22} /><p className="font-bold text-text">Draf monografi belum tersedia</p><p className="mt-1">Editor perlu menyusun dan mengirim draf Bahasa Indonesia sebelum reviewer dapat memberikan keputusan.</p></div>
  const hasBoundEvidence = Boolean(draft?.source_label_id && draft.source_section_types?.length)
  const canReview = draft?.status === 'submitted' && draft.authored_by !== actorId && hasBoundEvidence
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-warning/25 bg-warning/5 p-4"><p className="text-xs font-bold uppercase tracking-wider text-text-muted">Menunggu review</p><p className="mt-1 text-2xl font-bold text-warning">{submitted}</p></div><div className="rounded-2xl border border-success/25 bg-success/5 p-4"><p className="text-xs font-bold uppercase tracking-wider text-text-muted">Disetujui</p><p className="mt-1 text-2xl font-bold text-success">{approved}</p></div><div className="rounded-2xl border border-error/25 bg-error/5 p-4"><p className="text-xs font-bold uppercase tracking-wider text-text-muted">Perlu revisi</p><p className="mt-1 text-2xl font-bold text-error">{changesRequested}</p></div></div>
    {aiCandidates.length > 0 && drafts.length === 0 && <div className="flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm text-text-muted"><CircleAlert className="mt-0.5 shrink-0 text-primary" size={19} /><p><strong className="text-text">Draf AI sudah tersedia, tetapi belum dikirim Editor.</strong> Reviewer belum dapat menyetujui kandidat ini. Editor perlu memeriksa dan mengirimkannya terlebih dahulu.</p></div>}
    <label className="text-sm font-bold text-text">Bagian monografi<select value={section} onChange={(event) => { setSection(event.target.value); setNote(''); setMessage(null) }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm">{sections.map((item) => <option key={item} value={item}>{labels[item] || item}</option>)}</select></label>
    {draft ? <><div className="rounded-2xl border border-border bg-surface-2/40 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-bold text-text">Draf Bahasa Indonesia</p><span className="text-xs font-bold uppercase tracking-wider text-text-muted">{draft.status.replaceAll('_', ' ')}</span></div><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-text">{draft.content_indonesian}</p></div>{hasBoundEvidence ? <BoundEvidencePanel labelId={draft.source_label_id!} sectionTypes={draft.source_section_types} drugName={drugName} /> : <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5 text-sm text-text-muted"><CircleAlert className="mb-2 text-warning" size={19} /><strong className="text-text">Draf lama belum memiliki evidence FDA terikat.</strong> Jangan setujui untuk publikasi; minta Editor menyimpan ulang draf dengan label dan seksi sumber yang sesuai.</div>}{canReview ? <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-5"><Textarea label="Catatan untuk Editor" value={note} onChange={(event) => setNote(event.target.value)} disabled={pending} helperText="Catatan wajib jika meminta revisi atau menandai masalah." /><div className="flex flex-wrap gap-3"><Button type="button" disabled={pending} onClick={() => review('approve')}><CheckCircle2 size={17} />Setujui bagian</Button><Button type="button" variant="outline" disabled={pending || !note.trim()} onClick={() => review('changes_requested')}><Undo2 size={17} />Minta revisi</Button></div></div> : <div className="rounded-2xl bg-surface-2 p-5 text-sm text-text-muted">{draft.status === 'submitted' && !hasBoundEvidence ? 'Evidence FDA belum terikat. Minta Editor menyimpan ulang draf ini sebelum review.' : draft.status === 'submitted' ? 'Draf ini ditulis oleh akun Anda sehingga harus diperiksa Reviewer lain.' : draft.reviewer_note || 'Belum ada tindakan review yang diperlukan.'}</div>}</> : <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-text-muted">Bagian ini masih berupa kandidat AI dan belum menjadi draf yang dapat disetujui.</div>}
    {message && <p role="status" className="rounded-xl bg-surface-2 p-4 text-sm text-text">{message}</p>}
  </div>
}
