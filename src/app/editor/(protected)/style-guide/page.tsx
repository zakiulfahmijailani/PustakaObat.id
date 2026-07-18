import { BookOpenText, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'

const rules = ['Gunakan bahasa Indonesia yang jelas, tenang, dan mudah dipahami.', 'Susun informasi dengan judul, subjudul, daftar, dan paragraf pendek.', 'Pertahankan istilah medis yang perlu, lalu beri penjelasan singkat.', 'Jangan menambah atau mengubah klaim klinis tanpa proses review.', 'Tulis sumber dan istilah secara konsisten; hindari nada promosi atau diagnosis.']

export default function EditorStyleGuidePage() {
  return <div className="space-y-8"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Referensi kerja</p><h1 className="mt-2 flex items-center gap-3 font-serif text-4xl text-text"><BookOpenText size={32} />Panduan gaya</h1><p className="mt-2 max-w-2xl text-text-muted">Panduan ringkas untuk menyusun tulisan PustakaObat.id sebelum diperiksa oleh Reviewer.</p></div><Card className="border-none bg-surface-2/50"><CardContent className="space-y-5 p-8">{rules.map((rule) => <div key={rule} className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-primary" size={20} /><p className="leading-relaxed text-text-muted">{rule}</p></div>)}</CardContent></Card></div>
}
