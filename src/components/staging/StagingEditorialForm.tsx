'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FlaskConical, Send, Save, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import type { EditorialDraft, MonographPublication } from '@/lib/staging/types'

const SECTION_LABELS: Record<string, string> = {
  indication: 'Indikasi', dosage: 'Dosis dan penggunaan', warnings: 'Peringatan', side_effects: 'Efek samping',
  drug_interactions: 'Interaksi obat', specific_populations: 'Populasi khusus', pregnancy: 'Kehamilan',
  clinical_pharmacology: 'Farmakologi klinis', mechanism: 'Mekanisme kerja', pharmacokinetics: 'Farmakokinetik',
  storage: 'Penyimpanan', how_supplied: 'Sediaan', contraindication: 'Kontraindikasi',
}

const REQUIRED_PUBLICATION_SECTIONS = ['indication', 'dosage', 'side_effects', 'contraindication', 'warnings']

async function mutate(payload: Record<string, unknown>) {
  const response = await fetch('/api/staging/editorial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Perubahan tidak dapat disimpan.')
  return result
}

export function StagingEditorialForm({ drugKey, isPilot, availableSections, drafts, publication, actorId }: { drugKey: string; isPilot: boolean; availableSections: string[]; drafts: EditorialDraft[]; publication: MonographPublication | null; actorId: string }) {
  const router = useRouter()
  const sections = useMemo(() => [...new Set(availableSections)].sort(), [availableSections])
  const [sectionType, setSectionType] = useState(sections[0] || 'indication')
  const currentDraft = drafts.find((draft) => draft.section_type === sectionType)
  const [contentBySection, setContentBySection] = useState<Record<string, string>>(Object.fromEntries(drafts.map((draft) => [draft.section_type, draft.content_indonesian])))
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const approvedSections = new Set(drafts.filter((draft) => draft.status === 'pharmacist_approved' && draft.reviewed_by && draft.reviewed_at).map((draft) => draft.section_type))
  const missingRequiredSections = REQUIRED_PUBLICATION_SECTIONS.filter((section) => !approvedSections.has(section))
  const canPublish = !publication && missingRequiredSections.length === 0

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
          {currentDraft.authored_by === actorId ? <p className="text-sm text-text-muted">Draf Anda sedang menunggu peninjauan oleh apoteker lain.</p> : <><Textarea label="Catatan review" value={note} onChange={(event) => setNote(event.target.value)} disabled={pending} helperText="Catatan wajib bila meminta perubahan." />
          <div className="flex flex-wrap gap-3"><Button type="button" disabled={pending} onClick={() => run({ action: 'review_draft', draftId: currentDraft.id, decision: 'approve', note }, 'Draf disetujui apoteker, tetapi tetap belum layak publikasi.')}><CheckCircle2 size={17} />Setujui draf</Button><Button type="button" variant="outline" disabled={pending || !note.trim()} onClick={() => run({ action: 'review_draft', draftId: currentDraft.id, decision: 'changes_requested', note }, 'Draf dikembalikan untuk perbaikan.')}><Undo2 size={17} />Minta perubahan</Button></div></>}
        </div>
      )}
      {currentDraft && <p className="text-sm text-text-muted">Status: <strong>{currentDraft.status.replaceAll('_', ' ')}</strong> · versi {currentDraft.version} · publication_eligible=false</p>}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <p className="font-bold text-text">Terbitkan monografi publik</p>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">Publikasi hanya memindahkan draf Bahasa Indonesia yang telah disetujui ke pustaka publik. Evidence sumber tetap tersembunyi.</p>
        {publication ? (
          <p className="mt-3 text-sm font-medium text-success">Monografi ini telah diterbitkan dengan {publication.published_section_count} bagian.</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-text-muted">Bagian inti: {REQUIRED_PUBLICATION_SECTIONS.map((section) => SECTION_LABELS[section]).join(', ')}.</p>
            {missingRequiredSections.length > 0 && <p className="mt-2 text-sm text-warning">Masih menunggu persetujuan: {missingRequiredSections.map((section) => SECTION_LABELS[section]).join(', ')}.</p>}
            <Button type="button" className="mt-4" disabled={pending || !canPublish} onClick={() => run({ action: 'publish_monograph', drugKey }, 'Monografi diterbitkan ke pustaka publik.')}><CheckCircle2 size={17} />Terbitkan monografi</Button>
          </>
        )}
      </div>
      {message && <p role="status" className="rounded-xl bg-surface-2 p-4 text-sm text-text">{message}</p>}
    </div>
  )
}
