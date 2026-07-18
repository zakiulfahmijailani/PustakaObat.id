'use client'

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  MessageSquare, 
  ChevronDown, 
  Send, 
  CheckCircle2, 
  Clock, 
  Loader2,
  AlertCircle,
  Plus
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Profile, PublicQuestion } from '@/types'

interface QuestionListProps {
  questions: (PublicQuestion & { 
    drug: { id: string, name: string } | null,
    answered_by_profile: Profile | null
  })[]
  userId: string
}

export const QuestionList = ({ questions, userId: _userId }: QuestionListProps) => {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const _supabase = createClient()
  const router = useRouter()

  const handleAnswer = async (questionId: string) => {
    if (!answer.trim()) return

    setIsSubmitting(true)
    setError(null)

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    try {
      // Mock update always succeeds for demo
      setAnswer('')
      setActiveId(null)
      router.refresh()
    } catch {
      setError('Gagal mengirim jawaban.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl bg-error/10 border border-error/20 flex items-center gap-3 text-error text-sm animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      )}

      {questions.map((q) => (
        <Card key={q.id} className="border-none bg-surface-2/40 overflow-hidden transition-all duration-300">
          <CardContent className="p-0">
            <div 
              className={`p-6 md:p-8 flex items-start justify-between gap-6 cursor-pointer hover:bg-surface-2 transition-colors ${activeId === q.id ? 'bg-surface-2 shadow-inner' : ''}`}
              onClick={() => setActiveId(activeId === q.id ? null : q.id)}
            >
              <div className="flex gap-6 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 transition-transform">
                  <MessageSquare size={24} />
                </div>
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-bold text-text truncate max-w-[200px]">
                      {q.asker_name || 'Anonim'}
                    </span>
                    <Badge variant={q.status === 'answered' ? 'success' : 'warning'}>
                      {q.status === 'answered' ? 'TERJAWAB' : 'PENDING'}
                    </Badge>
                    {q.drug && (
                      <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5">
                        {q.drug.name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-lg font-serif text-text leading-relaxed line-clamp-2">
                    &quot;{q.question_text}&quot;
                  </p>
                  <div className="flex items-center gap-4 text-xs font-bold text-text-muted uppercase tracking-wide">
                    <span>{new Date(q.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {q.asker_email && (
                      <span className="flex items-center gap-1.5 lowercase">
                        <Clock size={12} />
                        {q.asker_email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronDown className={`text-text-muted transition-transform duration-300 ${activeId === q.id ? 'rotate-180' : ''}`} size={20} />
            </div>

            {activeId === q.id && (
              <div className="px-8 pb-10 pt-4 border-t border-border animate-in slide-in-from-top-2 duration-300 bg-white/50">
                <div className="pl-18 space-y-8">
                  {q.status === 'answered' ? (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 text-xs font-bold text-success uppercase tracking-widest bg-success/5 px-4 py-2 rounded-full border border-success/10 w-fit">
                        <CheckCircle2 size={14} />
                        DIJAWAB OLEH {q.answered_by_profile?.full_name || 'TIM FARMASI'}
                      </div>
                      <div className="p-8 rounded-[2rem] bg-surface-2 border border-border italic text-text-muted text-lg leading-relaxed shadow-sm">
                        {q.answer_text}
                      </div>
                      <div className="flex justify-end gap-3 text-xs font-medium text-text-muted">
                        <span>Terjawab pada {q.answered_at ? new Date(q.answered_at).toLocaleString('id-ID') : '-'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 text-xs font-bold text-primary uppercase tracking-widest bg-primary/5 px-4 py-2 rounded-full border border-primary/10 w-fit">
                        <Plus size={14} />
                        Berikan Jawaban Profesional
                      </div>
                      <div className="space-y-4">
                        <Textarea
                          placeholder="Berikan jawaban yang jelas, akurat, dan sesuai standar farmakope..."
                          className="min-h-[200px] rounded-[2rem] text-lg p-8 focus-visible:ring-4 focus-visible:ring-primary/10 border-border"
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                        />
                        <div className="flex justify-end items-center gap-4">
                          <p className="text-xs text-text-muted font-bold uppercase tracking-wide max-w-[300px] text-right leading-relaxed">
                            Jawaban akan dipublikasikan ke halaman publik PustakaObat.id segera setelah terikirim.
                          </p>
                          <Button 
                            className="rounded-full h-14 px-8 gap-3 shadow-xl shadow-primary/10" 
                            disabled={isSubmitting || !answer.trim()}
                            onClick={() => handleAnswer(q.id)}
                          >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                            Kirim Jawaban
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
