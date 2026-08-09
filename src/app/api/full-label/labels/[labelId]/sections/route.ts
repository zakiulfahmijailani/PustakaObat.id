import { NextResponse } from 'next/server'
import { getActiveProfile } from '@/lib/auth/server'
import { queryFullLabelNeon } from '@/lib/full-label/database'
import { readLabelSectionsFromObject, readLabelSectionsFromShard, readTranslationsFromOverlay, type IndonesianTranslation, type TranslationOverlayConfig } from '@/lib/full-label/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface LabelRouteRow {
  label_id: string
  spl_document_id: string | null
  spl_set_id: string | null
  effective_time: string | null
  display_names: unknown
  ingredient_count: number
  ingredient_fingerprint: string
  is_human_label: boolean
  editorial_status: string
  public_status: string
  publication_eligible: boolean
  section_count: number
  object_shard: number
  object_key: string
  storage_status: string
  label_object_storage_status: string | null
}

interface TranslationOverlayRow extends TranslationOverlayConfig {
  import_id: string
}

export async function GET(
  request: Request,
  context: { params: Promise<{ labelId: string }> },
) {
  const { labelId } = await context.params
  if (!labelId || labelId.length > 300) {
    return NextResponse.json({ error: 'Label ID tidak valid.' }, { status: 400 })
  }

  const preview = new URL(request.url).searchParams.get('preview') === '1'
  const requestedSectionTypes = new URL(request.url).searchParams.getAll('sectionType')
  if (requestedSectionTypes.length > 20 || requestedSectionTypes.some((type) => !/^[a-z0-9_]+$/.test(type))) {
    return NextResponse.json({ error: 'Filter seksi label tidak valid.' }, { status: 400 })
  }
  if (preview && !(await getActiveProfile())) {
    return NextResponse.json({ error: 'Akses reviewer diperlukan untuk preview.' }, { status: 403 })
  }

  let rows: LabelRouteRow[]
  try {
    rows = await queryFullLabelNeon<LabelRouteRow>(`
    select
      d.label_id,
      d.spl_document_id,
      d.spl_set_id,
      d.effective_time,
      d.display_names,
      d.ingredient_count,
      d.ingredient_fingerprint,
      d.is_human_label,
      d.editorial_status,
      d.public_status,
      d.publication_eligible,
      m.section_count,
      m.object_shard,
      s.object_key,
      s.storage_status,
      o.storage_status as label_object_storage_status
    from public.pb_fl32_label_documents d
    join public.pb_fl32_label_section_manifests m using (label_id)
    join public.pb_fl32_object_shards s on s.shard_number = m.object_shard
    left join public.pb_fl32_label_objects o using (label_id)
    where d.label_id = $1
      and s.storage_status in ('uploaded', 'verified')
      and (
        ($2::boolean and d.editorial_status = 'source_only' and d.public_status = 'hidden' and d.publication_eligible = false)
        or
        (not $2::boolean and d.editorial_status = 'published' and d.public_status = 'published' and d.publication_eligible = true)
      )
    limit 1
    `, [labelId, preview])
  } catch (error) {
    console.error('Full-label metadata query failed', { labelId, error })
    return NextResponse.json({ error: 'Metadata full-label belum tersedia pada database yang terhubung.' }, { status: 503 })
  }

  const label = rows[0]
  if (!label) {
    return NextResponse.json({ error: 'Label tidak ditemukan atau belum tersedia.' }, { status: 404 })
  }

  try {
    let sections
    if (label.label_object_storage_status === 'verified') {
      try {
        sections = await readLabelSectionsFromObject(label.label_id, label.section_count)
      } catch (labelObjectError) {
        // A materialized object is an optimization, never a single point of
        // failure. Keep the reviewer page available while an object is being
        // retried or a storage edge is temporarily unavailable.
        console.error('Materialized label object read failed; falling back to source shard', {
          labelId,
          error: labelObjectError,
        })
        sections = await readLabelSectionsFromShard(label.object_key, label.label_id, label.section_count)
      }
    } else {
      sections = await readLabelSectionsFromShard(label.object_key, label.label_id, label.section_count)
    }
    if (sections.length !== label.section_count) {
      return NextResponse.json({
        error: 'Isi shard belum lengkap.',
        expected_sections: label.section_count,
        found_sections: sections.length,
      }, { status: 502 })
    }

    const filteredSections = requestedSectionTypes.length
      ? sections.filter((section) => requestedSectionTypes.includes(section.section_type))
      : sections

    let translationOverlayState: 'available' | 'not_imported' | 'unavailable' = 'not_imported'
    let translatedByHash = new Map<string, IndonesianTranslation>()
    // AI translation is a private reviewer aid. It is deliberately never
    // joined into the public response, even if the source label is published.
    if (preview) {
      try {
        const overlays = await queryFullLabelNeon<TranslationOverlayRow>(`
          select import_id::text, object_prefix, prefix_length
          from public.pb_fl32_translation_imports
          where status='verified'
            and editorial_status='ai_translated'
            and public_status='hidden'
            and publication_eligible=false
          order by verified_at desc nulls last, imported_at desc
          limit 1
        `)
        const overlay = overlays[0]
        if (overlay) {
          translatedByHash = await readTranslationsFromOverlay(
            overlay,
            filteredSections
              .map((section) => section.source_text_sha256 || '')
              .filter(Boolean),
          )
          translationOverlayState = 'available'
        }
      } catch (translationError) {
        console.error('Private translation overlay read failed', { labelId, translationError })
        translationOverlayState = 'unavailable'
      }
    }

    const reviewerSections = filteredSections.map((section) => {
      const translation = section.source_text_sha256
        ? translatedByHash.get(section.source_text_sha256.toLowerCase())
        : undefined
      return {
        ...section,
        indonesian_draft: preview ? translation?.content_indonesian || null : null,
        translation_status: preview ? translation?.translation_status || section.translation_status : section.translation_status,
        translation_quality_flags_json: preview ? translation?.quality_flags_json || '[]' : '[]',
      }
    })

    return NextResponse.json({
      label: {
        label_id: label.label_id,
        spl_document_id: label.spl_document_id,
        spl_set_id: label.spl_set_id,
        effective_time: label.effective_time,
        display_names: label.display_names,
        ingredient_count: label.ingredient_count,
        ingredient_fingerprint: label.ingredient_fingerprint,
        is_human_label: label.is_human_label,
        editorial_status: label.editorial_status,
        public_status: label.public_status,
        publication_eligible: label.publication_eligible,
        translation_overlay_state: preview ? translationOverlayState : undefined,
        sections: reviewerSections,
      },
    }, {
      headers: preview
        ? { 'Cache-Control': 'private, no-store' }
        : { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
    })
  } catch (error) {
    console.error('Full-label shard read failed', {
      labelId,
      objectKey: label.object_key,
      error,
    })
    return NextResponse.json({
      error: 'Label sedang tidak dapat dimuat.',
      ...(preview
        ? {
            detail: error instanceof Error ? error.message : String(error),
            reader_transport: 'private_worker_only',
            reader_url_configured: Boolean(process.env.PUSTAKAOBAT_OBJECT_READER_URL),
            reader_token_configured: Boolean(process.env.PUSTAKAOBAT_OBJECT_READER_TOKEN),
          }
        : {}),
    }, {
      status: 502,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }
}
