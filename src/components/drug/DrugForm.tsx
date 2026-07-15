'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/client'
import { 
  AlertCircle, 
  Loader2, 
  Pill, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronLeft,
  Save,
  Send,
  Info,
  Activity,
  History,
  Shield,
  FileText as LucideFileText
} from 'lucide-react'
import type { Drug, DrugMonographSection } from '@/types'

const drugSchema = z.object({
  name: z.string().min(3, { message: 'Nama obat minimal 3 karakter' }),
  slug: z.string().min(3, { message: 'Slug minimal 3 karakter' }),
  brand_names: z.string().optional(),
  category_id: z.string().min(1, { message: 'Pilih kategori obat' }),
  drug_class: z.string().min(3, { message: 'Golongan obat minimal 3 karakter' }),
  summary: z.string().min(10, { message: 'Ringkasan minimal 10 karakter' }).max(500, { message: 'Ringkasan terlalu panjang' }),
})

type DrugFormValues = z.infer<typeof drugSchema>

const sectionTypes = [
  { value: 'indication', label: 'Indikasi Umum', icon: Info },
  { value: 'dosage', label: 'Dosis & Aturan Pakai', icon: Activity },
  { value: 'side_effects', label: 'Efek Samping', icon: AlertCircle },
  { value: 'contraindication', label: 'Kontraindikasi', icon: Shield },
  { value: 'drug_interactions', label: 'Interaksi Obat', icon: History },
  { value: 'warnings', label: 'Peringatan & Perhatian', icon: AlertCircle },
  { value: 'pregnancy_category', label: 'Kategori Kehamilan', icon: Pill },
  { value: 'mechanism', label: 'Mekanisme Kerja', icon: Activity },
  { value: 'pharmacokinetics', label: 'Farmakokinetik', icon: Info },
  { value: 'storage', label: 'Cara Penyimpanan', icon: History },
  { value: 'references', label: 'Referensi Medis', icon: LucideFileText },
]

interface SectionContent {
  section_type: string
  content: string
}

interface DrugFormProps {
  initialData?: Partial<Drug> & { sections?: DrugMonographSection[] }
  categories: { id: string, name: string }[]
  mode?: 'create' | 'edit'
  userId: string
}

