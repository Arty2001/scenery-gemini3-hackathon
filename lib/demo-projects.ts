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
  'bcbe06ed-a926-41d9-bc6a-dbbb714ece76',
  '3bee8301-9771-4436-b95f-38317b9ac4f9',
]

/**
 * Check if a project ID is a demo project (publicly viewable)
 */
export function isDemoProject(id: string): boolean {
  return DEMO_PROJECT_IDS.includes(id)
}
