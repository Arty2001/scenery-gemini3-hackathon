import { simpleGit, SimpleGit } from 'simple-git'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdir, rm, access, writeFile } from 'fs/promises'

const REPOS_BASE_DIR = join(tmpdir(), 'scenery-repos')

// Only clone directories likely to contain React components (saves memory on large repos)
const SPARSE_CHECKOUT_PATHS = [
  'src',
  'components',
  'lib',
  'app',
  'pages',
  'ui',
  'packages',
  'package.json',
  'tsconfig.json',
]

// Timeout for git operations (45 seconds - leave buffer for Vercel's 60s limit)
const GIT_TIMEOUT_MS = 45000

export function getRepoPath(userId: string, projectId: string): string {
  return join(REPOS_BASE_DIR, userId, projectId)
}

export async function ensureRepoDir(userId: string): Promise<void> {
  const userDir = join(REPOS_BASE_DIR, userId)
  await mkdir(userDir, { recursive: true })
}

export async function repoExists(localPath: string): Promise<boolean> {
  try {
    await access(localPath)
    return true
  } catch {
    return false
  }
}

export async function cloneRepo(
  cloneUrl: string,
  localPath: string,
  accessToken?: string
): Promise<{ success: true } | { success: false; error: string }> {
  // Configure git with timeout to prevent hanging on large repos
  const git: SimpleGit = simpleGit({ timeout: { block: GIT_TIMEOUT_MS } })

  // Construct authenticated URL for private repos
  let authUrl = cloneUrl
  if (accessToken) {
    try {
      const url = new URL(cloneUrl)
      authUrl = `https://${accessToken}@${url.host}${url.pathname}`
    } catch (e) {
      // If URL parsing fails, try using as-is
      console.warn('Could not parse clone URL, using as-is')
    }
  }

  try {
    // Remove existing directory if it exists (fresh clone)
    if (await repoExists(localPath)) {
      await rm(localPath, { recursive: true, force: true })
    }

    // Create parent directory
    await mkdir(localPath, { recursive: true })

    // Use sparse checkout + shallow clone for minimal memory usage on large repos
    // Step 1: Initialize empty repo with sparse checkout
    await git.clone(authUrl, localPath, [
      '--depth', '1',
      '--single-branch',
      '--filter=blob:none',  // Don't download blobs until needed (partial clone)
      '--sparse',            // Enable sparse checkout
    ])

    // Step 2: Configure sparse checkout paths (only component directories)
    const repoGit = simpleGit(localPath, { timeout: { block: GIT_TIMEOUT_MS } })

    // Write sparse-checkout config to only get source directories
    const sparseCheckoutPath = join(localPath, '.git', 'info', 'sparse-checkout')
    await writeFile(sparseCheckoutPath, SPARSE_CHECKOUT_PATHS.join('\n') + '\n')

    // Apply sparse checkout
    await repoGit.raw(['sparse-checkout', 'reapply'])

    return { success: true }
  } catch (error) {
    console.error('Clone failed:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    // Clean up partial clone
    try {
      await rm(localPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }

    if (message.includes('Authentication') || message.includes('401') || message.includes('403')) {
      return { success: false, error: 'Authentication failed. Please reconnect your GitHub account.' }
    }
    if (message.includes('not found') || message.includes('404')) {
      return { success: false, error: 'Repository not found. Check the URL and your access permissions.' }
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return { success: false, error: 'Repository too large or network slow. Try a smaller repo.' }
    }

    return { success: false, error: 'Failed to clone repository' }
  }
}

export async function pullLatest(
  localPath: string,
  accessToken?: string
): Promise<{ success: true; updated: boolean } | { success: false; error: string }> {
  try {
    if (!await repoExists(localPath)) {
      return { success: false, error: 'Repository not cloned yet' }
    }

    const git: SimpleGit = simpleGit(localPath)

    // If token provided, update remote URL to include auth
    if (accessToken) {
      const remotes = await git.getRemotes(true)
      const origin = remotes.find(r => r.name === 'origin')
      if (origin?.refs?.fetch) {
        try {
          const url = new URL(origin.refs.fetch)
          url.username = accessToken
          url.password = '' // Clear password, just use token as username
          await git.remote(['set-url', 'origin', url.toString()])
        } catch {
          // URL parsing failed, try without updating
        }
      }
    }

    // Fetch and check if there are updates
    await git.fetch('origin')
    const status = await git.status()

    if (status.behind > 0) {
      // Pull the updates
      await git.pull('origin', 'HEAD', ['--ff-only'])
      return { success: true, updated: true }
    }

    return { success: true, updated: false }
  } catch (error) {
    console.error('Pull failed:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('Authentication') || message.includes('401') || message.includes('403')) {
      return { success: false, error: 'Authentication failed. Please reconnect your GitHub account.' }
    }

    return { success: false, error: 'Failed to sync repository' }
  }
}

export async function deleteRepo(localPath: string): Promise<void> {
  try {
    await rm(localPath, { recursive: true, force: true })
  } catch {
    // Ignore errors on cleanup
  }
}
