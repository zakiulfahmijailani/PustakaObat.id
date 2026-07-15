# Google authentication with Neon

Apoteq uses Google OAuth through Auth.js. Auth identities, provider accounts,
database sessions, application profiles, reviewer applications, roles, and
audit records are stored in Neon PostgreSQL. Public visitors do not need an
account.

## Access model

- `reviewer`: signs in with Google, completes professional information, and
  remains `pending_review` until an admin approves the application.
- `admin`: has no public registration. An email must be preauthorized with the
  bootstrap command before that exact verified Google identity can link.
- Protected access requires both `account_status = 'active'` and
  `is_active = true`. The browser never supplies the trusted role.

## Role-specific entry points

Google remains a single OAuth provider. Apoteq separates the user experience
with short-lived auth intent rather than separate identity systems:

```text
/masuk                     choose a staff workspace
/reviewer/login            existing reviewer sign-in
/reviewer/register         reviewer self-registration
/reviewer/register/complete professional onboarding
/admin/login               preauthorized admin sign-in only
```

The `apoteq_auth_intent` cookie is HTTP-only, SameSite Lax, and expires after
ten minutes. It can route an unlinked Google identity to reviewer onboarding,
the reviewer not-registered screen, or the admin access-denied screen. It
cannot set or promote a role. Once a profile exists, `profiles.role` and
`profiles.account_status` from Neon always determine the destination.

Active workspaces are intentionally separate:

```text
/reviewer/dashboard
/reviewer/medicines
/reviewer/history
/reviewer/profile

/admin/dashboard
/admin/medicines
/admin/users
/admin/imports
/admin/audit
/admin/settings
```

Admin routes require an active Admin profile. Reviewer routes accept an active
Reviewer or Admin so an Admin can perform review work without receiving a
second role.

## Environment variables

Set these values locally and in Vercel. None of them may use a `NEXT_PUBLIC_`
prefix.

```text
DATABASE_URL=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

Generate `AUTH_SECRET` with a cryptographically secure random value. The
Google OAuth client needs only the `openid`, `email`, and `profile` scopes.

Google Cloud authorized origins:

```text
http://localhost:3000
https://apoteq.vercel.app
```

Google Cloud authorized redirect URIs:

```text
http://localhost:3000/api/auth/callback/google
https://apoteq.vercel.app/api/auth/callback/google
```

Add each future custom domain separately.

## Migration and rollout

`database/migrations/005_google_auth_neon.sql` creates the Auth.js adapter
tables (`users`, `accounts`, `sessions`, and `verification_token`), links them
to `profiles.auth_user_id`, and renames the former custom session table to
`legacy_password_sessions` for rollback.

Because the current deployed password code reads `public.sessions`, coordinate
the rollout in this order:

1. Configure the Google OAuth client and all four Vercel variables.
2. Create a Neon branch/snapshot for rollback.
3. Apply `005_google_auth_neon.sql` to the target Neon database.
4. Deploy the matching application commit immediately.
5. Bootstrap and test the first admin Google email.
6. Test a new reviewer through registration, pending approval, admin approval,
   logout, and a second login.

Do not apply migration 005 to production while the old password build is still
expected to serve staff logins.

## Bootstrap an admin

The command preauthorizes an email; it does not create a password or a Google
account.

```powershell
$env:DATABASE_URL="<neon connection string>"
npm run admin:bootstrap -- --email admin@example.com --name "Admin Apoteq"
```

The first verified Google sign-in using that exact email links the Auth.js user
to the active admin profile. A different Google email cannot claim the role.

The bootstrap command writes only the application profile and audit record.
Auth.js continues to own `users`, `accounts`, and `sessions`; do not insert into
those tables manually. If the email already belongs to a Reviewer, the command
stops instead of silently promoting the account. After reviewing the existing
Reviewer application and history, an intentional promotion requires:

```powershell
npm run admin:bootstrap -- --email reviewer@example.com --name "Admin Apoteq" --promote-existing-reviewer
```

Public Google registration can only create `role = reviewer`,
`account_status = pending_review`, and `is_active = false`. Reviewer activation
is performed by an active Admin from `/admin/users` and is enforced again by
the server API before Neon is updated.

## Reviewer flow

1. The reviewer opens `/reviewer/register` and chooses Google.
2. Auth.js stores the Google user, account, and session in Neon.
3. `/auth/post-login` links an existing profile by verified email, or redirects
   a new registration to `/reviewer/register/complete`. Reviewer login does
   not silently create an application.
4. Professional data creates a reviewer profile and application as pending.
5. Admin decisions remain server-enforced and written to `audit_logs`.

Password login and password registration endpoints return HTTP `410 Gone`.
The legacy password hashes and session rows are retained only for a controlled
rollback and are not used by the application.

## Security properties

- Only Google is enabled as an Auth.js provider.
- Google `email_verified` must be true.
- Email is used only for the initial verified link; later authorization uses
  the stable Auth.js user ID.
- A profile already linked to another Auth.js user causes a hard conflict.
- Public registration can only create `reviewer` + `pending_review`; it cannot
  create or promote an admin.
- Role and account status are queried from Neon on protected server requests.
- Dashboard pages and mutation APIs enforce authentication server-side. Apoteq
  intentionally does not rely on an edge middleware cookie-presence check for
  database sessions.
- OAuth authorization codes, raw tokens, ID tokens, and client secrets are not
  copied into Apoteq audit metadata.

## Validation

Before deployment run:

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

An actual Google redirect/callback test additionally requires real development
OAuth credentials and the local callback URI configured in Google Cloud.
