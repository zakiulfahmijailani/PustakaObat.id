import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import PostgresAdapter from '@auth/pg-adapter'
import { Pool } from '@neondatabase/serverless'
import type { Pool as PgPool } from 'pg'

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  return {
    // The Neon Pool implements the query surface used by the official pg adapter.
    // Its connect() type is intentionally narrower than node-postgres, hence the cast.
    adapter: PostgresAdapter(pool as unknown as PgPool),
    providers: [
      Google({
        authorization: {
          params: {
            prompt: 'select_account',
          },
        },
      }),
    ],
    session: {
      strategy: 'database',
      maxAge: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    pages: {
      signIn: '/masuk',
      error: '/masuk',
    },
    trustHost: true,
    callbacks: {
      async signIn({ account, profile }) {
        if (account?.provider !== 'google') return false

        const googleProfile = profile as { email?: string; email_verified?: boolean } | undefined
        return Boolean(googleProfile?.email && googleProfile.email_verified)
      },
      async session({ session, user }) {
        if (session.user) session.user.id = String(user.id)
        return session
      },
    },
    events: {
      async signIn({ user, account }) {
        if (account?.provider !== 'google') return

        await pool.query(`
          WITH verified_user AS (
            UPDATE public.users
            SET "emailVerified" = COALESCE("emailVerified", now())
            WHERE id = $1
            RETURNING id
          ), active_profile AS (
            UPDATE public.profiles
            SET last_login_at = now()
            WHERE auth_user_id = $1
            RETURNING id, account_status
          )
          INSERT INTO public.audit_logs (
            user_id, action, resource_type, resource_id, metadata
          )
          SELECT id, 'GOOGLE_LOGIN_SUCCESS', 'profile', id,
            jsonb_build_object('provider', 'google', 'account_status', account_status)
          FROM active_profile
        `, [user.id])
      },
    },
  }
})
