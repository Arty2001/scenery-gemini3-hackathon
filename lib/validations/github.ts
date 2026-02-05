import { z } from 'zod'
import gh from 'parse-github-url'

export const githubRepoUrlSchema = z.string()
  .min(1, 'Repository URL is required')
  .refine((url) => {
    const parsed = gh(url)
    return parsed && parsed.owner && parsed.name
  }, 'Invalid GitHub repository URL')
  .transform((url) => {
    const parsed = gh(url)!
    return {
      url,
      owner: parsed.owner!,
      name: parsed.name!,
      fullName: `${parsed.owner}/${parsed.name}`,
    }
  })

export type ParsedGitHubUrl = z.infer<typeof githubRepoUrlSchema>
