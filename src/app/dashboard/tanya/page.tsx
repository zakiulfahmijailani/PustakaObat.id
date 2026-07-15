import React from 'react'
import { MOCK_QUESTIONS, MOCK_PROFILES } from '@/lib/mock-data'
import { PublicQuestionWithDetails } from '@/types'
import { QuestionList } from '@/components/dashboard/QuestionList'
import { MessageSquare, Search, HelpCircle, Inbox, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'

export default async function QuestionInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status, q } = await searchParams
  
  // Static Demo: Always use pharmacist Budi Santoso
  const profile = MOCK_PROFILES[0]
  
  let questions = [...MOCK_QUESTIONS] as unknown as PublicQuestionWithDetails[]

  if (status && status !== 'all') {
    questions = questions.filter(q => q.status === status)
  }

  if (q) {
    const searchTerm = q.toLowerCase()
    questions = questions.filter(q => q.question_text.toLowerCase().includes(searchTerm))
  }

  const statusOptions = [
    { label: 'Semua Pertanyaan', value: 'all', icon: Inbox },
    { label: 'Butuh Jawaban', value: 'pending', icon: MessageSquare },
    { label: 'Selesai Dijawab', value: 'answered', icon: CheckCircle2 },
  ]


  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden">
        <div className="animate-in fade-in slide-in-from-left-4 duration-700">
          <h2 className="text-3xl font-serif text-text leading-tight">Kotak Masuk Diskusi</h2>
          <p className="text-text-muted mt-1 leading-relaxed">
            Berikan jawaban profesional terhadap pertanyaan masyarakat mengenai penggunaan obat.
          </p>
        </div>
        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-700">
          <Badge variant="default" className="px-5 py-2.5 rounded-full text-[10px] uppercase font-bold tracking-widest bg-primary/5 border-primary/20 text-primary">
            {questions?.filter(q => q.status === 'pending').length || 0} Pertanyaan Baru
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-none bg-surface-2/40 rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row gap-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <form action="" method="get">
              <input 
                name="q"
                type="text" 
                defaultValue={q}
                placeholder="Cari kata kunci dalam pertanyaan..." 
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
              <input type="hidden" name="status" value={status || 'all'} />
            </form>
          </div>
          
          <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            {statusOptions.map((opt) => (
              <Link 
                key={opt.value}
                href={`/admin/questions?status=${opt.value}${q ? `&q=${q}` : ''}`}
                className={`flex items-center gap-3 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap border-2 transition-all ${
                  (status || 'all') === opt.value
                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/10'
                    : 'bg-transparent text-text-muted border-border hover:border-primary/30'
                }`}
              >
                <opt.icon size={16} />
                {opt.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
        {questions && questions.length > 0 ? (
          <QuestionList questions={questions} userId={profile.id} />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 bg-surface-2/50 rounded-[3rem] border border-dashed border-border px-8">
            <div className="w-20 h-20 rounded-full bg-border/20 flex items-center justify-center text-text-muted/40">
              <MessageSquare size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-serif text-text">Kotak masuk bersih</h3>
              <p className="text-text-muted max-w-sm mx-auto leading-relaxed">
                {q ? `Tidak ditemukan pertanyaan dengan kata kunci "${q}".` : 'Belum ada pertanyaan dari publik yang tersedia untuk dijawab.'}
              </p>
            </div>
            {!q && (
              <Button variant="outline" className="rounded-full px-8 h-12" asChild>
                <Link href="/admin/dashboard">Kembali ke Ringkasan</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="pt-10 flex flex-col items-center text-center gap-4 border-t border-border pt-12">
        <HelpCircle size={48} className="text-primary opacity-20" />
        <h4 className="text-lg font-serif">Pentingnya Jawaban Profesional</h4>
        <p className="text-sm text-text-muted max-w-2xl mx-auto italic leading-relaxed">
          Semua jawaban Anda akan dipublikasikan ke halaman publik apoteq dan dapat dibaca oleh ribuan orang. 
          Gunakan referensi medis yang sahih dan berikan edukasi yang jelas mengenai keamanan obat.
        </p>
      </div>
    </div>
  )
}
