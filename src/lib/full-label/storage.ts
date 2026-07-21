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

export async function readLabelSectionsFromShard(
  objectKey: string,
  labelId: string,
  expectedSectionCount: number,
): Promise<FullLabelSection[]> {
  const { client, bucket } = getObjectStorageConfig()
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }))

  if (!response.Body) throw new Error('R2 returned an empty object body.')

  const source = Readable.from(response.Body as AsyncIterable<Uint8Array>)
  const gunzip = createGunzip()
  source.pipe(gunzip)
  const lines = readline.createInterface({ input: gunzip, crlfDelay: Infinity })
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
