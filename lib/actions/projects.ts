'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { projectSchema, type ProjectInput } from '@/lib/validations/project'
import type { Database } from '@/types/database.types'
import { DEMO_PROJECTS, isDemoProject, getDemoProject, isRealDemoProject, DEMO_PROJECT_IDS } from '@/lib/demo-projects'

export type Project = Database['public']['Tables']['projects']['Row']

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function getProjects(): Promise<ActionResult<Project[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch real demo projects if configured
  let realDemoProjects: Project[] = []
  if (DEMO_PROJECT_IDS.length > 0) {
    const { data: demoData } = await supabase
      .from('projects')
      .select('*')
      .in('id', DEMO_PROJECT_IDS)

    if (demoData) {
      realDemoProjects = demoData as Project[]
    }
  }

  // For anonymous users, show real demo projects or fallback demos
  if (!user) {
    const demosToShow = realDemoProjects.length > 0 ? realDemoProjects : DEMO_PROJECTS
    return { success: true, data: demosToShow }
  }

  // For signed-in users, show their projects + demo projects
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error || !data) {
    return { success: false, error: 'Failed to fetch projects' }
  }

  // Add demos that aren't already in user's projects
  const userProjectIds = new Set(data.map(p => p.id))
  const demosToAdd = realDemoProjects.length > 0
    ? realDemoProjects.filter(d => !userProjectIds.has(d.id))
    : DEMO_PROJECTS

  return { success: true, data: [...(data as Project[]), ...demosToAdd] }
}

export async function getProject(projectId: string): Promise<ActionResult<Project>> {
  const supabase = await createClient()

  // Check if it's a real demo project (in DEMO_PROJECT_IDS) - allow anonymous access
  if (isRealDemoProject(projectId)) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error || !data) {
      return { success: false, error: 'Project not found' }
    }
    return { success: true, data: data as Project }
  }

  // Fallback demo projects (demo-1, demo-2 placeholders)
  if (isDemoProject(projectId)) {
    const demo = getDemoProject(projectId)
    if (demo) return { success: true, data: demo }
    return { success: false, error: 'Project not found' }
  }

  // Regular projects require authentication
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    return { success: false, error: 'Project not found' }
  }

  return { success: true, data: data as Project }
}

export async function createProject(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const rawData = {
    name: formData.get('name'),
    description: formData.get('description') || null,
    repo_url: formData.get('repo_url') || null,
  }

  const validated = projectSchema.safeParse(rawData)
  if (!validated.success) {
    const firstError = validated.error.issues[0]?.message ?? 'Invalid input'
    return { success: false, error: firstError }
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: validated.data.name,
      description: validated.data.description,
      repo_url: validated.data.repo_url || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: 'Failed to create project' }
  }

  revalidatePath('/protected')
  return { success: true, data: { id: data.id } }
}

export async function updateProject(
  projectId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const rawData = {
    name: formData.get('name'),
    description: formData.get('description') || null,
    repo_url: formData.get('repo_url') || null,
  }

  const validated = projectSchema.safeParse(rawData)
  if (!validated.success) {
    const firstError = validated.error.issues[0]?.message ?? 'Invalid input'
    return { success: false, error: firstError }
  }

  const { error } = await supabase
    .from('projects')
    .update({
      name: validated.data.name,
      description: validated.data.description,
      repo_url: validated.data.repo_url || null,
    })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) {
    return { success: false, error: 'Failed to update project' }
  }

  revalidatePath('/protected')
  revalidatePath(`/protected/projects/${projectId}/settings`)
  return { success: true, data: undefined }
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) {
    return { success: false, error: 'Failed to delete project' }
  }

  revalidatePath('/protected')
  return { success: true, data: undefined }
}
