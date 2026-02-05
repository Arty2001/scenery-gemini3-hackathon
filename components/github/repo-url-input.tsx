'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { connectRepository, type RepositoryConnection } from '@/lib/actions/github'
import { Github, Loader2, X } from 'lucide-react'

interface RepoUrlInputProps {
  projectId: string
  onConnect?: (connection: RepositoryConnection) => void
}

export function RepoUrlInput({ projectId, onConnect }: RepoUrlInputProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await connectRepository(projectId, url)
      if (result.success) {
        setUrl('')
        onConnect?.(result.data)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="repo-url">GitHub Repository URL</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="repo-url"
              type="text"
              placeholder="https://github.com/owner/repo"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="pl-10"
              disabled={isPending}
            />
          </div>
          <Button type="submit" disabled={isPending || !url.trim()}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Connect'
            )}
          </Button>
        </div>
        {error && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <X className="h-3 w-3" />
            {error}
          </p>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Paste a GitHub repository URL to connect it to this project.
        Supports HTTPS URLs, SSH URLs, and shorthand (owner/repo).
      </p>
    </form>
  )
}
