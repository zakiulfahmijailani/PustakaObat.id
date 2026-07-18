import React from 'react'
import { MOCK_DRUGS, MOCK_QUESTIONS, MOCK_PROFILES } from '@/lib/mock-data'
import { PublicQuestionForm } from '@/components/drug/PublicQuestionForm'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { User, CheckCircle2, Pill, HelpCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default async function PublicQuestionPage() {
  // Use mock data
  const drugs = MOCK_DRUGS.map(d => ({ id: d.id, name: d.name }))

  // Map mock questions to include profiles and drug data as expected by the UI
  const questions = MOCK_QUESTIONS.map(q => ({
    ...q,
    answered_by_profile: MOCK_PROFILES.find(p => p.id === q.answered_by),
    drug: MOCK_DRUGS.find(d => d.id === q.drug_id)
  })).filter(q => q.status === 'answered' && q.is_published)

  return (
    <div className="container px-4 pb-32 space-y-24">
      {/* Search Header */}
      <section className="pt-10 flex flex-col items-center text-center space-y-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Badge variant="default" className="px-5 py-2 rounded-full uppercase text-xs font-bold tracking-wide bg-primary/5 border-primary/20 text-primary">
          Konsultasi Informasi Obat
        </Badge>
        <h1 className="text-4xl md:text-7xl font-serif text-text leading-[1.1]">
          Punya <span className="italic">Pertanyaan</span> Seputar Obat?
        </h1>
        <p className="text-lg text-text-muted leading-relaxed">
          Platform tanya jawab terbuka untuk masyarakat yang ingin mendapatkan informasi 
          akurat mengenai penggunaan obat-obatan dari tenaga farmasi terverifikasi.
        </p>
      </section>

      {/* Form Section */}
      <section className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
        <PublicQuestionForm drugs={drugs || []} />
      </section>

      {/* Answered Questions List */}
      <section className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
        <div className="flex flex-col md:flex-row items-end justify-between gap-6 border-b border-border pb-8">
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-primary uppercase tracking-widest">Koleksi Jawaban</h2>
            <h3 className="text-3xl md:text-5xl font-serif text-text">Pertanyaan Populer</h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-text-muted uppercase tracking-widest">
            {questions?.length || 0} PERTANYAAN DIJAWAB
          </div>
        </div>

        <div className="grid grid-cols-1 gap-10">
          {questions && questions.length > 0 ? (
            questions.map((q) => (
              <Card key={q.id} className="border-none shadow-sm bg-surface-2/40 hover:bg-surface-2 transition-all p-2 rounded-[2.5rem] group">
                <CardContent className="p-8 md:p-12 space-y-10">
                  {/* User Question */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-border/20 flex items-center justify-center text-text-muted">
                          <User size={20} />
                        </div>
                        <span className="text-sm font-bold text-text">{q.asker_name || 'Anonim'}</span>
                        <div className="w-1 h-1 rounded-full bg-border" />
                        <span className="text-xs text-text-muted font-medium">
                          {new Date(q.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {q.drug && (
                        <Link href={`/obat/${q.drug.slug}`} className="flex min-h-11 items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-xs font-bold text-primary uppercase tracking-wide hover:bg-primary/10 transition-colors">
                          <Pill size={12} />
                          {q.drug.name}
                        </Link>
                      )}
                    </div>
                    <p className="text-2xl md:text-3xl font-serif text-text italic leading-relaxed">
                      &quot;{q.question_text}&quot;
                    </p>
                  </div>

                  {/* Pharmacist Answer */}
                  <div className="relative pl-8 md:pl-12 border-l-4 border-primary/30 py-4 space-y-6 animate-in slide-in-from-left-4 duration-500">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-300">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-text mb-1">
                          {q.answered_by_profile?.full_name || 'Apoteker PustakaObat.id'}
                        </h4>
                        <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest">
                          <BadgeCheckIcon size={12} />
                          {q.answered_by_profile?.role === 'pharmacist' ? 'Apoteker Terdaftar' : 'Verifikator Farmasi'}
                        </div>
                      </div>
                    </div>

                    <div className="prose prose-slate max-w-none text-lg leading-relaxed text-text-muted bg-white/50 backdrop-blur-sm p-8 rounded-3xl border border-border/50">
                      {q.answer_text}
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <p className="text-xs text-text-muted/60 italic leading-relaxed max-w-md">
                        Dijawab pada {q.answered_at ? new Date(q.answered_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                      </p>
                      <button className="text-xs font-bold text-primary hover:underline flex items-center gap-1 group/btn">
                        Sukai Jawaban <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 bg-surface-2/50 rounded-[3rem] border border-dashed border-border px-8">
              <div className="w-20 h-20 rounded-full bg-border/20 flex items-center justify-center text-text-muted/40">
                <HelpCircle size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-serif text-text">Belum ada diskusi publik</h3>
                <p className="text-text-muted max-w-sm mx-auto leading-relaxed">
                  Semua pertanyaan yang dijawab dan dipublikasikan akan muncul di sini untuk membantu masyarakat lain.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Disclaimer */}
      <section className="container max-w-4xl text-center px-4 pt-20">
        <div className="bg-primary/5 border border-primary/10 p-10 md:p-16 rounded-[3em] space-y-8">
          <BadgeCheckIcon size={48} className="mx-auto text-primary opacity-30" />
          <h3 className="text-2xl md:text-3xl font-serif text-text">Diskusi Terpercaya untuk Keamanan Anda.</h3>
          <p className="text-text-muted max-w-xl mx-auto leading-relaxed">
            Setiap jawaban diberikan oleh tenaga farmasi yang telah melalui proses verifikasi SIPA (Surat Izin Praktik Apoteker). 
            Ini adalah bagian dari layanan publik PustakaObat.id untuk Indonesia.
          </p>
        </div>
      </section>
    </div>
  )
}

function BadgeCheckIcon({ size = 16, className = "" }: { size?: number, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
