import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, BadgeCheck, BookOpenText, Clock3, FileWarning, FlaskConical, ShieldAlert } from 'lucide-react'
import { requireReviewerOrAdmin } from '@/lib/auth/server'
import { getFullLabelCandidates, getStagedDrugForStaff } from '@/lib/staging/queries'
import { EditorialReviewPanel } from '@/components/reviewer/EditorialReviewPanel'
import { AdminPublicationPanel } from '@/components/staging/AdminPublicationPanel'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const SECTION_LABELS: Record<string, string> = {
  indication: 'Indikasi', dosage: 'Dosis dan penggunaan', warnings: 'Peringatan', side_effects: 'Efek samping', drug_interactions: 'Interaksi obat', specific_populations: 'Populasi khusus', pregnancy: 'Kehamilan', clinical_pharmacology: 'Farmakologi klinis', mechanism: 'Mekanisme kerja', pharmacokinetics: 'Farmakokinetik', storage: 'Penyimpanan', how_supplied: 'Sediaan', contraindication: 'Kontraindikasi',
}

export async function StagingDetailPage({ drugKey, basePath }: { drugKey: string; basePath: string }) {
  const session = await requireReviewerOrAdmin()
  const { concept, evidence, sources, drafts, candidates, events, publication, publishedDraftIds, error } = await getStagedDrugForStaff(drugKey)
  if (error || !concept) notFound()
  const fullLabelCandidates = await getFullLabelCandidates(concept.rxcui, concept.preferred_name).catch(() => [])
  const evidenceBySection = Object.entries(Object.groupBy(evidence, (item) => item.section_type)).sort(([left], [right]) => left.localeCompare(right))
  const fullLabelBasePath = basePath.startsWith('/admin') ? '/admin/full-labels' : '/reviewer/full-labels'

  return (
    <div className="space-y-8">
      <Link href={basePath} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"><ArrowLeft size={17} />Kembali ke workbench</Link>
      <section className="rounded-[2.5rem] border border-warning/30 bg-warning/5 p-8 md:p-10">
        <div className="flex flex-wrap gap-2"><Badge variant="warning"><ShieldAlert className="mr-1" size={13} />Unreviewed evidence</Badge><Badge variant="destructive">Hidden · tidak public-ready</Badge>{concept.is_pilot && <Badge><FlaskConical className="mr-1" size={13} />Pilot</Badge>}</div>
        <h1 className="mt-6 text-5xl font-serif text-text">{concept.preferred_name}</h1>
        <p className="mt-3 text-sm text-text-muted">{concept.drug_key} · {concept.seed_type} · {concept.identity_status} · BPOM_PENDING</p>
        <p className="mt-5 max-w-3xl leading-relaxed text-text-muted">Evidence di halaman terautentikasi ini adalah bahan sumber, bukan monografi. Teks tersebut tidak boleh disalin langsung ke draf publik.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Identitas</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-text-muted"><p>RxNorm: {concept.rxnorm_name || '—'} {concept.rxnorm_tty ? `(${concept.rxnorm_tty})` : ''}</p><p>RxCUI: {concept.rxcui || '—'}</p><p>Ingredient: {concept.ingredient_parts.join(' + ')}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Readiness</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-text-muted"><p>Editorial candidate: {concept.core_editorial_candidate ? 'ya' : 'tidak'}</p><p>Public status: hidden</p><p>Publication eligible: false</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Cakupan</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-text-muted"><p>{evidenceBySection.length} bagian evidence</p><p>{evidence.length} record evidence</p><p>{sources.length} dokumen provenance</p></CardContent></Card>
      </div>

      {fullLabelCandidates.length > 0 && <Card className="border-primary/20 bg-primary/5"><CardHeader><div className="flex items-center gap-3"><div className="rounded-2xl bg-primary/10 p-3 text-primary"><BookOpenText size={21} /></div><div><CardTitle>Label FDA lengkap</CardTitle><p className="mt-1 text-sm text-text-muted">Dokumen produk penuh disimpan privat di R2 dan hanya tersedia untuk reviewer/admin.</p></div></div></CardHeader><CardContent className="space-y-3">{fullLabelCandidates.map((candidate) => <div key={candidate.label_id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-text">{candidate.preferred_name || concept.preferred_name}</p><p className="mt-1 text-xs text-text-muted">Label efektif: {candidate.effective_time || 'tidak tercantum'} · {candidate.ingredient_count} bahan aktif</p></div><Link href={`${fullLabelBasePath}/${encodeURIComponent(candidate.label_id)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-hover">Buka label lengkap <ArrowUpRight size={16} /></Link></div>)}</CardContent></Card>}

      {publication && <section className="rounded-3xl border border-success/30 bg-success/5 p-6"><div className="flex items-start gap-3"><BadgeCheck className="mt-0.5 shrink-0 text-success" size={22} /><div><h2 className="font-serif text-2xl text-text">Monografi telah diterbitkan</h2><p className="mt-2 text-sm leading-relaxed text-text-muted">Versi publik berisi {publication.published_section_count} bagian yang telah disetujui. Evidence staging tetap tersembunyi dan tidak menjadi konten publik.</p><Link href={`/obat/${concept.slug}`} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary">Buka monografi publik <ArrowUpRight size={16} /></Link></div></div></section>}

      <Card className="border-primary/20"><CardHeader><CardTitle>Review Draf Bahasa Indonesia</CardTitle><p className="text-sm leading-relaxed text-text-muted">Reviewer menilai draf Bahasa Indonesia yang sudah dikirim Editor. Evidence FDA di bawah tetap read-only sebagai sumber pembanding.</p></CardHeader><CardContent><EditorialReviewPanel drafts={drafts} aiCandidates={candidates} actorId={session.user.id} /></CardContent></Card>

      {session.activeRole === 'admin' && <AdminPublicationPanel drafts={drafts} publication={publication} publishedDraftIds={publishedDraftIds} />}

      <section className="space-y-4"><div><h2 className="font-serif text-3xl text-text">Evidence sumber</h2><p className="mt-1 text-sm text-text-muted">Evidence FDA hanya untuk pembanding reviewer dan tidak dapat diedit atau diterbitkan langsung.</p></div>{evidenceBySection.map(([section, records]) => <Card key={section}><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>{SECTION_LABELS[section] || section}</CardTitle><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Untuk obat: {concept.preferred_name}</Badge><Badge variant="outline">{records?.length || 0} sumber</Badge></div></div></CardHeader><CardContent className="space-y-4">{records?.map((item) => <details key={item.evidence_id} className="rounded-2xl border border-border bg-surface-2 p-5"><summary className="cursor-pointer font-bold text-text">{concept.preferred_name} · {item.source_name} · {item.source_section}</summary><div className="mt-4 flex flex-wrap gap-2"><Badge variant="outline">Kecocokan sumber: {item.ingredient_match_status}</Badge>{item.product_specific && <Badge variant="warning">Spesifik produk</Badge>}<Badge variant="destructive">Tidak untuk publik</Badge></div><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{item.source_text}</p><p className="mt-4 text-xs text-text-muted">Evidence ID {item.evidence_id} · publication_eligible=false</p></details>)}</CardContent></Card>)}</section>

      <section className="space-y-4"><h2 className="font-serif text-3xl text-text">Provenance</h2><div className="grid gap-4 md:grid-cols-2">{sources.map((source) => <Card key={source.source_document_key}><CardContent className="p-6"><div className="flex items-center gap-2"><FileWarning size={18} className="text-warning" /><strong>{source.source_name}</strong></div><p className="mt-2 text-xs text-text-muted">{source.source_document_id} · {source.validation_status} · {source.usage_scope}</p>{source.source_url && <a href={source.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary">Buka sumber <ArrowUpRight size={16} /></a>}</CardContent></Card>)}</div></section>

      <section className="space-y-4"><h2 className="font-serif text-3xl text-text">Audit trail editorial</h2>{events.length ? events.map((event) => <div key={event.id} className="flex gap-4 rounded-2xl border border-border bg-surface p-5"><Clock3 size={18} className="mt-0.5 text-primary" /><div><p className="font-bold text-text">{event.action.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-text-muted">{new Date(event.created_at).toLocaleString('id-ID')} · actor {event.actor_id.slice(0, 8)}</p></div></div>) : <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-text-muted">Belum ada aktivitas editorial.</p>}</section>
    </div>
  )
}
