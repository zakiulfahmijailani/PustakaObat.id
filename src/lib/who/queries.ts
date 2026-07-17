import { isNeonConfigured, queryNeon } from '@/lib/neon/server'
import { WHO_PAGE_SIZE } from './constants'
import type { WhoImportRun, WhoMedicine, WhoMedicineVerification } from '@/types'

export interface PublicMonographSummary {
  id: string
  name: string
  generic_name: string | null
  display_name: string
  slug: string
  brand_names: string[]
  drug_class: string | null
  dosage_form: string | null
  strength: string | null
  bpom_reg_number: string | null
  atc_code: string | null
  summary: string | null
  published_at: string | null
  updated_at: string
  reviewer_name: string | null
  reviewer_license: string | null
  reviewed_at: string | null
}

export interface PublicMonographSection {
  id: string
  section_type: string
  content: string
  approved_at: string | null
}

export interface PublicMonographSource {
  source_name: string
  source_document_id: string
  source_url: string | null
}

export interface PublicMonograph extends PublicMonographSummary {
  sections: PublicMonographSection[]
  sources: PublicMonographSource[]
}

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
    const conditions = [
      "is_active = true",
      "publication_status = 'published'",
      "(drug_id is null or not exists (select 1 from public.drugs d where d.id = who_medicines.drug_id and d.status = 'published'))",
      "normalized_name <> 'aware group'",
    ]
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
      "select * from public.who_medicines where slug = $1 and is_active = true and publication_status = 'published' and normalized_name <> 'aware group' limit 1",
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
    const drugs = await queryNeon<PublicMonographSummary>(
      `select
        d.id,
        d.name,
        d.generic_name,
        coalesce(nullif(d.generic_name, ''), d.name) as display_name,
        trim(both '-' from regexp_replace(lower(coalesce(nullif(d.generic_name, ''), d.name)), '[^a-z0-9]+', '-', 'g')) as slug,
        coalesce(d.brand_names, '{}'::text[]) as brand_names,
        d.category as drug_class,
        d.dosage_form,
        d.strength,
        d.bpom_reg_number,
        d.atc_code,
        left(indication.content, 320) as summary,
        d.published_at,
        d.updated_at,
        reviewer.full_name as reviewer_name,
        coalesce(reviewer.sipa_number, reviewer.professional_license_number) as reviewer_license,
        latest_review.reviewed_at
      from public.drugs d
      left join lateral (
        select content
        from public.drug_monograph_sections
        where drug_id = d.id and section_type = 'indication' and status = 'published'
        order by approved_at desc nulls last, updated_at desc
        limit 1
      ) indication on true
      left join lateral (
        select approved_by, approved_at as reviewed_at
        from public.drug_monograph_sections
        where drug_id = d.id and status = 'published' and approved_by is not null
        order by approved_at desc nulls last, updated_at desc
        limit 1
      ) latest_review on true
      left join public.profiles reviewer on reviewer.id = latest_review.approved_by
      where d.status = 'published'
        and trim(both '-' from regexp_replace(lower(coalesce(nullif(d.generic_name, ''), d.name)), '[^a-z0-9]+', '-', 'g')) = $1
      limit 1`,
      [slug],
    )
    if (!drugs[0]) return null
    const [sections, sources] = await Promise.all([
      queryNeon<PublicMonographSection>(
        `select id, section_type::text, content, approved_at
         from public.drug_monograph_sections
         where drug_id = $1 and status = 'published'
         order by case section_type::text
           when 'indication' then 1
           when 'dosage' then 2
           when 'contraindication' then 3
           when 'warnings' then 4
           when 'side_effects' then 5
           when 'drug_interactions' then 6
           when 'pregnancy' then 7
           when 'specific_populations' then 8
           when 'mechanism_of_action' then 9
           when 'mechanism' then 9
           when 'clinical_pharmacology' then 10
           when 'pharmacokinetics' then 11
           when 'how_supplied' then 12
           when 'storage' then 13
           else 99 end, created_at`,
        [drugs[0].id],
      ),
      queryNeon<PublicMonographSource>(
        `select distinct s.source_name, s.source_document_id, s.source_url
         from public.monograph_publications p
         join public.monograph_publication_sources s on s.publication_id = p.id
         where p.drug_id = $1
         order by s.source_name, s.source_document_id`,
        [drugs[0].id],
      ),
    ])
    return { ...drugs[0], sections, sources } satisfies PublicMonograph
  } catch {
    return null
  }
}

export async function getPublicLocalDrugs(searchQuery?: string) {
  if (!isNeonConfigured()) return [] as PublicMonographSummary[]
  try {
    const normalizedQuery = normalizeWhoSearchQuery(searchQuery)
    const parameters: unknown[] = []
    const searchCondition = normalizedQuery
      ? `and lower(concat_ws(' ', d.name, d.generic_name, array_to_string(d.brand_names, ' '))) like $1`
      : ''
    if (normalizedQuery) parameters.push(`%${normalizedQuery}%`)

    return await queryNeon<PublicMonographSummary>(
      `select
        d.id,
        d.name,
        d.generic_name,
        coalesce(nullif(d.generic_name, ''), d.name) as display_name,
        trim(both '-' from regexp_replace(lower(coalesce(nullif(d.generic_name, ''), d.name)), '[^a-z0-9]+', '-', 'g')) as slug,
        coalesce(d.brand_names, '{}'::text[]) as brand_names,
        d.category as drug_class,
        d.dosage_form,
        d.strength,
        d.bpom_reg_number,
        d.atc_code,
        left(indication.content, 320) as summary,
        d.published_at,
        d.updated_at,
        reviewer.full_name as reviewer_name,
        coalesce(reviewer.sipa_number, reviewer.professional_license_number) as reviewer_license,
        latest_review.reviewed_at
      from public.drugs d
      left join lateral (
        select content
        from public.drug_monograph_sections
        where drug_id = d.id and section_type = 'indication' and status = 'published'
        order by approved_at desc nulls last, updated_at desc
        limit 1
      ) indication on true
      left join lateral (
        select approved_by, approved_at as reviewed_at
        from public.drug_monograph_sections
        where drug_id = d.id and status = 'published' and approved_by is not null
        order by approved_at desc nulls last, updated_at desc
        limit 1
      ) latest_review on true
      left join public.profiles reviewer on reviewer.id = latest_review.approved_by
      where d.status = 'published' ${searchCondition}
      order by display_name asc
      limit 100`,
      parameters,
    )
  } catch {
    return [] as PublicMonographSummary[]
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
