import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, BadgeCheck, CalendarDays, Globe2, Info, Pill, ShieldQuestion } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { AWARE_DESCRIPTIONS, VERIFICATION_LABELS, WHO_BPOM_DISCLAIMER } from '@/lib/who/constants'
import { displayMedicineName, getPublicLocalDrugBySlug, getPublicWhoMedicineBySlug } from '@/lib/who/queries'

export const dynamic = 'force-dynamic'

export default async function DrugDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { medicine } = await getPublicWhoMedicineBySlug(slug)
  if (!medicine) {
    const localDrug = await getPublicLocalDrugBySlug(slug)
    if (!localDrug) notFound()
    const labels: Record<string, string> = {
      indication: 'Indikasi', dosage: 'Dosis dan aturan pakai', side_effects: 'Efek samping',
      contraindication: 'Kontraindikasi', drug_interactions: 'Interaksi obat', warnings: 'Peringatan',
      pregnancy_category: 'Kehamilan', mechanism: 'Mekanisme kerja', pharmacokinetics: 'Farmakokinetik',
      storage: 'Penyimpanan', references: 'Referensi',
    }
    return (
      <div className="container space-y-8 px-4 pb-28">
        <Link href="/obat" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"><ArrowLeft size={17} /> Kembali ke katalog</Link>
        <section className="rounded-[2.5rem] border border-border bg-surface p-8 md:p-12"><div className="flex flex-wrap gap-2"><Badge variant="success"><BadgeCheck className="mr-1" size={13} /> Monografi Apoteq terpublikasi</Badge></div><div className="mt-7 flex items-center gap-5"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Pill size={30} /></div><div><h1 className="text-5xl font-serif text-text md:text-7xl">{localDrug.name}</h1><p className="mt-2 text-text-muted">{localDrug.drug_class || 'Golongan obat belum tersedia'}</p></div></div>{localDrug.summary && <p className="mt-8 max-w-3xl text-lg leading-relaxed text-text-muted">{localDrug.summary}</p>}</section>
        <div className="grid gap-6">{localDrug.sections?.length ? localDrug.sections.map((section) => <Card key={section.id} className="rounded-3xl"><CardHeader><CardTitle>{labels[section.section_type] || section.section_type}</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap leading-relaxed text-text-muted">{section.content}</p></CardContent></Card>) : <Card><CardContent className="p-8 text-text-muted">Informasi monografi belum tersedia.</CardContent></Card>}</div>
        <Card className="border-warning/20 bg-warning/5"><CardContent className="p-7"><h2 className="font-bold text-text">Informasi kesehatan</h2><p className="mt-2 text-text-muted">Gunakan informasi ini bersama arahan dokter atau apoteker. Jangan mengubah terapi tanpa berkonsultasi dengan tenaga kesehatan.</p></CardContent></Card>
      </div>
    )
  }

  const displayName = displayMedicineName(medicine)
  return (
    <div className="container space-y-8 px-4 pb-28">
      <Link href="/obat" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"><ArrowLeft size={17} /> Kembali ke katalog</Link>

      <section className="overflow-hidden rounded-[2.5rem] border border-border bg-surface">
        <div className="grid gap-8 p-8 md:p-12 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge>World Health Organization</Badge>
              {medicine.verification_status === 'verified' ? <Badge variant="success"><BadgeCheck className="mr-1" size={13} /> Diverifikasi Apoteq</Badge> : <Badge variant="secondary"><ShieldQuestion className="mr-1" size={13} /> Belum ditinjau</Badge>}
            </div>
            <h1 className="text-5xl font-serif leading-tight text-text md:text-7xl">{displayName}</h1>
            {medicine.editorial_name && medicine.editorial_name !== medicine.medicine_name && <p className="text-sm text-text-muted">Nama sumber WHO: {medicine.medicine_name}</p>}
            <p className="max-w-2xl text-lg leading-relaxed text-text-muted">Profil sumber WHO untuk identifikasi obat esensial dan klasifikasi antibiotik AWaRe. Informasi klinis rinci belum tersedia pada snapshot ini.</p>
          </div>
          <div className="rounded-3xl bg-primary/5 p-6">
            <Globe2 className="mb-5 text-primary" size={30} />
            <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Sumber resmi</p>
            <p className="mt-2 font-serif text-xl text-text">World Health Organization</p>
            {medicine.official_source_url && <a href={medicine.official_source_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary">Buka halaman WHO <ArrowUpRight size={17} /></a>}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader><CardTitle>Status WHO</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div><p className="text-xs font-bold uppercase tracking-widest text-text-muted">Essential Medicines List</p><p className="mt-2 text-lg text-text">{medicine.is_who_eeml ? 'Listed in the WHO Electronic Essential Medicines List' : medicine.is_not_on_eml ? 'Tidak tercantum dalam WHO EML' : 'Status EML tidak dinyatakan'}</p></div>
            {medicine.is_monitoring_only && <Badge variant="outline">Dicantumkan untuk tujuan monitoring</Badge>}
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader><CardTitle>Klasifikasi antibiotik AWaRe</CardTitle></CardHeader>
          <CardContent>
            {medicine.aware_category ? <><Badge className="mb-4">{medicine.aware_category}</Badge><p className="leading-relaxed text-text-muted">{AWARE_DESCRIPTIONS[medicine.aware_category]}</p></> : <p className="text-text-muted">Tidak ada klasifikasi AWaRe pada snapshot WHO ini.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-primary/15 bg-primary/5">
        <CardContent className="grid gap-6 p-7 md:grid-cols-[auto_1fr]">
          <Info className="text-primary" size={26} />
          <div><h2 className="font-bold text-text">Batas informasi</h2><p className="mt-2 leading-relaxed text-text-muted">{WHO_BPOM_DISCLAIMER}</p><p className="mt-3 text-sm text-text-muted">Dosis, indikasi, interaksi, kontraindikasi, dan penggunaan pada kehamilan: <strong>informasi belum tersedia</strong>. Jangan menggunakan halaman ini sebagai pengganti konsultasi tenaga kesehatan.</p></div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-6 border-t border-border pt-6 text-sm text-text-muted">
        <span className="flex items-center gap-2"><ShieldQuestion size={17} /> {VERIFICATION_LABELS[medicine.verification_status]}</span>
        <span className="flex items-center gap-2"><CalendarDays size={17} /> Diperbarui {new Date(medicine.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>
    </div>
  )
}
