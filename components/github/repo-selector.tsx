'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getUserRepos, connectRepository, type GitHubRepo, type RepositoryConnection } from '@/lib/actions/github'
import { Github, Lock, Search, Loader2, Star, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RepoSelectorProps {
  projectId: string
  onConnect?: (connection: RepositoryConnection) => void
}

export function RepoSelector({ projectId, onConnect }: RepoSelectorProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connecting, startTransition] = useTransition()
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)

  useEffect(() => {
    async function loadRepos() {
      setIsLoading(true)
      setError(null)
      const result = await getUserRepos()
      if (result.success) {
        setRepos(result.data)
      } else {
        setError(result.error)
      }
      setIsLoading(false)
    }
    loadRepos()
  }, [])

  const filteredRepos = useMemo(() => {
    if (!search.trim()) return repos
    const lowerSearch = search.toLowerCase()
    return repos.filter(repo =>
      repo.name.toLowerCase().includes(lowerSearch) ||
      repo.fullName.toLowerCase().includes(lowerSearch) ||
      repo.description?.toLowerCase().includes(lowerSearch)
    )
  }, [repos, search])

  const handleSelect = (repo: GitHubRepo) => {
    setSelectedRepo(repo.fullName)
    startTransition(async () => {
      // IMPORTANT: Use repo.cloneUrl, not repo.url
      // repo.url is the HTML URL (https://github.com/owner/repo)
      // repo.cloneUrl is the clone URL (https://github.com/owner/repo.git)
      // connectRepository expects a clone URL
      const result = await connectRepository(projectId, repo.cloneUrl)
      if (result.success) {
        onConnect?.(result.data)
      } else {
        setError(result.error)
        setSelectedRepo(null)
      }
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading repositories...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">{error}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
        {filteredRepos.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {search ? 'No repositories match your search' : 'No repositories found'}
          </div>
        ) : (
          filteredRepos.map(repo => (
            <button
              key={repo.id}
              onClick={() => handleSelect(repo)}
              disabled={connecting}
              className={cn(
                "w-full p-4 text-left hover:bg-muted/50 transition-colors flex items-center gap-3",
                selectedRepo === repo.fullName && "bg-muted"
              )}
            >
              <Github className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{repo.fullName}</span>
                  {repo.private && <Lock className="h-3 w-3 text-muted-foreground" />}
                </div>
                {repo.description && (
                  <p className="text-sm text-muted-foreground truncate">{repo.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {repo.language && <span>{repo.language}</span>}
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {repo.stargazersCount}
                  </span>
                </div>
              </div>
              {selectedRepo === repo.fullName && connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ))
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filteredRepos.length} of {repos.length} repositories
      </p>
    </div>
  )
}
