import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, BadgeCheck, Clock3, FileWarning, FlaskConical, ShieldAlert } from 'lucide-react'
import { requireReviewer } from '@/lib/auth/server'
import { getStagedDrugForStaff } from '@/lib/staging/queries'
import { StagingEditorialForm } from './StagingEditorialForm'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const SECTION_LABELS: Record<string, string> = {
  indication: 'Indikasi', dosage: 'Dosis dan penggunaan', warnings: 'Peringatan', side_effects: 'Efek samping', drug_interactions: 'Interaksi obat', specific_populations: 'Populasi khusus', pregnancy: 'Kehamilan', clinical_pharmacology: 'Farmakologi klinis', mechanism: 'Mekanisme kerja', pharmacokinetics: 'Farmakokinetik', storage: 'Penyimpanan', how_supplied: 'Sediaan', contraindication: 'Kontraindikasi',
}

export async function StagingDetailPage({ drugKey, basePath }: { drugKey: string; basePath: string }) {
  const session = await requireReviewer()
  const { concept, evidence, sources, drafts, events, publication, error } = await getStagedDrugForStaff(drugKey)
  if (error || !concept) notFound()
  const evidenceBySection = Object.entries(Object.groupBy(evidence, (item) => item.section_type)).sort(([left], [right]) => left.localeCompare(right))

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

      {publication && <section className="rounded-3xl border border-success/30 bg-success/5 p-6"><div className="flex items-start gap-3"><BadgeCheck className="mt-0.5 shrink-0 text-success" size={22} /><div><h2 className="font-serif text-2xl text-text">Monografi telah diterbitkan</h2><p className="mt-2 text-sm leading-relaxed text-text-muted">Versi publik berisi {publication.published_section_count} bagian yang telah disetujui. Evidence staging tetap tersembunyi dan tidak menjadi konten publik.</p><Link href={`/obat/${concept.slug}`} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary">Buka monografi publik <ArrowUpRight size={16} /></Link></div></div></section>}

      <Card className="border-primary/20"><CardHeader><CardTitle>Editorial Bahasa Indonesia</CardTitle></CardHeader><CardContent><StagingEditorialForm drugKey={concept.drug_key} isPilot={concept.is_pilot} availableSections={evidenceBySection.map(([section]) => section)} drafts={drafts} publication={publication} actorId={session.user.id} /></CardContent></Card>

      <section className="space-y-4"><div><h2 className="font-serif text-3xl text-text">Coverage & evidence</h2><p className="mt-1 text-sm text-text-muted">Seluruh source_text hanya dirender di workspace terautentikasi ini.</p></div>{evidenceBySection.map(([section, records]) => <Card key={section}><CardHeader><div className="flex items-center justify-between gap-4"><CardTitle>{SECTION_LABELS[section] || section}</CardTitle><Badge variant="warning">{records?.length || 0} unreviewed</Badge></div></CardHeader><CardContent className="space-y-4">{records?.map((item) => <details key={item.evidence_id} className="rounded-2xl border border-border bg-surface-2 p-5"><summary className="cursor-pointer font-bold text-text">{item.source_name} · {item.source_section}</summary><div className="mt-4 flex flex-wrap gap-2"><Badge variant="outline">{item.ingredient_match_status}</Badge>{item.product_specific && <Badge variant="warning">Product-specific</Badge>}<Badge variant="destructive">Not public-ready</Badge></div><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{item.source_text}</p><p className="mt-4 text-xs text-text-muted">Evidence ID {item.evidence_id} · publication_eligible=false</p></details>)}</CardContent></Card>)}</section>

      <section className="space-y-4"><h2 className="font-serif text-3xl text-text">Provenance</h2><div className="grid gap-4 md:grid-cols-2">{sources.map((source) => <Card key={source.source_document_key}><CardContent className="p-6"><div className="flex items-center gap-2"><FileWarning size={18} className="text-warning" /><strong>{source.source_name}</strong></div><p className="mt-2 text-xs text-text-muted">{source.source_document_id} · {source.validation_status} · {source.usage_scope}</p>{source.source_url && <a href={source.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary">Buka sumber <ArrowUpRight size={16} /></a>}</CardContent></Card>)}</div></section>

      <section className="space-y-4"><h2 className="font-serif text-3xl text-text">Audit trail editorial</h2>{events.length ? events.map((event) => <div key={event.id} className="flex gap-4 rounded-2xl border border-border bg-surface p-5"><Clock3 size={18} className="mt-0.5 text-primary" /><div><p className="font-bold text-text">{event.action.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-text-muted">{new Date(event.created_at).toLocaleString('id-ID')} · actor {event.actor_id.slice(0, 8)}</p></div></div>) : <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-text-muted">Belum ada aktivitas editorial.</p>}</section>
    </div>
  )
}
