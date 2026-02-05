'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

/**
 * Server action to sign out the current user.
 * Clears the session and redirects to the login page.
 */
export async function signOut() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Sign out error:', error)
    // Even if there's an error, redirect to login
    // The session may already be invalid
  }

  revalidatePath('/', 'layout')
  redirect('/auth/login')
}

/**
 * Server action to get the current authenticated user.
 * Returns null if not authenticated.
 */
export async function getCurrentUser() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}
