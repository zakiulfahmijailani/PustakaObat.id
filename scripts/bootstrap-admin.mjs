import { neon } from '@neondatabase/serverless'

const getArg = (name) => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const hasFlag = (name) => process.argv.includes(`--${name}`)

const databaseUrl = process.env.DATABASE_URL
const email = (getArg('email') || process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase()
const fullName = (getArg('name') || process.env.ADMIN_BOOTSTRAP_NAME || 'Admin Apoteq').trim()
const promoteExistingReviewer = hasFlag('promote-existing-reviewer')

if (!databaseUrl) throw new Error('DATABASE_URL is required.')
if (!email || !email.includes('@')) throw new Error('Provide --email or ADMIN_BOOTSTRAP_EMAIL.')

const sql = neon(databaseUrl)
const existing = await sql`
  SELECT id, email, full_name, role::text AS role
  FROM public.profiles
  WHERE lower(email) = ${email}
  LIMIT 1
`

if (existing[0] && existing[0].role !== 'admin' && !promoteExistingReviewer) {
  throw new Error(
    `The email ${email} already belongs to a ${existing[0].role} profile. `
    + 'Re-run with --promote-existing-reviewer only after reviewing the existing account and application history.',
  )
}

const previousRole = existing[0]?.role || null
const rows = await sql`
  WITH updated AS (
    UPDATE public.profiles
    SET full_name = ${fullName},
        role = 'admin'::public.user_role,
        account_status = 'active',
        is_active = true,
        approved_at = now(),
        rejected_reason = NULL
    WHERE lower(email) = ${email}
    RETURNING id, email, full_name
  ), inserted AS (
    INSERT INTO public.profiles (
      email, password_hash, full_name, role, account_status, is_active, approved_at
    )
    SELECT ${email}, NULL, ${fullName}, 'admin'::public.user_role, 'active', true, now()
    WHERE NOT EXISTS (SELECT 1 FROM updated)
    RETURNING id, email, full_name
  ), upserted AS (
    SELECT * FROM updated
    UNION ALL
    SELECT * FROM inserted
  ), audit AS (
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
    SELECT id, 'BOOTSTRAP_GOOGLE_ADMIN', 'profile', id,
      jsonb_build_object(
        'email', email,
        'auth_provider', 'google',
        'previous_role', ${previousRole},
        'promoted_existing_reviewer', ${previousRole === 'reviewer'}
      )
    FROM upserted
  )
  SELECT id, email, full_name FROM upserted
`

console.log(`Google admin preauthorized: ${rows[0].email} (${rows[0].full_name})`)
console.log('The profile will link only after this verified Google email signs in.')
