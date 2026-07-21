import { NextResponse } from 'next/server'
import { getActiveProfile } from '@/lib/auth/server'
import { queryNeon } from '@/lib/neon/server'
import { readLabelSectionsFromShard } from '@/lib/full-label/storage'

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
  if (preview && !(await getActiveProfile())) {
    return NextResponse.json({ error: 'Akses reviewer diperlukan untuk preview.' }, { status: 403 })
  }

  const rows = await queryNeon<LabelRouteRow>(`
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
      s.storage_status
    from public.pb_fl32_label_documents d
    join public.pb_fl32_label_section_manifests m using (label_id)
    join public.pb_fl32_object_shards s on s.shard_number = m.object_shard
    where d.label_id = $1
      and s.storage_status in ('uploaded', 'verified')
      and (
        ($2::boolean and d.editorial_status = 'source_only' and d.public_status = 'hidden' and d.publication_eligible = false)
        or
        (not $2::boolean and d.editorial_status = 'published' and d.public_status = 'published' and d.publication_eligible = true)
      )
    limit 1
  `, [labelId, preview])

  const label = rows[0]
  if (!label) {
    return NextResponse.json({ error: 'Label tidak ditemukan atau belum tersedia.' }, { status: 404 })
  }

  try {
    const sections = await readLabelSectionsFromShard(label.object_key, label.label_id, label.section_count)
    if (sections.length !== label.section_count) {
      return NextResponse.json({
        error: 'Isi shard belum lengkap.',
        expected_sections: label.section_count,
        found_sections: sections.length,
      }, { status: 502 })
    }

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
        sections,
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
    return NextResponse.json({ error: 'Label sedang tidak dapat dimuat.' }, { status: 502 })
  }
}
