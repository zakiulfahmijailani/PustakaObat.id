import { isNeonConfigured, queryNeon } from '@/lib/neon/server'
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

function unavailable<T>(fallback: T) {
  return { ...fallback, error: new Error('Neon is not configured. Set DATABASE_URL on the server.') }
}

export async function getPublicWhoMedicines(filters: PublicMedicineFilters) {
  const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1)
  if (!isNeonConfigured()) return unavailable({ medicines: [] as WhoMedicine[], count: 0, page })

  try {
    const conditions = ["is_active = true", "publication_status = 'published'"]
    const parameters: unknown[] = []
    const normalizedQuery = normalizeWhoSearchQuery(filters.q)
    if (normalizedQuery) {
      parameters.push(`%${normalizedQuery}%`)
      conditions.push(`normalized_name ilike $${parameters.length}`)
    }
    if (filters.aware) {
      parameters.push(filters.aware)
      conditions.push(`aware_category = $${parameters.length}`)
    }
    if (filters.essential === 'true') conditions.push('is_who_eeml = true')

    const where = conditions.join(' and ')
    const countRows = await queryNeon<{ count: string }>(
      `select count(*)::text as count from public.who_medicines where ${where}`,
      parameters,
    )
    parameters.push(WHO_PAGE_SIZE, (page - 1) * WHO_PAGE_SIZE)
    const medicines = await queryNeon<WhoMedicine>(
      `select * from public.who_medicines where ${where} order by medicine_name asc limit $${parameters.length - 1} offset $${parameters.length}`,
      parameters,
    )
    return { medicines, count: Number(countRows[0]?.count || 0), page, error: null }
  } catch (error) {
    return { medicines: [] as WhoMedicine[], count: 0, page, error }
  }
}

export async function getPublicWhoMedicineBySlug(slug: string) {
  if (!isNeonConfigured()) return unavailable({ medicine: null as WhoMedicine | null })
  try {
    const rows = await queryNeon<WhoMedicine>(
      "select * from public.who_medicines where slug = $1 and is_active = true and publication_status = 'published' limit 1",
      [slug],
    )
    return { medicine: rows[0] || null, error: null }
  } catch (error) {
    return { medicine: null, error }
  }
}

export async function getPublicLocalDrugBySlug(slug: string) {
  if (!isNeonConfigured()) return null
  try {
    const drugs = await queryNeon<Drug>('select * from public.drugs where slug = $1 and status = $2 limit 1', [slug, 'published'])
    if (!drugs[0]) return null
    const sections = await queryNeon<DrugMonographSection>(
      'select * from public.drug_monograph_sections where drug_id = $1 order by created_at',
      [drugs[0].id],
    )
    return { ...drugs[0], sections }
  } catch {
    return null
  }
}

export async function getStaffWhoMedicines(filters: PublicMedicineFilters & { status?: string }) {
  const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1)
  if (!isNeonConfigured()) return unavailable({ medicines: [] as WhoMedicine[], count: 0, page })

  try {
    const conditions: string[] = []
    const parameters: unknown[] = []
    const normalizedQuery = normalizeWhoSearchQuery(filters.q)
    if (normalizedQuery) {
      parameters.push(`%${normalizedQuery}%`)
      conditions.push(`normalized_name ilike $${parameters.length}`)
    }
    if (filters.status) {
      parameters.push(filters.status)
      conditions.push(`verification_status = $${parameters.length}`)
    }
    if (filters.aware) {
      parameters.push(filters.aware)
      conditions.push(`aware_category = $${parameters.length}`)
    }

    const where = conditions.length ? `where ${conditions.join(' and ')}` : ''
    const countRows = await queryNeon<{ count: string }>(
      `select count(*)::text as count from public.who_medicines ${where}`,
      parameters,
    )
    parameters.push(WHO_PAGE_SIZE, (page - 1) * WHO_PAGE_SIZE)
    const medicines = await queryNeon<WhoMedicine>(
      `select * from public.who_medicines ${where} order by updated_at desc limit $${parameters.length - 1} offset $${parameters.length}`,
      parameters,
    )
    return { medicines, count: Number(countRows[0]?.count || 0), page, error: null }
  } catch (error) {
    return { medicines: [] as WhoMedicine[], count: 0, page, error }
  }
}

export async function getWhoMedicineForStaff(id: string) {
  if (!isNeonConfigured()) return unavailable({ medicine: null as WhoMedicine | null, history: [] as WhoMedicineVerification[] })
  try {
    const [medicineRows, history] = await Promise.all([
      queryNeon<WhoMedicine>('select * from public.who_medicines where id = $1 limit 1', [id]),
      queryNeon<WhoMedicineVerification>(
        'select * from public.who_medicine_verifications where medicine_id = $1 order by created_at desc',
        [id],
      ),
    ])
    return { medicine: medicineRows[0] || null, history, error: null }
  } catch (error) {
    return { medicine: null, history: [] as WhoMedicineVerification[], error }
  }
}

export async function getWhoImportRuns() {
  if (!isNeonConfigured()) return unavailable({ runs: [] as WhoImportRun[] })
  try {
    const runs = await queryNeon<WhoImportRun>('select * from public.who_import_runs order by imported_at desc limit 20')
    return { runs, error: null }
  } catch (error) {
    return { runs: [] as WhoImportRun[], error }
  }
}
