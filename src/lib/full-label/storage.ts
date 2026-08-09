import 'server-only'

import { Readable } from 'node:stream'
import { createGunzip } from 'node:zlib'
import { createHash } from 'node:crypto'
import * as readline from 'node:readline'

export interface FullLabelSection {
  section_id: string
  label_id: string
  section_type: string
  section_title_en: string | null
  section_title_id: string | null
  field_value_json: string | null
  source_text: string | null
  source_character_count: number
  source_text_sha256: string | null
  source_file: string | null
  source_language: string | null
  translation_status: string | null
  indonesian_draft: string | null
  editorial_status: string
  public_status: string
  publication_eligible: boolean
  object_shard: number
  section_group: string | null
}

export interface IndonesianTranslation {
  content_indonesian: string
  translation_status: 'AI_TRANSLATED_UNREVIEWED'
  quality_flags_json: string
  source_character_count: number
  translation_character_count: number
}

export interface TranslationOverlayConfig {
  object_prefix: string
  prefix_length: number
}

interface PrivateReaderConfig {
  url: string
  token: string
}

const SECTION_CACHE_TTL_MS = 10 * 60 * 1000
const SECTION_CACHE_LIMIT = 32
const sectionCache = new Map<string, { expiresAt: number; sections: FullLabelSection[] }>()

function getCachedSections(cacheKey: string) {
  const cached = sectionCache.get(cacheKey)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    sectionCache.delete(cacheKey)
    return null
  }
  sectionCache.delete(cacheKey)
  sectionCache.set(cacheKey, cached)
  return cached.sections
}

function cacheSections(cacheKey: string, sections: FullLabelSection[]) {
  sectionCache.set(cacheKey, { expiresAt: Date.now() + SECTION_CACHE_TTL_MS, sections })
  while (sectionCache.size > SECTION_CACHE_LIMIT) {
    const oldestKey = sectionCache.keys().next().value
    if (!oldestKey) break
    sectionCache.delete(oldestKey)
  }
}

function getPrivateReaderConfig(): PrivateReaderConfig | null {
  const url = process.env.PUSTAKAOBAT_OBJECT_READER_URL?.replace(/\/$/, '')
  const token = process.env.PUSTAKAOBAT_OBJECT_READER_TOKEN

  if (!url || !token) {
    console.warn('Full-label private reader is not configured.', {
      urlConfigured: Boolean(url),
      tokenConfigured: Boolean(token),
    })
    return null
  }

  return { url, token }
}

function createLineReader(source: Readable) {
  const gunzip = createGunzip()
  source.pipe(gunzip)

  return {
    gunzip,
    lines: readline.createInterface({ input: gunzip, crlfDelay: Infinity }),
  }
}

async function readMatchingSections(
  source: Readable,
  labelId: string,
  expectedSectionCount: number,
): Promise<FullLabelSection[]> {
  const { gunzip, lines } = createLineReader(source)
  const sections: FullLabelSection[] = []

  try {
    for await (const line of lines) {
      if (!line.trim()) continue

      const record = JSON.parse(line) as FullLabelSection
      if (record.label_id !== labelId) continue

      sections.push(record)
      if (sections.length >= expectedSectionCount) break
    }
  } finally {
    lines.close()
    source.destroy()
    gunzip.destroy()
  }

  return sections
}

async function readMatchingTranslations(
  source: Readable,
  expectedHashes: Set<string>,
): Promise<Map<string, IndonesianTranslation>> {
  const { gunzip, lines } = createLineReader(source)
  const translations = new Map<string, IndonesianTranslation>()

  try {
    for await (const line of lines) {
      if (!line.trim()) continue
      const record = JSON.parse(line) as {
        source_text_sha256?: string
        content_indonesian?: string
        translation_status?: string
        quality_flags_json?: string
        source_character_count?: number
        translation_character_count?: number
      }
      const sourceHash = record.source_text_sha256?.toLowerCase() || ''
      if (!expectedHashes.has(sourceHash)) continue
      if (
        record.translation_status !== 'AI_TRANSLATED_UNREVIEWED'
        || !record.content_indonesian?.trim()
      ) {
        throw new Error(`Unsafe translation overlay record for ${sourceHash}.`)
      }
      translations.set(sourceHash, {
        content_indonesian: record.content_indonesian,
        translation_status: 'AI_TRANSLATED_UNREVIEWED',
        quality_flags_json: record.quality_flags_json || '[]',
        source_character_count: Number(record.source_character_count || 0),
        translation_character_count: Number(record.translation_character_count || record.content_indonesian.length),
      })
    }
  } finally {
    lines.close()
    source.destroy()
    gunzip.destroy()
  }

  return translations
}

