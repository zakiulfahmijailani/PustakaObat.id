import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { buildDrugMonographPrompt } from '@/lib/prompts/drug-monograph'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth check — hanya pharmacist dan admin yang boleh
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['pharmacist', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Ambil drug_id dari request
    const body = await request.json()
    const { drug_id } = body

    if (!drug_id) {
      return NextResponse.json({ error: 'drug_id is required' }, { status: 400 })
    }

    // Ambil data obat dari Supabase
    const { data: drug, error: drugError } = await supabase
      .from('drugs')
      .select('*')
      .eq('id', drug_id)
      .single()

    if (drugError || !drug) {
      return NextResponse.json({ error: 'Drug not found' }, { status: 404 })
    }

    if (!['draft', 'review'].includes(drug.status)) {
      return NextResponse.json(
        { error: 'Hanya obat berstatus draft atau review yang dapat di-generate' },
        { status: 400 }
      )
    }

    // Bangun prompt
    const prompt = buildDrugMonographPrompt(drug)

    // Kirim ke OpenRouter → Gemini 2.0 Flash
    const openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'https://apoteq.vercel.app',
        'X-Title': 'Apoteq - Informasi Obat',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    })

    if (!openrouterRes.ok) {
      const errText = await openrouterRes.text()
      console.error('OpenRouter error:', errText)
      return NextResponse.json(
        { error: 'Gagal menghubungi layanan AI. Coba lagi nanti.' },
        { status: 502 }
      )
    }

    const aiData = await openrouterRes.json()
    const rawContent = aiData.choices?.[0]?.message?.content

    if (!rawContent) {
      return NextResponse.json({ error: 'AI tidak menghasilkan konten' }, { status: 500 })
    }

    let sections: Record<string, string>
    try {
      sections = JSON.parse(rawContent)
    } catch {
      return NextResponse.json(
        { error: 'Format respons AI tidak valid' },
        { status: 500 }
      )
    }

    const sectionKeys = [
      'indication',
      'dosage',
      'side_effects',
      'contraindication',
      'warnings',
      'mechanism_of_action',
      'storage',
      'pharmacokinetics',
    ]

    // Hapus seksi lama (jika ada re-generate)
    await supabase
      .from('drug_monograph_sections')
      .delete()
      .eq('drug_id', drug_id)
      .eq('status', 'draft')

    // Insert seksi baru
    const inserts = sectionKeys
      .filter((key) => sections[key])
      .map((key) => ({
        drug_id,
        section_type: key,
        content: sections[key],
        status: 'draft',
        generated_by: 'ai',
        created_by: user.id,
      }))

    const { error: insertError } = await supabase
      .from('drug_monograph_sections')
      .insert(inserts)

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json(
        { error: 'Gagal menyimpan draft ke database' },
        { status: 500 }
      )
    }

    // Log aktivitas
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'generate_draft',
      entity_type: 'drug',
      entity_id: drug_id,
      metadata: { sections_count: inserts.length, model: 'gemini-2.0-flash-exp' },
    })

    return NextResponse.json({
      success: true,
      message: `Draft berhasil digenerate: ${inserts.length} seksi`,
      sections_count: inserts.length,
      sections: inserts.map((s) => s.section_type),
    })
  } catch (error) {
    console.error('Generate draft error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
