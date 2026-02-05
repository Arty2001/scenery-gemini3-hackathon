import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * OAuth callback handler for GitHub authentication.
 * Exchanges the authorization code for a session and redirects to the protected area.
 *
 * IMPORTANT: Uses auth.exchangeCodeForSession() for OAuth flow (not getSession()).
 * The session is validated server-side using the authorization code from GitHub.
 *
 * CRITICAL: The provider_token (GitHub access token) is ONLY available immediately
 * after exchangeCodeForSession. Supabase does NOT store it. We must capture and
 * store it in our github_tokens table for subsequent GitHub API calls.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/protected'
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // Handle OAuth errors (e.g., user denied access)
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(errorDescription || error)}`, requestUrl.origin)
    )
  }

  if (!code) {
    console.error('No authorization code provided')
    return NextResponse.redirect(
      new URL('/auth/login?error=No authorization code', requestUrl.origin)
    )
  }

  const supabase = await createClient()

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('Failed to exchange code for session:', exchangeError)
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
    )
  }

  // Capture and store the GitHub provider_token
  // This is the ONLY window to capture it - it's not stored by Supabase
  if (data.session?.provider_token && data.session.user?.id) {
    try {
      const { error: tokenError } = await supabase.from('github_tokens').upsert({
        user_id: data.session.user.id,
        access_token: data.session.provider_token,
        refresh_token: data.session.provider_refresh_token ?? null,
        updated_at: new Date().toISOString(),
      })

      if (tokenError) {
        // Log but don't block - user can still use the app, just not GitHub features
        console.error('Failed to store GitHub token:', tokenError)
      } else {
        console.log('GitHub provider token stored successfully for user:', data.session.user.id)
      }
    } catch (err) {
      // Don't block redirect on storage failure
      console.error('Error storing GitHub token:', err)
    }
  }

  // Successful authentication - redirect to protected area
  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
