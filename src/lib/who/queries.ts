import { createClient } from '@/lib/supabase/server'
import { WHO_PAGE_SIZE } from './constants'
import type { Drug, DrugMonographSection, WhoImportRun, WhoMedicine, WhoMedicineVerification } from '@/types'

export function normalizeWhoSearchQuery(value: string | undefined) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[µμ]/g, 'u')
    .replace(/[^a-z0-9+./ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function displayMedicineName(medicine: Pick<WhoMedicine, 'medicine_name' | 'editorial_name'>) {
  return medicine.editorial_name || medicine.medicine_name
}

export interface PublicMedicineFilters {
  q?: string
  aware?: string
  essential?: string
  page?: string
}

export async function getPublicWhoMedicines(filters: PublicMedicineFilters) {
  const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { medicines: [] as WhoMedicine[], count: 0, page, error: new Error('Supabase is not configured') }
  }
  const supabase = await createClient()
  const from = (page - 1) * WHO_PAGE_SIZE
  const to = from + WHO_PAGE_SIZE - 1
  let query = supabase
    .from('who_medicines')
    .select('*', { count: 'exact' })
    .order('medicine_name', { ascending: true })
    .range(from, to)

  const normalizedQuery = normalizeWhoSearchQuery(filters.q)
  if (normalizedQuery) query = query.ilike('normalized_name', `%${normalizedQuery}%`)
  if (filters.aware) query = query.eq('aware_category', filters.aware as WhoMedicine['aware_category'])
  if (filters.essential === 'true') query = query.eq('is_who_eeml', true)

  const { data, count, error } = await query
  return { medicines: (data || []) as WhoMedicine[], count: count || 0, page, error }
}

export async function getPublicWhoMedicineBySlug(slug: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { medicine: null, error: new Error('Supabase is not configured') }
  }
  const supabase = await createClient()
  const { data, error } = await supabase.from('who_medicines').select('*').eq('slug', slug).single()
  return { medicine: data as WhoMedicine | null, error }
}

export async function getPublicLocalDrugBySlug(slug: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('drugs')
    .select('*, sections:drug_monograph_sections(*)')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()
  return data as (Drug & { sections: DrugMonographSection[] }) | null
}

export async function getStaffWhoMedicines(filters: PublicMedicineFilters & { status?: string }) {
  const supabase = await createClient()
  const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1)
  const from = (page - 1) * WHO_PAGE_SIZE
  const to = from + WHO_PAGE_SIZE - 1
  let query = supabase
    .from('who_medicines')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, to)

  const normalizedQuery = normalizeWhoSearchQuery(filters.q)
  if (normalizedQuery) query = query.ilike('normalized_name', `%${normalizedQuery}%`)
  if (filters.status) query = query.eq('verification_status', filters.status as WhoMedicine['verification_status'])
  if (filters.aware) query = query.eq('aware_category', filters.aware as WhoMedicine['aware_category'])

  const { data, count, error } = await query
  return { medicines: (data || []) as WhoMedicine[], count: count || 0, page, error }
}

export async function getWhoMedicineForStaff(id: string) {
  const supabase = await createClient()
  const [{ data: medicine, error }, { data: history }] = await Promise.all([
    supabase.from('who_medicines').select('*').eq('id', id).single(),
    supabase.from('who_medicine_verifications').select('*').eq('medicine_id', id).order('created_at', { ascending: false }),
  ])
  return {
    medicine: medicine as WhoMedicine | null,
    history: (history || []) as WhoMedicineVerification[],
    error,
  }
}

export async function getWhoImportRuns() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('who_import_runs').select('*').order('imported_at', { ascending: false }).limit(20)
  return { runs: (data || []) as WhoImportRun[], error }
}
