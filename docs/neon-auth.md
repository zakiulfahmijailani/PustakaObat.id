# Neon authentication for Apoteq

Apoteq stores staff identities, BCrypt password hashes, reviewer applications,
sessions, role/status decisions, and audit events in Neon PostgreSQL. Public
visitors do not need an account.

## Access model

- `reviewer`: self-registers at `/register`, then waits for an admin decision.
- `admin`: no public registration. Create the first admin with the bootstrap
  command; later admins should be created through a controlled internal flow.
- A reviewer must have both `account_status = 'active'` and `is_active = true`
  before protected reviewer routes can be used.

## Migration

Apply `database/migrations/004_neon_auth.sql` to the same Neon branch/database
used by `DATABASE_URL`. The migration is idempotent and preserves existing
profiles while mapping legacy `pharmacist` and `verifier` roles to `reviewer`.
Active legacy seed accounts without approval metadata are suspended because
their demonstration passwords may have been documented. Bootstrap an admin
with a new password before deployment; approve real reviewers afterward.

## Bootstrap an admin

Set secrets only for the current shell; do not commit them:

```powershell
$env:DATABASE_URL="<neon connection string>"
$env:ADMIN_BOOTSTRAP_PASSWORD="<strong temporary password>"
npm run admin:bootstrap -- --email admin@example.com --name "Admin Apoteq"
Remove-Item Env:ADMIN_BOOTSTRAP_PASSWORD
```

Running the command again for the same email resets that admin password and
keeps the account active. Every run creates an audit event.

## Reviewer flow

1. Reviewer submits `/register`.
2. The profile and `reviewer_applications` row are created as pending.
3. Admin reviews the identity data at `/dashboard/admin/users`.
4. Admin approves, rejects, requests revision, suspends, or reactivates.
5. Each decision is enforced on the server and written to `audit_logs`.

## Sessions

The browser receives an opaque `apoteq_session` cookie with `HttpOnly`,
`SameSite=Lax`, and `Secure` in production. Only its SHA-256 hash is stored in
`sessions.token_hash`. Sessions expire after seven days and logout revokes the
database row.

## Current limitations

- Password reset and email verification need a transactional email provider.
- Professional document upload is intentionally not public. Choose a private
  object-storage provider before enabling document uploads; Neon stores only a
  future private object path.
