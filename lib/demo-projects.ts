import type { Database } from '@/types/database.types'

type Project = Database['public']['Tables']['projects']['Row']

/**
 * Demo projects shown to anonymous users.
 * Replace repo_url values with your actual public repo URLs.
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
  return id.startsWith('demo-')
}

export function getDemoProject(id: string): Project | undefined {
  return DEMO_PROJECTS.find(p => p.id === id)
}
