import 'server-only'

import { Readable } from 'node:stream'
import { createGunzip } from 'node:zlib'
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

interface PrivateReaderConfig {
  url: string
  token: string
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

export async function readLabelSectionsFromShard(
  objectKey: string,
  labelId: string,
  expectedSectionCount: number,
): Promise<FullLabelSection[]> {
  const privateReader = getPrivateReaderConfig()

  if (!privateReader) {
    // The direct S3-compatible endpoint is deliberately not used here. It
    // fails its TLS handshake from the deployed application, while the
    // private Worker binding reads the same R2 bucket without exposing it.
    throw new Error('Private full-label reader is not configured.')
  }

  const response = await fetch(
    `${privateReader.url}/objects/${encodeURIComponent(objectKey)}`,
    {
      headers: { Authorization: `Bearer ${privateReader.token}` },
      cache: 'no-store',
    },
  )

  if (!response.ok || !response.body) {
    throw new Error(`Private R2 reader returned HTTP ${response.status}.`)
  }

  return readMatchingSections(
    Readable.fromWeb(response.body as never),
    labelId,
    expectedSectionCount,
  )
}
