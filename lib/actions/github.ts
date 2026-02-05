'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { githubRepoUrlSchema } from '@/lib/validations/github'
import { createGitHubClientForCurrentUser } from '@/lib/github/client'
import { listUserRepos, type GitHubRepo } from '@/lib/github/repos'
import { cloneRepo, pullLatest, getRepoPath, ensureRepoDir, deleteRepo } from '@/lib/github/clone'
import type { ActionResult } from '@/lib/actions/projects'
import { discoverComponents } from './components'

export type { GitHubRepo } from '@/lib/github/repos'

export type RepositoryConnection = {
  id: string
  project_id: string
  owner: string
  name: string
  full_name: string
  default_branch: string
  is_private: boolean
  clone_url: string
  local_path: string | null
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export async function connectRepository(
  projectId: string,
  repoUrl: string
): Promise<ActionResult<RepositoryConnection>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Validate URL
  const validated = githubRepoUrlSchema.safeParse(repoUrl)
  if (!validated.success) {
    return { success: false, error: 'Invalid GitHub repository URL' }
  }

  const { owner, name, fullName } = validated.data

  // Verify project belongs to user (skip for demo projects)
  if (!projectId.startsWith('demo-')) {
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      return { success: false, error: 'Project not found' }
    }
  }

  // Try to get repo info from GitHub API (determines if private, gets default branch)
  let isPrivate = false
  let defaultBranch = 'main'
  let cloneUrl = `https://github.com/${fullName}.git`

  const octokit = await createGitHubClientForCurrentUser()
  if (octokit) {
    try {
      const { data: repo } = await octokit.rest.repos.get({ owner, repo: name })
      isPrivate = repo.private
      defaultBranch = repo.default_branch
      cloneUrl = repo.clone_url
    } catch (error) {
      // If we can't access via API, assume public and continue
      // Clone will fail later if truly inaccessible
      console.log('Could not fetch repo info from API, using defaults')
    }
  }

  // For demo projects, skip DB and return synthetic connection
  if (projectId.startsWith('demo-')) {
    const syntheticConnection: RepositoryConnection = {
      id: `demo-conn-${projectId}`,
      project_id: projectId,
      owner,
      name,
      full_name: fullName,
      default_branch: defaultBranch,
      is_private: isPrivate,
      clone_url: cloneUrl,
      local_path: null,
      last_synced_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    revalidatePath(`/protected/projects/${projectId}`)
    return { success: true, data: syntheticConnection }
  }

  // Upsert repository connection (one per project)
  const { data, error } = await supabase
    .from('repository_connections')
    .upsert({
      project_id: projectId,
      owner,
      name,
      default_branch: defaultBranch,
      is_private: isPrivate,
      clone_url: cloneUrl,
    }, {
      onConflict: 'project_id'
    })
    .select()
    .single()

  if (error || !data) {
    return { success: false, error: 'Failed to connect repository' }
  }

  revalidatePath(`/protected/projects/${projectId}`)
  return { success: true, data: data as RepositoryConnection }
}

export async function getRepositoryConnection(
  projectId: string
): Promise<ActionResult<RepositoryConnection | null>> {
  // Demo projects have no DB connection
  if (projectId.startsWith('demo-')) {
    return { success: true, data: null }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: true, data: null }
  }

  const { data, error } = await supabase
    .from('repository_connections')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (error?.code === 'PGRST116') {
    // No rows returned - not an error, just no connection yet
    return { success: true, data: null }
  }

  if (error) {
    return { success: false, error: 'Failed to fetch repository connection' }
  }

  return { success: true, data: data as RepositoryConnection }
}

/**
 * For demo projects, materialize real DB rows (project + repo connection)
 * so the entire existing flow works unchanged.
 */
async function materializeDemoProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string
): Promise<ActionResult<{ realProjectId: string; connectionId: string }>> {
  const { getDemoProject } = await import('@/lib/demo-projects')
  const demo = getDemoProject(projectId)
  if (!demo?.repo_url) return { success: false, error: 'No repository connected' }

  const match = demo.repo_url.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) return { success: false, error: 'Invalid repo URL' }

  // Check if already materialized (user may have cloned before)
  const { data: existingProject } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)
    .eq('name', demo.name)
    .eq('repo_url', demo.repo_url)
    .single()

  if (existingProject) {
    const { data: existingConn } = await supabase
      .from('repository_connections')
      .select('id')
      .eq('project_id', existingProject.id)
      .single()
    if (existingConn) {
      return { success: true, data: { realProjectId: existingProject.id, connectionId: existingConn.id } }
    }
  }

  // Create real project
  const { data: newProject, error: projError } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: demo.name,
      description: demo.description,
      repo_url: demo.repo_url,
    })
    .select('id')
    .single()

  if (projError || !newProject) {
    console.error('[materialize] Failed to create project:', projError)
    return { success: false, error: 'Failed to create project' }
  }

  // Create real repo connection
  const { data: newConn, error: connError } = await supabase
    .from('repository_connections')
    .insert({
      project_id: newProject.id,
      owner: match[1],
      name: match[2],
      default_branch: 'main',
      is_private: false,
      clone_url: `${demo.repo_url}.git`,
    })
    .select('id')
    .single()

  if (connError || !newConn) {
    console.error('[materialize] Failed to create connection:', connError)
    return { success: false, error: 'Failed to create repository connection' }
  }

  console.log(`[materialize] Demo ${projectId} -> real project ${newProject.id}, conn ${newConn.id}`)
  return { success: true, data: { realProjectId: newProject.id, connectionId: newConn.id } }
}

