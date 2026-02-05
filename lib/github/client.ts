import { Octokit } from '@octokit/rest'
import { createClient } from '@/lib/supabase/server'

export async function createGitHubClient(userId: string): Promise<Octokit | null> {
  const supabase = await createClient()

  const { data: tokenData, error } = await supabase
    .from('github_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single()

  if (error || !tokenData?.access_token) {
    console.error('No GitHub token found for user:', userId)
    return null
  }

  return new Octokit({
    auth: tokenData.access_token,
    userAgent: 'scenery-app/1.0',
  })
}

// Convenience function for current user
export async function createGitHubClientForCurrentUser(): Promise<Octokit | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  return createGitHubClient(user.id)
}
