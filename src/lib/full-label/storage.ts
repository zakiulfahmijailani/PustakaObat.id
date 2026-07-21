import 'server-only'

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
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

interface ObjectStorageConfig {
  client: S3Client
  bucket: string
}

interface PrivateReaderConfig {
  url: string
  token: string
}

let storageConfig: ObjectStorageConfig | null = null

function getObjectStorageConfig(): ObjectStorageConfig {
  if (storageConfig) return storageConfig

  const endpoint = process.env.PUSTAKAOBAT_OBJECT_ENDPOINT
  const bucket = process.env.PUSTAKAOBAT_OBJECT_BUCKET
  const accessKeyId = process.env.PUSTAKAOBAT_OBJECT_ACCESS_KEY_ID
  const secretAccessKey = process.env.PUSTAKAOBAT_OBJECT_SECRET_ACCESS_KEY

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('PustakaObat object storage is not configured.')
  }

  storageConfig = {
    bucket,
    client: new S3Client({
      endpoint,
      region: process.env.PUSTAKAOBAT_OBJECT_REGION || 'auto',
      forcePathStyle: process.env.PUSTAKAOBAT_OBJECT_FORCE_PATH_STYLE === 'true',
      credentials: { accessKeyId, secretAccessKey },
    }),
  }

  return storageConfig
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

  if (privateReader) {
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

  const { client, bucket } = getObjectStorageConfig()
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }))

  if (!response.Body) throw new Error('R2 returned an empty object body.')

  return readMatchingSections(
    Readable.from(response.Body as AsyncIterable<Uint8Array>),
    labelId,
    expectedSectionCount,
  )
}
