'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FlaskConical, Send, Save, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import type { EditorialDraft } from '@/lib/staging/types'

const SECTION_LABELS: Record<string, string> = {
  indication: 'Indikasi', dosage: 'Dosis dan penggunaan', warnings: 'Peringatan', side_effects: 'Efek samping',
  drug_interactions: 'Interaksi obat', specific_populations: 'Populasi khusus', pregnancy: 'Kehamilan',
  clinical_pharmacology: 'Farmakologi klinis', mechanism: 'Mekanisme kerja', pharmacokinetics: 'Farmakokinetik',
  storage: 'Penyimpanan', how_supplied: 'Sediaan', contraindication: 'Kontraindikasi',
}

async function mutate(payload: Record<string, unknown>) {
  const response = await fetch('/api/staging/editorial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Perubahan tidak dapat disimpan.')
  return result
}

export function StagingEditorialForm({ drugKey, isPilot, availableSections, drafts }: { drugKey: string; isPilot: boolean; availableSections: string[]; drafts: EditorialDraft[] }) {
  const router = useRouter()
  const sections = useMemo(() => [...new Set(availableSections)].sort(), [availableSections])
  const [sectionType, setSectionType] = useState(sections[0] || 'indication')
  const currentDraft = drafts.find((draft) => draft.section_type === sectionType)
  const [contentBySection, setContentBySection] = useState<Record<string, string>>(Object.fromEntries(drafts.map((draft) => [draft.section_type, draft.content_indonesian])))
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const run = async (payload: Record<string, unknown>, success: string) => {
    setPending(true); setMessage(null)
    try { await mutate(payload); setMessage(success); router.refresh() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Terjadi kesalahan.') }
    finally { setPending(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant={isPilot ? 'secondary' : 'outline'} disabled={pending || isPilot} onClick={() => run({ action: 'select_pilot', drugKey }, 'Obat dipilih sebagai pilot editorial.')}><FlaskConical size={17} />{isPilot ? 'Pilot aktif' : 'Pilih sebagai pilot'}</Button>
        <p className="text-sm text-text-muted">Pilot awal workflow adalah amoxicillin. Pemilihan pilot tidak mengubah visibilitas publik.</p>
      </div>
      <div className="space-y-3">
        <label className="text-sm font-bold text-text" htmlFor="editorial-section">Bagian monografi</label>
        <select id="editorial-section" value={sectionType} onChange={(event) => setSectionType(event.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm">
          {sections.map((section) => <option key={section} value={section}>{SECTION_LABELS[section] || section}</option>)}
        </select>
        <Textarea label="Draf asli Bahasa Indonesia" value={contentBySection[sectionType] || ''} onChange={(event) => setContentBySection((current) => ({ ...current, [sectionType]: event.target.value }))} disabled={pending || currentDraft?.status === 'submitted' || currentDraft?.status === 'pharmacist_approved'} className="min-h-64" helperText="Tulis teks editorial orisinal. Jangan salin source_text mentah atau menerjemahkannya secara otomatis." />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending || (contentBySection[sectionType] || '').trim().length < 40 || currentDraft?.status === 'submitted' || currentDraft?.status === 'pharmacist_approved'} onClick={() => run({ action: 'save_draft', drugKey, sectionType, contentIndonesian: contentBySection[sectionType] || '' }, 'Draf tersimpan dan audit trail diperbarui.')}><Save size={17} />Simpan draf</Button>
        {currentDraft && ['draft', 'changes_requested'].includes(currentDraft.status) && <Button type="button" variant="outline" disabled={pending} onClick={() => run({ action: 'submit_draft', draftId: currentDraft.id }, 'Draf dikirim untuk review apoteker.')}><Send size={17} />Kirim untuk review</Button>}
      </div>
      {currentDraft?.status === 'submitted' && (
        <div className="space-y-4 rounded-2xl border border-warning/30 bg-warning/5 p-5">
          <p className="font-bold text-text">Review apoteker</p>
          <Textarea label="Catatan review" value={note} onChange={(event) => setNote(event.target.value)} disabled={pending} helperText="Catatan wajib bila meminta perubahan." />
          <div className="flex flex-wrap gap-3"><Button type="button" disabled={pending} onClick={() => run({ action: 'review_draft', draftId: currentDraft.id, decision: 'approve', note }, 'Draf disetujui apoteker, tetapi tetap belum layak publikasi.')}><CheckCircle2 size={17} />Setujui draf</Button><Button type="button" variant="outline" disabled={pending || !note.trim()} onClick={() => run({ action: 'review_draft', draftId: currentDraft.id, decision: 'changes_requested', note }, 'Draf dikembalikan untuk perbaikan.')}><Undo2 size={17} />Minta perubahan</Button></div>
        </div>
      )}
      {currentDraft && <p className="text-sm text-text-muted">Status: <strong>{currentDraft.status.replaceAll('_', ' ')}</strong> · versi {currentDraft.version} · publication_eligible=false</p>}
      {message && <p role="status" className="rounded-xl bg-surface-2 p-4 text-sm text-text">{message}</p>}
    </div>
  )
}
