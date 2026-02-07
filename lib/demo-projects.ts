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
  // Add demo project IDs here
  // Example: '143e32d0-cb26-4602-ae3e-2a664676565d'
]

/**
 * Check if a project ID is a demo project (publicly viewable)
 */
export function isDemoProject(id: string): boolean {
  return DEMO_PROJECT_IDS.includes(id)
}
