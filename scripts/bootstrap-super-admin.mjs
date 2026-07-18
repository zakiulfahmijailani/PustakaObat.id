import { neon } from '@neondatabase/serverless'

const getArg = (name) => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const databaseUrl = process.env.DATABASE_URL
const email = (getArg('email') || process.env.SUPER_ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase()
const fullName = (getArg('name') || process.env.SUPER_ADMIN_BOOTSTRAP_NAME || 'PustakaObat Super Admin').trim()

if (!databaseUrl) throw new Error('DATABASE_URL is required.')
if (!email || !email.includes('@')) throw new Error('Provide --email or SUPER_ADMIN_BOOTSTRAP_EMAIL.')

const sql = neon(databaseUrl)
const rows = await sql`
  with updated as (
    update public.profiles
    set full_name = ${fullName}, role = 'super_admin'::public.user_role,
        account_status = 'active', is_active = true, approved_at = now(), rejected_reason = null
    where lower(email) = ${email}
    returning id, email, full_name
  ), inserted as (
    insert into public.profiles (email, password_hash, full_name, role, account_status, is_active, approved_at)
    select ${email}, null, ${fullName}, 'super_admin'::public.user_role, 'active', true, now()
    where not exists (select 1 from updated)
    returning id, email, full_name
  ), upserted as (
    select * from updated union all select * from inserted
  ), audit as (
    insert into public.audit_logs (user_id, action, resource_type, resource_id, metadata)
    select id, 'BOOTSTRAP_SUPER_ADMIN', 'profile', id,
      jsonb_build_object('email', email, 'auth_provider', 'google')
    from upserted
  )
  select id, email, full_name from upserted
`

console.log(`Google super admin preauthorized: ${rows[0].email} (${rows[0].full_name})`)
