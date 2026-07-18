import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { 
  Pill, 
  AlertTriangle, 
  Info,
  Activity,
  ArrowLeft
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ReviewAction } from '@/components/dashboard/ReviewAction'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ReviewDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = createClient()
  const { data: { user } } = await (await supabase).auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: drug, error } = await (await supabase)
    .from('drugs')
    .select(`
      *,
      drug_categories(name, slug),
      submitted_by_profile:profiles!drugs_submitted_by_fkey(full_name, institution),
      sections:drug_monograph_sections(*)
    `)
    .eq('id', id)
    .single()

  if (!drug || error) {
    notFound()
  }

  const sections = drug.sections || []
  
  const sectionLabels: Record<string, string> = {
    indication: 'Indikasi Umum',
    dosage: 'Dosis & Aturan Pakai',
    side_effects: 'Efek Samping',
    contraindication: 'Kontraindikasi',
    drug_interactions: 'Interaksi Obat',
    mechanism: 'Mekanisme Kerja',
    pharmacokinetics: 'Farmakokinetik',
    storage: 'Cara Penyimpanan',
    warnings: 'Peringatan & Perhatian',
    pregnancy_category: 'Kategori Kehamilan',
    references: 'Referensi Medis',
  }

  const sectionPriority = [
    'indication', 'dosage', 'side_effects', 'contraindication', 
    'drug_interactions', 'warnings', 'pregnancy_category', 'mechanism', 
    'pharmacokinetics', 'storage', 'references'
  ]

  const sortedSections = [...sections].sort((a, b) => {
    return sectionPriority.indexOf(a.section_type) - sectionPriority.indexOf(b.section_type)
  })

  return (
    <div className="space-y-12 pb-32">
       {/* Top Nav */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="rounded-full w-12 h-12 p-0" asChild>
            <Link href="/dashboard/verifikasi">
              <ArrowLeft size={24} />
            </Link>
          </Button>
          <div className="space-y-1">
            <h2 className="text-3xl font-serif text-text">Review Monografi</h2>
            <div className="flex items-center gap-4 text-xs font-bold text-text-muted uppercase tracking-widest">
              <span>PENULIS: {drug.submitted_by_profile?.full_name || 'Pharmacist'}</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>SUBMITTED: {new Date(drug.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="warning" className="px-6 py-2 rounded-full uppercase text-xs font-bold tracking-wide border-warning/20 text-warning bg-warning/5">
            Menunggu Verifikasi
          </Badge>
          <Button variant="outline" className="rounded-xl h-12 px-6 gap-2 border-border" asChild>
            <Link href={`/dashboard/obat/${drug.id}/edit`}>
              Edit Draft
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-12 items-start animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
        {/* Content Viewer (Refined Version of Public View) */}
        <section className="space-y-12">
          <div className="space-y-8 p-10 md:p-14 bg-surface-2/40 rounded-[3rem] border border-border/50">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="default" className="px-5 py-2 rounded-full uppercase text-xs font-bold tracking-wide bg-primary/5 border-primary/20 text-primary">
                  {drug.drug_class || 'Golongan Obat'}
                </Badge>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 border border-border text-xs font-bold text-text-muted uppercase tracking-wide">
                  <Pill size={14} className="text-primary" />
                  {drug.drug_categories?.name || 'UMUM'}
                </div>
              </div>
              <h1 className="text-5xl md:text-6xl font-serif text-text leading-[1.1]">{drug.name}</h1>
              <p className="text-xl text-text-muted leading-relaxed italic">
                {drug.brand_names && drug.brand_names.length > 0 
                  ? `Nama Dagang: ${drug.brand_names.join(', ')}` 
                  : 'Nama Generik'}
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-white border border-border/50 shadow-sm space-y-6">
              <div className="flex items-center gap-3 text-primary">
                <Info size={24} />
                <h2 className="text-lg font-bold uppercase tracking-widest">Ringkasan Draft</h2>
              </div>
              <p className="text-lg text-text italic leading-relaxed">
                &quot;{drug.summary || 'Informasi monografi obat lengkap.'}&quot;
              </p>
            </div>

            {/* Sections Display */}
            <div className="space-y-12 pt-8">
              {sortedSections.map((section) => (
                <div key={section.id} className="space-y-6 group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <Activity size={20} />
                    </div>
                    <h3 className="text-xl font-bold uppercase tracking-widest text-text">
                      {sectionLabels[section.section_type] || section.section_type}
                    </h3>
                  </div>
                  <div className="pl-14 prose prose-slate max-w-none text-lg text-text-muted whitespace-pre-wrap leading-relaxed italic">
                    {section.content}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-error/5 border-2 border-error/10 p-10 md:p-12 rounded-[3.5rem] flex items-start gap-6">
            <AlertTriangle size={32} className="text-error shrink-0 mt-1" />
            <div className="space-y-4">
              <h3 className="text-xl font-bold uppercase tracking-widest text-error">Validasi Penting</h3>
              <p className="text-lg text-error/80 leading-relaxed font-medium">
                Sebagai verifikator, Anda bertanggung jawab atas kredibilitas medis informasi di atas. 
                Pastikan data sesuai dengan formularium nasional dan literatur klinis terbaru.
              </p>
            </div>
          </div>
        </section>

        {/* Action Sidebar */}
        <ReviewAction 
          drugId={drug.id} 
          drugName={drug.name} 
          userId={user.id} 
        />
      </div>
    </div>
  )
}
