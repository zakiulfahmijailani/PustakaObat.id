import { NextResponse } from 'next/server'
import { queryNeon } from '@/lib/neon/server'
import { reviewerOnboardingSchema } from '@/lib/auth/schemas'
import { getGoogleIdentity, linkExistingProfile } from '@/lib/auth/server'
import { getSafeRedirectForAccount } from '@/lib/auth/security'
import { getRequestMetadata, isSameOriginMutation } from '@/lib/auth/request'
import { CURRENT_TERMS_VERSION } from '@/lib/legal/terms'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const identity = await getGoogleIdentity()
  if (!identity) return NextResponse.json({ error: 'Sesi Google tidak ditemukan.' }, { status: 401 })

  const existingProfile = await linkExistingProfile(identity)
  if (existingProfile) {
    return NextResponse.json({
      ok: true,
      redirectTo: getSafeRedirectForAccount(existingProfile.account_status, existingProfile.role),
    })
  }

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Formulir pendaftaran tidak valid.' }, { status: 400 })
  const parsed = reviewerOnboardingSchema.safeParse({
    fullName: form.get('fullName'),
    institution: form.get('institution'),
    professionalLicenseNumber: form.get('professionalLicenseNumber'),
    sipaNumber: form.get('sipaNumber'),
    phone: form.get('phone'),
    workExperience: form.get('workExperience'),
    awards: form.get('awards'),
    publications: form.get('publications'),
    linkedinUrl: form.get('linkedinUrl'),
    instagramUrl: form.get('instagramUrl'),
    youtubeUrl: form.get('youtubeUrl'),
    termsAccepted: form.get('termsAccepted') === 'true',
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Data pendaftaran tidak valid.' }, { status: 400 })
  }
  const cv = form.get('cv')
  if (!(cv instanceof File) || cv.type !== 'application/pdf' || cv.size < 5 || cv.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'CV wajib berupa PDF dengan ukuran maksimal 5 MB.' }, { status: 400 })
  }
  const cvBytes = Buffer.from(await cv.arrayBuffer())
  if (cvBytes.subarray(0, 4).toString('ascii') !== '%PDF') {
    return NextResponse.json({ error: 'Isi file CV bukan dokumen PDF yang valid.' }, { status: 400 })
  }

  const metadata = getRequestMetadata(request)
  if (metadata.ipAddress) {
    const recent = await queryNeon<{ count: number }>(`
      SELECT count(*)::int AS count
      FROM public.audit_logs
      WHERE action = 'REVIEWER_ONBOARDING_COMPLETED'
        AND ip_address = $1
        AND created_at > now() - interval '1 hour'
    `, [metadata.ipAddress])

    if ((recent[0]?.count || 0) >= 3) {
      return NextResponse.json({ error: 'Terlalu banyak pendaftaran. Coba kembali beberapa saat lagi.' }, { status: 429 })
    }
  }

  try {
    const rows = await queryNeon<{ profile_id: string }>(`
      WITH new_profile AS (
        INSERT INTO public.profiles (
          email, password_hash, full_name, role, is_active, account_status,
          institution, sipa_number, phone, professional_license_number,
          avatar_url, auth_user_id, auth_provider, auth_linked_at, last_login_at
        ) VALUES (
          $1, NULL, $2, 'reviewer'::public.user_role, false, 'pending_review',
          $3, NULLIF($4, ''), NULLIF($5, ''), $6,
          $7, $8, 'google', now(), now()
        )
        RETURNING id
      ), new_application AS (
        INSERT INTO public.reviewer_applications (
          profile_id, institution, professional_license_number, sipa_number, phone,
          work_experience, awards, publications, linkedin_url, instagram_url, youtube_url,
          cv_file_name, cv_mime_type, cv_file_size, cv_file_data,
          terms_version, terms_accepted_at
        )
        SELECT id, $3, $6, NULLIF($4, ''), NULLIF($5, ''),
          $10, NULLIF($11, ''), NULLIF($12, ''), NULLIF($13, ''), NULLIF($14, ''), NULLIF($15, ''),
          $16, $17, $18, $19, $20, now()
        FROM new_profile
        RETURNING id, profile_id
      ), audit AS (
        INSERT INTO public.audit_logs (
          user_id, action, resource_type, resource_id, metadata, ip_address
        )
        SELECT profile_id, 'REVIEWER_ONBOARDING_COMPLETED', 'reviewer_application', id,
          jsonb_build_object('email', $1, 'institution', $3, 'provider', 'google', 'terms_version', $20), $9
        FROM new_application
      )
      SELECT profile_id FROM new_application
    `, [
      identity.email,
      parsed.data.fullName,
      parsed.data.institution,
      parsed.data.sipaNumber,
      parsed.data.phone,
      parsed.data.professionalLicenseNumber,
      identity.image,
      identity.authUserId,
      metadata.ipAddress,
      parsed.data.workExperience,
      parsed.data.awards,
      parsed.data.publications,
      parsed.data.linkedinUrl,
      parsed.data.instagramUrl,
      parsed.data.youtubeUrl,
      cv.name.slice(0, 255),
      cv.type,
      cv.size,
      cvBytes,
      CURRENT_TERMS_VERSION,
    ])

    if (!rows[0]) throw new Error('Reviewer application was not created.')
    return NextResponse.json({ ok: true, redirectTo: '/pending-approval' }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('profiles_email') || message.includes('profiles_auth_user_id') || message.includes('duplicate key')) {
      return NextResponse.json({ error: 'Akun Google ini sudah terhubung ke profil PustakaObat.id.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Pendaftaran belum dapat diproses. Silakan coba lagi.' }, { status: 500 })
  }
}
