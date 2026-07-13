import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

export async function requireActiveProfile(allowedRoles?: UserRole[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.is_active) redirect('/pending-approval')
  if (allowedRoles && !allowedRoles.includes(profile.role)) redirect('/dashboard')

  return { supabase, user, profile }
}
