-- Google-only Auth.js authentication backed by Neon PostgreSQL.
-- Apply this migration immediately before deploying the matching application code.
-- It preserves the former password-session table for rollback and is safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sessions'
      AND column_name = 'token_hash'
  ) AND to_regclass('public.legacy_password_sessions') IS NULL THEN
    ALTER TABLE public.sessions RENAME TO legacy_password_sessions;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.verification_token (
  identifier text NOT NULL,
  expires timestamptz NOT NULL,
  token text NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS public.users (
  id serial PRIMARY KEY,
  name varchar(255),
  email varchar(255),
  "emailVerified" timestamptz,
  image text
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key
  ON public.users (lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.accounts (
  id serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type varchar(255) NOT NULL,
  provider varchar(255) NOT NULL,
  "providerAccountId" varchar(255) NOT NULL,
  refresh_token text,
  access_token text,
  expires_at bigint,
  id_token text,
  scope text,
  session_state text,
  token_type text,
  CONSTRAINT accounts_provider_account_key UNIQUE (provider, "providerAccountId")
);

CREATE INDEX IF NOT EXISTS accounts_user_id_idx
  ON public.accounts ("userId");

CREATE TABLE IF NOT EXISTS public.sessions (
  id serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires timestamptz NOT NULL,
  "sessionToken" varchar(255) NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx
  ON public.sessions ("userId");

ALTER TABLE public.profiles
  ALTER COLUMN password_hash DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS auth_user_id integer,
  ADD COLUMN IF NOT EXISTS auth_provider text,
  ADD COLUMN IF NOT EXISTS auth_linked_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_auth_user_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_auth_user_id_fkey
      FOREIGN KEY (auth_user_id)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_auth_provider_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_auth_provider_check
      CHECK (auth_provider IS NULL OR auth_provider = 'google');
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_auth_user_id_key
  ON public.profiles (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON TABLE public.users IS
  'Auth.js identities. Google is the only enabled provider for Apoteq staff authentication.';
COMMENT ON TABLE public.accounts IS
  'OAuth provider accounts managed by the Auth.js PostgreSQL adapter.';
COMMENT ON TABLE public.sessions IS
  'Database sessions managed by Auth.js and stored in Neon.';
COMMENT ON COLUMN public.profiles.auth_user_id IS
  'Links the Apoteq role/profile to the stable Auth.js user identity after verified Google sign-in.';

DO $$
BEGIN
  IF to_regclass('public.legacy_password_sessions') IS NOT NULL THEN
    COMMENT ON TABLE public.legacy_password_sessions IS
      'Read-only rollback copy of sessions from the retired password authentication flow.';
  END IF;
END
$$;
