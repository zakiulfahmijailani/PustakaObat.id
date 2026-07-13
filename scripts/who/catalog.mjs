import { createHash } from 'node:crypto'

export const AWARE_CATEGORIES = ['Access', 'Watch', 'Reserve', 'Not recommended']
export const SCHEMA_VERSION = '1.0.0'

function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalStringify(value), 'utf8').digest('hex')
}

export function normalizeMedicineName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[µμ]/g, 'u')
    .replace(/[^a-z0-9+./ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function slugifyMedicineName(value) {
  return normalizeMedicineName(value)
    .replace(/[+./]+/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

export function normalizeAwareCategories(value) {
  let categories = value
  if (typeof categories === 'string') {
    const trimmed = categories.trim()
    if (!trimmed) return []
    try {
      categories = JSON.parse(trimmed)
    } catch {
      categories = [trimmed]
    }
  }
  if (!Array.isArray(categories)) categories = categories ? [categories] : []
  const normalized = [...new Set(categories.map((item) => String(item).trim()).filter(Boolean))]
  const unsupported = normalized.filter((category) => !AWARE_CATEGORIES.includes(category))
  if (unsupported.length) throw new Error(`Unsupported AWaRe category: ${unsupported.join(', ')}`)
  return normalized
}

function asBoolean(value) {
  if (typeof value === 'boolean') return value
  return ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase())
}

function asNullableString(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function sourceKeyFor(record, normalizedName) {
  const externalId = asNullableString(record.medicine_id)
  return externalId ? `who-eeml:${externalId}` : `who-name:${sha256(`WHO|${normalizedName}`).slice(0, 24)}`
}

function isGenericAwarePlaceholder(record, categories) {
  const name = normalizeMedicineName(record.medicine_name)
  return categories.length > 1 || /^(first|second) choice$/.test(name)
}

export function prepareWhoCatalog(rawRecords) {
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    throw new Error('WHO catalog must be a non-empty JSON array')
  }

  const prepared = []
  const skipped = []
  const failed = []

  rawRecords.forEach((raw, index) => {
    try {
      if (!raw || typeof raw !== 'object') throw new Error('Record must be an object')
      const medicineName = String(raw.medicine_name ?? '').replace(/\s+/g, ' ').trim()
      const normalizedName = normalizeMedicineName(raw.medicine_name_normalized || medicineName)
      if (!medicineName || !normalizedName) throw new Error('Medicine name is required')
      if (raw.source_name && raw.source_name !== 'WHO') throw new Error('source_name must be WHO')

      const categories = normalizeAwareCategories(raw.aware_category)
      if (isGenericAwarePlaceholder(raw, categories)) {
        skipped.push({ index, medicine_name: medicineName, reason: 'ambiguous AWaRe navigation label' })
        return
      }

      const isWhoEeml = asBoolean(raw.is_who_eeml)
      const dataStatus = String(raw.data_status || (isWhoEeml ? (categories.length ? 'WHO_AND_AWARE' : 'WHO_ONLY') : 'AWARE_ONLY'))
      if (!['WHO_ONLY', 'WHO_AND_AWARE', 'AWARE_ONLY'].includes(dataStatus)) {
        throw new Error(`Unsupported data_status: ${dataStatus}`)
      }

      const sourceKey = sourceKeyFor(raw, normalizedName)
      const sourcePayload = { ...raw, aware_category: categories }
      const record = {
        source_key: sourceKey,
        external_id: asNullableString(raw.medicine_id),
        medicine_name: medicineName,
        normalized_name: normalizedName,
        slug: slugifyMedicineName(medicineName),
        official_source_url: asNullableString(raw.official_source_url),
        is_who_eeml: isWhoEeml,
        aware_category: categories[0] ?? null,
        is_monitoring_only: asBoolean(raw.is_monitoring_only),
        is_not_on_eml: asBoolean(raw.is_not_on_eml),
        data_status: dataStatus,
        import_status: String(raw.import_status || 'ready'),
        source_retrieved_at: asNullableString(raw.retrieved_at),
        source_payload: sourcePayload,
      }
      record.payload_checksum = sha256(record)
      prepared.push(record)
    } catch (error) {
      failed.push({ index, medicine_name: String(raw?.medicine_name ?? ''), reason: error instanceof Error ? error.message : String(error) })
    }
  })

  if (failed.length) {
    throw new Error(`WHO catalog has ${failed.length} invalid record(s): ${failed.slice(0, 3).map((item) => `#${item.index} ${item.reason}`).join('; ')}`)
  }

  prepared.sort((left, right) => left.source_key.localeCompare(right.source_key))
  const sourceKeys = new Set()
  const slugs = new Map()
  for (const record of prepared) {
    if (sourceKeys.has(record.source_key)) throw new Error(`Duplicate WHO source key: ${record.source_key}`)
    sourceKeys.add(record.source_key)

    const baseSlug = record.slug || `medicine-${sha256(record.source_key).slice(0, 12)}`
    const previous = slugs.get(baseSlug)
    if (previous && previous !== record.source_key) record.slug = `${baseSlug}-${sha256(record.source_key).slice(0, 8)}`
    else record.slug = baseSlug
    slugs.set(record.slug, record.source_key)
  }

  return {
    schema_version: SCHEMA_VERSION,
    dataset_checksum: sha256(prepared),
    records: prepared,
    skipped,
    failed,
  }
}
