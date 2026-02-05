import type { Database } from '@/types/database.types'

type Project = Database['public']['Tables']['projects']['Row']

/**
 * Demo project IDs - these are REAL project IDs from Supabase.
 *
 * To set up:
 * 1. Sign in to the app
 * 2. Create a project and connect a public repo
 * 3. Run sync to discover components
 * 4. Copy the project ID from the URL and add it here
 *
 * Anonymous users can view these projects' components without signing in.
 */
export const DEMO_PROJECT_IDS: string[] = [
  // Add your real project IDs here after creating and syncing them
  // Example: '550e8400-e29b-41d4-a716-446655440000'
]

/**
 * Fallback demo projects shown when no real demo projects are configured.
 * These are displayed in the project list but won't have synced components
 * until you create real projects and add their IDs above.
 */
export const DEMO_PROJECTS: Project[] = [
  {
    id: 'demo-1',
    name: 'Expense Tracker',
    description: 'Turn expense tracker UI components into a product walkthrough video',
    repo_url: 'https://github.com/Arty2001/arty-expenses',
    thumbnail_url: null,
    user_id: 'demo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    name: 'Workout Tracker',
    description: 'Create a promo video from your workout app components',
    repo_url: 'https://github.com/Arty2001/arty-workouts',
    thumbnail_url: null,
    user_id: 'demo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export function isDemoProject(id: string): boolean {
  // Check if it's in the real demo project IDs OR is a fallback demo-* ID
  return DEMO_PROJECT_IDS.includes(id) || id.startsWith('demo-')
}

export function getDemoProject(id: string): Project | undefined {
  return DEMO_PROJECTS.find(p => p.id === id)
}

/**
 * Check if a project ID is a REAL demo project (has synced components in Supabase)
 */
export function isRealDemoProject(id: string): boolean {
  return DEMO_PROJECT_IDS.includes(id)
}
