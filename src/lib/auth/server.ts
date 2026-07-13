import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

export async function getActiveProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.is_active) return null
  return { supabase, user, profile }
}

export async function requireActiveProfile(allowedRoles?: UserRole[]) {
  const activeProfile = await getActiveProfile()
  if (!activeProfile) redirect('/login')
  const { profile } = activeProfile
  if (allowedRoles && !allowedRoles.includes(profile.role)) redirect('/dashboard')

  return activeProfile
}