export async function cloneConnectedRepository(
  projectId: string
): Promise<ActionResult<{ localPath: string; realProjectId?: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Sign in to clone repositories' }
  }

  let actualProjectId = projectId
  let connection: RepositoryConnection

  if (projectId.startsWith('demo-')) {
    // Materialize demo into real DB rows
    const matResult = await materializeDemoProject(supabase, user.id, projectId)
    if (!matResult.success) return { success: false, error: matResult.error }

    actualProjectId = matResult.data.realProjectId

    // Fetch the real connection
    const { data: connectionData } = await supabase
      .from('repository_connections')
      .select('*')
      .eq('id', matResult.data.connectionId)
      .single()

    if (!connectionData) return { success: false, error: 'Connection not found' }
    connection = connectionData as RepositoryConnection
  } else {
    // Get repository connection
    const { data: connectionData, error: connError } = await supabase
      .from('repository_connections')
      .select('*')
      .eq('project_id', projectId)
      .single()

    if (connError || !connectionData) {
      return { success: false, error: 'No repository connected' }
    }

    connection = connectionData as RepositoryConnection
  }

  // Get GitHub token for private repos
  let accessToken: string | undefined
  if (connection.is_private) {
    const { data: tokenData } = await supabase
      .from('github_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .single()

    if (!tokenData?.access_token) {
      return { success: false, error: 'GitHub token not found. Please sign out and sign in with GitHub again.' }
    }
    accessToken = tokenData.access_token
  }

  // Ensure user directory exists
  console.log(`[clone] Starting clone for ${actualProjectId}, userId=${user.id}, url=${connection.clone_url}`)
  await ensureRepoDir(user.id)

  // Clone the repository
  const localPath = getRepoPath(user.id, actualProjectId)
  console.log(`[clone] Cloning to ${localPath}`)
  const result = await cloneRepo(connection.clone_url, localPath, accessToken)

  if (!result.success) {
    console.error(`[clone] Clone failed:`, result.error)
    return { success: false, error: result.error }
  }
  console.log(`[clone] Clone succeeded for ${actualProjectId}`)

  // Update connection with local path and sync timestamp
  const { error: updateError } = await supabase
    .from('repository_connections')
    .update({
      local_path: localPath,
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', connection.id)

  if (updateError) {
    return { success: false, error: 'Failed to update connection record' }
  }

  // Trigger component discovery in background (fire-and-forget)
  discoverComponents(connection.id, localPath, {
    name: connection.name,
    owner: connection.owner,
  }).catch(err => console.error('Background discovery failed:', err))

  revalidatePath(`/protected/projects/${actualProjectId}`)
  revalidatePath('/protected')
  return { success: true, data: { localPath, realProjectId: projectId.startsWith('demo-') ? actualProjectId : undefined } }
}

export async function syncRepository(
  projectId: string
): Promise<ActionResult<{ updated: boolean }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Sign in to sync repositories' }
  }

  // Get repository connection
  const { data: connectionData, error: connError } = await supabase
    .from('repository_connections')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (connError || !connectionData) {
    return { success: false, error: 'No repository connected' }
  }

  const connection = connectionData as RepositoryConnection

  if (!connection.local_path) {
    // Not cloned yet, clone first
    const cloneResult = await cloneConnectedRepository(projectId)
    if (!cloneResult.success) {
      return { success: false, error: cloneResult.error }
    }
    return { success: true, data: { updated: true } }
  }

  // Get GitHub token for private repos
  let accessToken: string | undefined
  if (connection.is_private) {
    const { data: tokenData } = await supabase
      .from('github_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .single()

    accessToken = tokenData?.access_token
  }

  // Pull latest changes
  const result = await pullLatest(connection.local_path, accessToken)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  // Update sync timestamp
  const { error: updateError } = await supabase
    .from('repository_connections')
    .update({
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', connection.id)

  if (updateError) {
    console.error('Failed to update sync timestamp:', updateError)
  }

  // Re-discover components if files were updated
  if (result.updated) {
    console.log(`[sync] Git pulled new changes for ${connection.full_name}, starting discovery...`);
    discoverComponents(connection.id, connection.local_path, {
      name: connection.name,
      owner: connection.owner,
    }).catch(err => console.error('[sync] Background discovery failed:', err))
  } else {
    console.log(`[sync] No changes for ${connection.full_name}, skipping discovery`);
  }

  revalidatePath(`/protected/projects/${projectId}`)
  return { success: true, data: { updated: result.updated } }
}

export async function disconnectRepository(
  projectId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Get connection to find local path
  const { data: connection } = await supabase
    .from('repository_connections')
    .select('local_path')
    .eq('project_id', projectId)
    .single()

  // Delete local files if they exist
  if (connection?.local_path) {
    await deleteRepo(connection.local_path)
  }

  const { error } = await supabase
    .from('repository_connections')
    .delete()
    .eq('project_id', projectId)

  if (error) {
    return { success: false, error: 'Failed to disconnect repository' }
  }

  revalidatePath(`/protected/projects/${projectId}`)
  return { success: true, data: undefined }
}

export async function getUserRepos(): Promise<ActionResult<GitHubRepo[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const octokit = await createGitHubClientForCurrentUser()
  if (!octokit) {
    return {
      success: false,
      error: 'GitHub not connected. Please sign out and sign in with GitHub again.'
    }
  }

  try {
    const repos = await listUserRepos(octokit)
    return { success: true, data: repos }
  } catch (error) {
    console.error('Failed to fetch repos:', error)
    return { success: false, error: 'Failed to fetch repositories from GitHub' }
  }
}
