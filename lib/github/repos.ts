import { Octokit } from '@octokit/rest'

export type GitHubRepo = {
  id: number
  name: string
  fullName: string
  private: boolean
  url: string
  cloneUrl: string
  defaultBranch: string
  description: string | null
  language: string | null
  updatedAt: string | null
  stargazersCount: number
}

export async function listUserRepos(octokit: Octokit): Promise<GitHubRepo[]> {
  try {
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      visibility: 'all', // public, private, and internal
      affiliation: 'owner,collaborator,organization_member',
      sort: 'updated',
      per_page: 100,
    })

    return repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch,
      description: repo.description,
      language: repo.language,
      updatedAt: repo.updated_at,
      stargazersCount: repo.stargazers_count,
    }))
  } catch (error) {
    console.error('Failed to list repos:', error)
    throw error
  }
}

export async function getRepoInfo(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<GitHubRepo | null> {
  try {
    const { data } = await octokit.rest.repos.get({ owner, repo })

    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      private: data.private,
      url: data.html_url,
      cloneUrl: data.clone_url,
      defaultBranch: data.default_branch,
      description: data.description,
      language: data.language,
      updatedAt: data.updated_at,
      stargazersCount: data.stargazers_count,
    }
  } catch (error) {
    console.error('Failed to get repo info:', error)
    return null
  }
}
