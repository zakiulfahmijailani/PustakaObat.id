'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowUpRight, BookOpenText, FileText, Save, Send } from 'lucide-react'
import { BoundEvidencePanel } from '@/components/full-label/BoundEvidencePanel'
import { fdaSectionTypesForMonographSection, MONOGRAPH_SECTION_LABELS } from '@/lib/full-label/section-mapping'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import type { EditorialDraft, IndonesianCandidateDraft } from '@/lib/staging/types'

async function mutate(payload: Record<string, unknown>) {
  const response = await fetch('/api/staging/editorial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Perubahan tidak dapat disimpan.')
  return result
}

interface FullLabelCandidate {
  label_id: string
  candidate_rank: number | null
  effective_time: string | null
}

export function EditorialDraftForm({ drugKey, drugName, availableSections, drafts, aiCandidates }: { drugKey: string; drugName: string; availableSections: string[]; drafts: EditorialDraft[]; aiCandidates: IndonesianCandidateDraft[] }) {
  const router = useRouter()
  const sections = useMemo(() => [...new Set(availableSections)].sort(), [availableSections])
  const [sectionType, setSectionType] = useState(sections[0] || 'indication')
  const [contentBySection, setContentBySection] = useState<Record<string, string>>(Object.fromEntries(drafts.map((draft) => [draft.section_type, draft.content_indonesian])))
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fullLabelCandidates, setFullLabelCandidates] = useState<FullLabelCandidate[]>([])
  const [fullLabelState, setFullLabelState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [sourceLabelBySection, setSourceLabelBySection] = useState<Record<string, string>>({})
  const [sourceReady, setSourceReady] = useState(false)
  const currentDraft = drafts.find((draft) => draft.section_type === sectionType)
  const candidate = aiCandidates.find((item) => item.section_type === sectionType)
  const editable = !currentDraft || ['draft', 'changes_requested'].includes(currentDraft.status)
  const sourceLabelId = sourceLabelBySection[sectionType] || currentDraft?.source_label_id || fullLabelCandidates[0]?.label_id || ''
  const mappedSectionTypes = currentDraft?.source_label_id === sourceLabelId && currentDraft.source_section_types.length
    ? currentDraft.source_section_types
    : fdaSectionTypesForMonographSection(sectionType)

  useEffect(() => {
    const controller = new AbortController()
    setFullLabelState('loading')
    setFullLabelCandidates([])
    fetch(`/api/editor/full-label-candidates?drugKey=${encodeURIComponent(drugKey)}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Bahan sumber belum tersedia.')
        const data = await response.json() as { candidates?: FullLabelCandidate[] }
        setFullLabelCandidates(data.candidates || [])
        setFullLabelState('ready')
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== 'AbortError') setFullLabelState('unavailable')
      })
    return () => controller.abort()
  }, [drugKey])

  useEffect(() => setSourceReady(false), [sectionType, sourceLabelId])

  async function run(payload: Record<string, unknown>, success: string) {
    setPending(true); setMessage(null)
    try { await mutate(payload); setMessage(success); router.refresh() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Terjadi kesalahan.') }
    finally { setPending(false) }
  }

  return <div className="space-y-6">
    {fullLabelCandidates.length > 0 && <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5"><div className="flex items-start gap-3"><BookOpenText className="mt-0.5 shrink-0 text-primary" size={21} /><div className="min-w-0 flex-1"><p className="font-bold text-text">Bahan sumber FDA lengkap</p><p className="mt-1 text-sm leading-relaxed text-text-muted">Pilih satu label FDA. Sistem akan mengikat seksi sumber yang relevan ke draf; Reviewer akan melihat evidence yang sama persis.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><label className="text-sm font-bold text-text">Label pembanding<select value={sourceLabelId} disabled={!editable} onChange={(event) => setSourceLabelBySection((value) => ({ ...value, [sectionType]: event.target.value }))} className="mt-2 min-h-10 w-full rounded-xl border border-primary/25 bg-surface px-3 text-sm sm:mt-0 sm:ml-3 sm:w-auto">{fullLabelCandidates.map((label, index) => <option key={label.label_id} value={label.label_id}>Label FDA #{label.candidate_rank || index + 1}{label.effective_time ? ` · ${label.effective_time}` : ''}</option>)}</select></label><Link href={`/editor/full-labels/${encodeURIComponent(sourceLabelId)}`} className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-primary">Buka label penuh <ArrowUpRight size={16} /></Link></div></div></div></section>}
    {fullLabelState === 'loading' && <p className="text-sm text-text-muted">Memeriksa ketersediaan bahan sumber FDA lengkap…</p>}
    {fullLabelState === 'unavailable' && <p className="rounded-xl bg-warning/5 p-4 text-sm text-text-muted">Bahan sumber FDA lengkap belum dapat dimuat saat ini. Coba muat ulang sebelum membuat atau mengirim draf.</p>}
    <div className="grid gap-4 rounded-2xl border border-border bg-surface-2/40 p-5 md:grid-cols-[1fr_auto] md:items-end"><label className="text-sm font-bold text-text">Bagian monografi<select value={sectionType} onChange={(event) => { setSectionType(event.target.value); setMessage(null) }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm">{sections.map((section) => <option key={section} value={section}>{MONOGRAPH_SECTION_LABELS[section] || section}</option>)}</select></label><p className="text-sm text-text-muted">{currentDraft ? `Status: ${currentDraft.status.replaceAll('_', ' ')}` : 'Belum ada draf'}</p></div>
    {sourceLabelId && mappedSectionTypes.length > 0 && <BoundEvidencePanel labelId={sourceLabelId} sectionTypes={mappedSectionTypes} drugName={drugName} onAvailabilityChange={setSourceReady} />}
    {!sourceLabelId && fullLabelState === 'ready' && <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5 text-sm text-text-muted"><AlertTriangle className="mb-2 text-warning" size={19} />Tidak ada label FDA aman yang siap dipakai sebagai evidence untuk obat ini. Draf baru tidak dapat dikirim sebelum evidence tersedia.</div>}
    {sourceLabelId && !mappedSectionTypes.length && <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5 text-sm text-text-muted"><AlertTriangle className="mb-2 text-warning" size={19} />Bagian ini belum memiliki pemetaan ke seksi label FDA.</div>}
    {currentDraft?.status === 'changes_requested' && <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5"><p className="font-bold text-text">Catatan Reviewer</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{currentDraft.reviewer_note || 'Reviewer meminta perbaikan pada bagian ini.'}</p></div>}
    {currentDraft && !currentDraft.source_label_id && <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5 text-sm text-text-muted"><AlertTriangle className="mb-2 text-warning" size={19} />Draf lama ini belum terikat ke evidence FDA. Simpan ulang draf dengan label di atas sebelum mengirimnya lagi untuk review atau publikasi.</div>}
    <Textarea label="Draf Bahasa Indonesia" value={contentBySection[sectionType] || ''} onChange={(event) => setContentBySection((value) => ({ ...value, [sectionType]: event.target.value }))} disabled={pending || !editable} className="min-h-80" helperText="Draf yang dikirim akan dikunci dan Reviewer akan membandingkannya dengan evidence FDA terikat di atas." />
    <div className="flex flex-wrap gap-3">
      {candidate && editable && <Button type="button" variant="outline" disabled={pending} onClick={() => setContentBySection((value) => ({ ...value, [sectionType]: candidate.content_indonesian }))}><FileText size={17} />Gunakan draf AI awal</Button>}
      <Button type="button" disabled={pending || !editable || !sourceLabelId || !sourceReady || (contentBySection[sectionType] || '').trim().length < 40} onClick={() => run({ action: 'save_draft', drugKey, sectionType, contentIndonesian: contentBySection[sectionType] || '', sourceLabelId }, 'Draf dan evidence FDA terikat tersimpan.')}><Save size={17} />Simpan draf</Button>
      {currentDraft && editable && <Button type="button" variant="outline" disabled={pending || !currentDraft.source_label_id || !currentDraft.source_section_types.length} onClick={() => run({ action: 'submit_draft', draftId: currentDraft.id }, 'Draf dikirim ke Reviewer bersama evidence FDA terikat.')}><Send size={17} />Kirim untuk ditinjau</Button>}
    </div>
    {candidate && !currentDraft && <p className="rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed text-text-muted">Draf AI awal adalah ringkasan dari pipeline lama, bukan terjemahan penuh label FDA. Lengkapi dan periksa terhadap evidence terikat sebelum dikirim ke Reviewer.</p>}
    {currentDraft?.status === 'submitted' && <p className="rounded-2xl bg-primary/5 p-5 text-sm text-text-muted">Draf ini sedang ditinjau Reviewer. Anda dapat melanjutkan bagian lain sambil menunggu keputusan.</p>}
    {currentDraft?.status === 'pharmacist_approved' && <p className="rounded-2xl bg-success/10 p-5 text-sm text-success">Bagian ini telah disetujui Reviewer dan tidak dapat diubah dari ruang Editor.</p>}
    {message && <p role="status" className="rounded-xl bg-surface-2 p-4 text-sm text-text">{message}</p>}
  </div>
}
