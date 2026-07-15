import bcrypt from 'bcryptjs'
import { neon } from '@neondatabase/serverless'

const getArg = (name) => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const databaseUrl = process.env.DATABASE_URL
const email = (getArg('email') || process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase()
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || ''
const fullName = (getArg('name') || process.env.ADMIN_BOOTSTRAP_NAME || 'Admin Apoteq').trim()

if (!databaseUrl) throw new Error('DATABASE_URL is required.')
if (!email || !email.includes('@')) throw new Error('Provide --email or ADMIN_BOOTSTRAP_EMAIL.')
if (password.length < 14 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
  throw new Error('ADMIN_BOOTSTRAP_PASSWORD must be at least 14 characters and include uppercase, lowercase, and a number.')
}

const sql = neon(databaseUrl)
const passwordHash = await bcrypt.hash(password, 12)
const rows = await sql`
  WITH upserted AS (
    INSERT INTO public.profiles (
      email, password_hash, full_name, role, account_status, is_active, approved_at
    ) VALUES (
      ${email}, ${passwordHash}, ${fullName}, 'admin'::public.user_role, 'active', true, now()
    )
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      full_name = EXCLUDED.full_name,
      role = 'admin'::public.user_role,
      account_status = 'active',
      is_active = true,
      approved_at = now()
    RETURNING id, email, full_name
  ), audit AS (
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
    SELECT id, 'BOOTSTRAP_ADMIN', 'profile', id, jsonb_build_object('email', email) FROM upserted
  )
  SELECT id, email, full_name FROM upserted
`

console.log(`Admin ready: ${rows[0].email} (${rows[0].full_name})`)

