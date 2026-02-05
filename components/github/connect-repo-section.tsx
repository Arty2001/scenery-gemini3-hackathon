'use client'

import { useState } from 'react'
import { RepoUrlInput } from './repo-url-input'
import { RepoSelector } from './repo-selector'
import { cn } from '@/lib/utils'

interface ConnectRepoSectionProps {
  projectId: string
}

export function ConnectRepoSection({ projectId }: ConnectRepoSectionProps) {
  const [tab, setTab] = useState<'url' | 'select'>('select')

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab('select')}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === 'select'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          My Repositories
        </button>
        <button
          onClick={() => setTab('url')}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === 'url'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Paste URL
        </button>
      </div>

      {tab === 'select' ? (
        <RepoSelector projectId={projectId} />
      ) : (
        <RepoUrlInput projectId={projectId} />
      )}
    </div>
  )
}
