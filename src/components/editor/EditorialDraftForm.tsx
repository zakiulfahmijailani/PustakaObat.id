'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Save, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import type { EditorialDraft, IndonesianCandidateDraft } from '@/lib/staging/types'

const labels: Record<string, string> = { indication: 'Indikasi', dosage: 'Dosis dan penggunaan', warnings: 'Peringatan', side_effects: 'Efek samping', drug_interactions: 'Interaksi obat', specific_populations: 'Populasi khusus', pregnancy: 'Kehamilan', clinical_pharmacology: 'Farmakologi klinis', mechanism: 'Mekanisme kerja', pharmacokinetics: 'Farmakokinetik', storage: 'Penyimpanan', how_supplied: 'Sediaan', contraindication: 'Kontraindikasi' }

async function mutate(payload: Record<string, unknown>) {
  const response = await fetch('/api/staging/editorial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Perubahan tidak dapat disimpan.')
  return result
}

export function EditorialDraftForm({ drugKey, availableSections, drafts, aiCandidates }: { drugKey: string; availableSections: string[]; drafts: EditorialDraft[]; aiCandidates: IndonesianCandidateDraft[] }) {
  const router = useRouter()
  const sections = useMemo(() => [...new Set(availableSections)].sort(), [availableSections])
  const [sectionType, setSectionType] = useState(sections[0] || 'indication')
  const [contentBySection, setContentBySection] = useState<Record<string, string>>(Object.fromEntries(drafts.map((draft) => [draft.section_type, draft.content_indonesian])))
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const currentDraft = drafts.find((draft) => draft.section_type === sectionType)
  const candidate = aiCandidates.find((item) => item.section_type === sectionType)
  const editable = !currentDraft || ['draft', 'changes_requested'].includes(currentDraft.status)

  async function run(payload: Record<string, unknown>, success: string) {
    setPending(true); setMessage(null)
    try { await mutate(payload); setMessage(success); router.refresh() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Terjadi kesalahan.') }
    finally { setPending(false) }
  }

  return <div className="space-y-6">
    <div className="grid gap-4 rounded-2xl border border-border bg-surface-2/40 p-5 md:grid-cols-[1fr_auto] md:items-end"><label className="text-sm font-bold text-text">Bagian monografi<select value={sectionType} onChange={(event) => setSectionType(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm">{sections.map((section) => <option key={section} value={section}>{labels[section] || section}</option>)}</select></label><p className="text-sm text-text-muted">{currentDraft ? `Status: ${currentDraft.status.replaceAll('_', ' ')}` : 'Belum ada draf'}</p></div>
    {currentDraft?.status === 'changes_requested' && <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5"><p className="font-bold text-text">Catatan Reviewer</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{currentDraft.reviewer_note || 'Reviewer meminta perbaikan pada bagian ini.'}</p></div>}
    <Textarea label="Draf Bahasa Indonesia" value={contentBySection[sectionType] || ''} onChange={(event) => setContentBySection((value) => ({ ...value, [sectionType]: event.target.value }))} disabled={pending || !editable} className="min-h-80" helperText="Fokuskan pada susunan, bahasa yang jelas, dan keterbacaan. Draf terkirim dikunci sampai Reviewer memberi keputusan." />
    <div className="flex flex-wrap gap-3">
      {candidate && editable && <Button type="button" variant="outline" disabled={pending} onClick={() => setContentBySection((value) => ({ ...value, [sectionType]: candidate.content_indonesian }))}><FileText size={17} />Gunakan bahan draf</Button>}
      <Button type="button" disabled={pending || !editable || (contentBySection[sectionType] || '').trim().length < 40} onClick={() => run({ action: 'save_draft', drugKey, sectionType, contentIndonesian: contentBySection[sectionType] || '' }, 'Draf tersimpan.')}><Save size={17} />Simpan draf</Button>
      {currentDraft && editable && <Button type="button" variant="outline" disabled={pending} onClick={() => run({ action: 'submit_draft', draftId: currentDraft.id }, 'Draf dikirim ke Reviewer untuk pemeriksaan informasi.')}><Send size={17} />Kirim untuk ditinjau</Button>}
    </div>
    {currentDraft?.status === 'submitted' && <p className="rounded-2xl bg-primary/5 p-5 text-sm text-text-muted">Draf ini sedang ditinjau Reviewer. Anda dapat melanjutkan bagian lain sambil menunggu keputusan.</p>}
    {currentDraft?.status === 'pharmacist_approved' && <p className="rounded-2xl bg-success/10 p-5 text-sm text-success">Bagian ini telah disetujui Reviewer dan tidak dapat diubah dari ruang Editor.</p>}
    {message && <p role="status" className="rounded-xl bg-surface-2 p-4 text-sm text-text">{message}</p>}
  </div>
}