export const DrugForm = ({ initialData, categories, mode = 'create', userId }: DrugFormProps) => {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeStep, setActiveStep] = useState(1)
  const [sections, setSections] = useState<SectionContent[]>(
    initialData?.sections?.map((s) => ({ section_type: s.section_type, content: s.content })) || [{ section_type: 'indication', content: '' }]
  )
  
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DrugFormValues>({
    resolver: zodResolver(drugSchema),
    defaultValues: initialData ? {
      name: initialData.name,
      slug: initialData.slug,
      brand_names: initialData.brand_names?.join(', '),
      category_id: initialData.category_id || '',
      drug_class: initialData.drug_class || '',
      summary: initialData.summary || '',
    } : {
      name: '',
      slug: '',
      brand_names: '',
      category_id: '',
      drug_class: '',
      summary: '',
    }
  })

  const drugName = watch('name')

  React.useEffect(() => {
    if (drugName && mode === 'create') {
      const slug = drugName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
      setValue('slug', slug)
    }
  }, [drugName, setValue, mode])

  const handleAddSection = () => {
    const nextType = sectionTypes.find(t => !sections.some(s => s.section_type === t.value))?.value
    if (nextType) {
      setSections([...sections, { section_type: nextType, content: '' }])
    }
  }

  const handleRemoveSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index))
  }

  const handleSectionChange = (index: number, content: string) => {
    const newSections = [...sections]
    newSections[index].content = content
    setSections(newSections)
  }

  const handleTypeChange = (index: number, type: string) => {
    const newSections = [...sections]
    newSections[index].section_type = type
    setSections(newSections)
  }

  const onSave = async (values: DrugFormValues, status: 'draft' | 'review') => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const drugPayload = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        brand_names: values.brand_names?.split(',').map((brand) => brand.trim()).filter(Boolean) || [],
        category_id: values.category_id || null,
        drug_class: values.drug_class.trim(),
        summary: values.summary.trim(),
        status,
        submitted_by: userId,
      }

      let drugId = initialData?.id
      if (mode === 'edit' && drugId) {
        const { error: updateError } = await supabase.from('drugs').update(drugPayload).eq('id', drugId)
        if (updateError) throw updateError
      } else {
        const { data: created, error: insertError } = await supabase.from('drugs').insert(drugPayload).select('id').single()
        if (insertError || !created) throw insertError || new Error('Record obat tidak berhasil dibuat.')
        drugId = created.id
      }

      const sectionPayload = sections
        .filter((section) => section.content.trim())
        .map((section) => ({ drug_id: drugId!, section_type: section.section_type, content: section.content.trim() }))
      if (sectionPayload.length) {
        const { error: sectionError } = await supabase.from('drug_monograph_sections').upsert(sectionPayload, { onConflict: 'drug_id,section_type' })
        if (sectionError) throw sectionError
      }

      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: mode === 'edit' ? 'UPDATE_DRUG' : 'CREATE_DRUG',
        resource_type: 'drug',
        resource_id: drugId,
        metadata: { name: values.name, status, section_count: sectionPayload.length },
      })
      router.push('/admin/medicines')
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan data. Silakan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="space-y-2">
          <h2 className="text-3xl font-serif text-text">
            {mode === 'create' ? 'Buat Draft Monografi' : `Edit: ${initialData?.name}`}
          </h2>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="px-3 py-1 text-[10px] uppercase font-bold tracking-widest border-primary/20 text-primary bg-primary/5">
              Draft Mode
            </Badge>
            <div className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-widest">
              <span className={activeStep === 1 ? 'text-primary' : ''}>1. Info Dasar</span>
              <ChevronRight size={14} />
              <span className={activeStep === 2 ? 'text-primary' : ''}>2. Monografi Lengkap</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-xl h-11 px-6 border-border" disabled={isLoading} onClick={() => router.back()}>
            Batal
          </Button>
          <Button 
            className="rounded-xl h-11 px-6 gap-2 shadow-xl shadow-primary/10" 
            disabled={isLoading}
            onClick={handleSubmit((v) => onSave(v, 'draft'))}
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Simpan Draft
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-error/10 border border-error/20 flex items-center gap-3 text-error text-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      )}

      {activeStep === 1 ? (
        <Card className="border-none bg-surface-2/40 rounded-[3rem] animate-in fade-in slide-in-from-bottom-8 duration-700">
          <CardHeader className="p-10 pb-0">
            <CardTitle className="text-xl uppercase tracking-widest flex items-center gap-3">
              <Info className="text-primary" />
              Informasi Dasar Obat
            </CardTitle>
            <CardDescription>Masukkan rincian administratif dan identifikasi obat.</CardDescription>
          </CardHeader>
          <CardContent className="p-10 space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <Input
                label="Nama Generik Obat"
                placeholder="Contoh: Parasetamol"
                {...register('name')}
                error={errors.name?.message}
                disabled={isLoading}
                className="rounded-2xl h-12"
              />
              <Input
                label="URL Slug (Otomatis)"
                placeholder="parasetamol-500mg"
                {...register('slug')}
                error={errors.slug?.message}
                disabled={isLoading}
                className="rounded-2xl h-12 italic opacity-60"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-1.5 text-left">
                <label className="text-sm font-medium text-text leading-none">Kategori Farmakologi</label>
                <select
                  {...register('category_id')}
                  disabled={isLoading}
                  className="flex h-12 w-full rounded-2xl border border-border bg-surface px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 transition-all appearance-none cursor-pointer"
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                {errors.category_id && <p className="text-xs text-error font-medium">{errors.category_id.message}</p>}
              </div>

              <Input
                label="Golongan Obat (Drug Class)"
                placeholder="Contoh: Analgesik Non-Opioid"
                {...register('drug_class')}
                error={errors.drug_class?.message}
                disabled={isLoading}
                className="rounded-2xl h-12"
              />
            </div>

            <Input
              label="Nama Dagang / Merk (Pisahkan dengan koma)"
              placeholder="Contoh: Panadol, Biogesic, Sanmol"
              {...register('brand_names')}
              error={errors.brand_names?.message}
              disabled={isLoading}
              className="rounded-2xl h-12"
            />

            <Textarea
              label="Ringkasan Singkat (Max 500 Karakter)"
              placeholder="Jelaskan secara singkat kegunaan utama obat ini untuk tampilan publik."
              {...register('summary')}
              error={errors.summary?.message}
              disabled={isLoading}
              className="rounded-3xl min-h-[140px]"
            />

            <div className="pt-6 flex justify-end">
              <Button size="lg" className="rounded-full h-14 px-10 gap-2" onClick={() => setActiveStep(2)}>
                Lanjut ke Monografi Lengkap
                <ChevronRight size={20} />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-700">
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="rounded-full w-12 h-12 p-0" onClick={() => setActiveStep(1)}>
              <ChevronLeft size={24} />
            </Button>
            <h3 className="text-xl font-bold uppercase tracking-widest text-text">Penyusunan Monografi</h3>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {sections.map((section, index) => {
              const typeInfo = sectionTypes.find(t => t.value === section.section_type)
              const Icon = typeInfo?.icon || Info
              
              return (
                <Card key={index} className="border-none bg-surface-2/40 rounded-[2.5rem] group overflow-hidden">
                  <div className="p-8 md:p-10 space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <Icon size={20} />
                        </div>
                        <select
                          value={section.section_type}
                          onChange={(e) => handleTypeChange(index, e.target.value)}
                          className="bg-transparent font-bold uppercase tracking-widest text-sm focus:outline-none focus:text-primary transition-colors cursor-pointer"
                        >
                          {sectionTypes.map((t) => (
                            <option key={t.value} value={t.value} disabled={sections.some((s, i) => s.section_type === t.value && i !== index)}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button 
                        onClick={() => handleRemoveSection(index)}
                        className="p-2 rounded-full text-text-muted hover:text-error hover:bg-error/5 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <Textarea
                      placeholder={`Tulis isi untuk ${typeInfo?.label}...`}
                      value={section.content}
                      onChange={(e) => handleSectionChange(index, e.target.value)}
                      className="rounded-3xl min-h-[300px] border-none focus-visible:ring-0 text-lg text-text-muted leading-relaxed italic px-0"
                    />
                  </div>
                </Card>
              )
            })}

            <Button 
              variant="outline" 
              className="h-20 rounded-[2rem] border-2 border-dashed border-border flex items-center gap-3 hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-all font-bold uppercase tracking-widest text-xs"
              onClick={handleAddSection}
            >
              <Plus size={20} />
              Tambah Seksi Monografi
            </Button>
          </div>

          <div className="pt-10 flex flex-col md:flex-row items-center justify-between gap-8 border-t border-border pt-12">
            <p className="text-sm text-text-muted italic max-w-md leading-relaxed">
              Setelah selesai, Anda dapat langsung mengajukan monografi ini untuk direview oleh tim verifikator.
            </p>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <Button size="lg" variant="outline" className="flex-1 rounded-full h-16 px-8 gap-3 border-2" onClick={handleSubmit((v) => onSave(v, 'draft'))}>
                <Save size={20} />
                Simpan Draft
              </Button>
              <Button size="lg" className="flex-1 rounded-full h-16 px-10 gap-3 shadow-2xl shadow-primary/20" onClick={handleSubmit((v) => onSave(v, 'review'))}>
                Kirim untuk Review
                <Send size={20} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