async function readPrivateObject(objectKey: string): Promise<Readable> {
  const privateReader = getPrivateReaderConfig()
  if (!privateReader) throw new Error('Private full-label reader is not configured.')

  // The Worker routes objects by path segments. Encoding the complete key turns
  // every slash into %2F, which works for flat source shards but makes nested
  // translation-overlay keys fail validation before R2 is reached.
  const encodedObjectPath = objectKey.split('/').map(encodeURIComponent).join('/')

  const response = await fetch(
    `${privateReader.url}/objects/${encodedObjectPath}`,
    {
      headers: { Authorization: `Bearer ${privateReader.token}` },
      cache: 'no-store',
    },
  )
  if (!response.ok || !response.body) {
    throw new Error(`Private R2 reader returned HTTP ${response.status}.`)
  }
  return Readable.fromWeb(response.body as never)
}

export async function readLabelSectionsFromShard(
  objectKey: string,
  labelId: string,
  expectedSectionCount: number,
): Promise<FullLabelSection[]> {
  // The direct S3-compatible endpoint is deliberately not used here. It
  // fails its TLS handshake from the deployed application, while the private
  // Worker binding reads the same R2 bucket without exposing it.
  const cacheKey = `${objectKey}\u0000${labelId}\u0000${expectedSectionCount}`
  const cached = getCachedSections(cacheKey)
  if (cached) return cached

  const sections = await readMatchingSections(await readPrivateObject(objectKey), labelId, expectedSectionCount)
  if (sections.length === expectedSectionCount) cacheSections(cacheKey, sections)
  return sections
}

function labelObjectKey(labelId: string) {
  const digest = createHash('sha256').update(labelId, 'utf8').digest('hex')
  return `pustakaobat/full-label/v3.2/labels/${digest.slice(0, 2)}/${digest}.json.gz`
}

export async function readLabelSectionsFromObject(
  labelId: string,
  expectedSectionCount: number,
): Promise<FullLabelSection[]> {
  const cacheKey = `label-object\u0000${labelId}\u0000${expectedSectionCount}`
  const cached = getCachedSections(cacheKey)
  if (cached) return cached

  const source = await readPrivateObject(labelObjectKey(labelId))
  const gunzip = createGunzip()
  source.pipe(gunzip)
  const chunks: Buffer[] = []
  try {
    for await (const chunk of gunzip) chunks.push(Buffer.from(chunk))
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
      schema_version?: string
      label_id?: string
      sections?: FullLabelSection[]
    }
    if (payload.schema_version !== '3.2.0' || payload.label_id !== labelId || !Array.isArray(payload.sections)) {
      throw new Error('Private label object is invalid.')
    }
    if (payload.sections.length !== expectedSectionCount || payload.sections.some((section) => section.label_id !== labelId)) {
      throw new Error('Private label object is incomplete.')
    }
    cacheSections(cacheKey, payload.sections)
    return payload.sections
  } finally {
    source.destroy()
    gunzip.destroy()
  }
}

/**
 * Retrieve only the translated strings needed for a single private reviewer
 * label. The overlay is partitioned by SHA-256 prefix, so source prose never
 * enters Neon and the browser never receives object-storage credentials.
 */
export async function readTranslationsFromOverlay(
  overlay: TranslationOverlayConfig,
  sourceHashes: string[],
): Promise<Map<string, IndonesianTranslation>> {
  if (!Number.isInteger(overlay.prefix_length) || overlay.prefix_length < 2 || overlay.prefix_length > 4) {
    throw new Error('Translation overlay prefix configuration is invalid.')
  }
  if (!/^pustakaobat\/full-label\/v3\.2\/translations\/[a-f0-9]{64}$/.test(overlay.object_prefix)) {
    throw new Error('Translation overlay object prefix is invalid.')
  }

  const hashes = new Set(
    sourceHashes
      .map((value) => value.toLowerCase())
      .filter((value) => /^[a-f0-9]{64}$/.test(value)),
  )
  if (!hashes.size) return new Map()

  const byPrefix = new Map<string, Set<string>>()
  for (const sourceHash of hashes) {
    const prefix = sourceHash.slice(0, overlay.prefix_length)
    const set = byPrefix.get(prefix) || new Set<string>()
    set.add(sourceHash)
    byPrefix.set(prefix, set)
  }

  const entries = [...byPrefix.entries()]
  const merged = new Map<string, IndonesianTranslation>()
  const concurrency = 6
  for (let offset = 0; offset < entries.length; offset += concurrency) {
    const batch = entries.slice(offset, offset + concurrency)
    const results = await Promise.all(batch.map(async ([prefix, expectedHashes]) => (
      readMatchingTranslations(
        await readPrivateObject(`${overlay.object_prefix}/${prefix}.jsonl.gz`),
        expectedHashes,
      )
    )))
    for (const result of results) {
      for (const [sourceHash, translation] of result) merged.set(sourceHash, translation)
    }
  }
  return merged
}
