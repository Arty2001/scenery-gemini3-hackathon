'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { syncRepository, disconnectRepository, cloneConnectedRepository, type RepositoryConnection } from '@/lib/actions/github'
import { useCompositionStore } from '@/lib/composition/store'
import { Github, GitBranch, ExternalLink, RefreshCw, Loader2, Check, Trash2, Download, Search, Sparkles, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface RepoStatusProps {
  connection: RepositoryConnection
  projectId: string
}

type DiscoveryPhase = 'idle' | 'cloning' | 'pulling' | 'scanning' | 'categorizing' | 'previewing' | 'complete'

export function RepoStatus({ connection, projectId }: RepoStatusProps) {
  const router = useRouter()
  const refreshPreviews = useCompositionStore((s) => s.refreshPreviews)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isCloning, setIsCloning] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [syncResult, setSyncResult] = useState<'updated' | 'current' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [discoveryPhase, setDiscoveryPhase] = useState<DiscoveryPhase>('idle')
  const [discoveryProgress, setDiscoveryProgress] = useState({ total: 0, categorized: 0, withPreview: 0 })
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const seenEmptyRef = useRef(false)

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    pollRef.current = null
    timeoutRef.current = null
    elapsedRef.current = null
  }, [])

  useEffect(() => stopPolling, [stopPolling])

  // On mount, check if discovery is already in progress (e.g. after redirect from demo clone)
  useEffect(() => {
    if (!connection.local_path) return // not cloned yet
    let cancelled = false
    fetch(`/api/projects/${projectId}/discovery-status`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data) return
        if (data.status === 'pending' || data.status === 'in_progress') {
          // Discovery is running — start polling to show progress
          seenEmptyRef.current = data.status === 'in_progress'
          startDiscoveryPolling('scanning')
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Start polling for discovery progress
  const startDiscoveryPolling = useCallback((initialPhase: 'pulling' | 'scanning' = 'pulling') => {
    seenEmptyRef.current = false
    setDiscoveryPhase(initialPhase)
    setDiscoveryProgress({ total: 0, categorized: 0, withPreview: 0 })
    setElapsedSeconds(0)

    // Elapsed timer
    elapsedRef.current = setInterval(() => {
      setElapsedSeconds(s => s + 1)
    }, 1000)

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/discovery-status`)
        if (!res.ok) return
        const data = await res.json()

        if (data.total === 0) {
          seenEmptyRef.current = true
          setDiscoveryPhase('scanning')
        } else if (data.status === 'in_progress') {
          seenEmptyRef.current = true
          setDiscoveryProgress({ total: data.total, categorized: data.categorized, withPreview: data.withPreview })
          // Determine which sub-phase we're in
          if (data.categorized < data.total) {
            setDiscoveryPhase('categorizing')
          } else {
            setDiscoveryPhase('previewing')
          }
        } else if (data.status === 'complete' && seenEmptyRef.current) {
          stopPolling()
          setDiscoveryPhase('complete')
          setDiscoveryProgress({ total: data.total, categorized: data.categorized, withPreview: data.withPreview })
          // Refresh video previews to pick up updated component HTML
          refreshPreviews()
          setTimeout(() => {
            setDiscoveryPhase('idle')
            setSyncResult('updated')
            setTimeout(() => setSyncResult(null), 3000)
          }, 2500)
        }
      } catch {
        // ignore fetch errors
      }
    }, 2000)

    // Safety timeout — stop after 5 min
    timeoutRef.current = setTimeout(() => {
      stopPolling()
      setDiscoveryPhase('idle')
      setSyncResult('updated')
      // Refresh video previews even on timeout
      refreshPreviews()
      setTimeout(() => setSyncResult(null), 3000)
    }, 300000)
  }, [projectId, stopPolling, refreshPreviews])

  const handleSync = async () => {
    setError(null)
    setSyncResult(null)
    setIsSyncing(true)
    stopPolling()

    try {
      const result = await syncRepository(projectId)

      if (!result.success) {
        setError(result.error)
        setIsSyncing(false)
        return
      }

      setIsSyncing(false)

      if (!result.data.updated) {
        setSyncResult('current')
        setTimeout(() => setSyncResult(null), 3000)
        return
      }

      // Git had changes → discovery is running in background
      startDiscoveryPolling()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
      setIsSyncing(false)
    }
  }

  const handleClone = async () => {
    setError(null)
    setIsCloning(true)
    setDiscoveryPhase('cloning')
    setElapsedSeconds(0)
    elapsedRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    try {
      const result = await cloneConnectedRepository(projectId)
      if (!result.success) {
        setError(result.error)
        if (elapsedRef.current) clearInterval(elapsedRef.current)
        setDiscoveryPhase('idle')
        return
      }
      // Clone succeeded — discovery runs in background, start polling
      setIsCloning(false)
      if (elapsedRef.current) clearInterval(elapsedRef.current)
      startDiscoveryPolling('scanning')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clone failed')
      if (elapsedRef.current) clearInterval(elapsedRef.current)
      setDiscoveryPhase('idle')
    } finally {
      setIsCloning(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    setError(null)
    try {
      const result = await disconnectRepository(projectId)
      if (!result.success) {
        setError(result.error || 'Failed to disconnect repository')
      } else {
        // Refresh the page to reflect the disconnected state
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect repository')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const isCloned = !!connection.local_path
  const isBusy = isSyncing || isCloning || discoveryPhase !== 'idle'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5 flex-shrink-0" />
            <span className="font-medium truncate">{connection.full_name}</span>
            {connection.is_private && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded">Private</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {connection.default_branch}
            </span>
            {connection.last_synced_at && (
              <span>
                Synced {formatDistanceToNow(new Date(connection.last_synced_at), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" asChild>
            <a href={`https://github.com/${connection.full_name}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>

          {isCloned ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isBusy}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : syncResult === 'updated' ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : syncResult === 'current' ? (
                <Check className="h-4 w-4" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-1">
                {isSyncing ? 'Syncing...' : syncResult === 'updated' ? 'Updated!' : syncResult === 'current' ? 'Up to date' : 'Sync'}
              </span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClone}
              disabled={isCloning}
            >
              {isCloning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="ml-1">{isCloning ? 'Cloning...' : 'Clone'}</span>
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isDisconnecting}>
                {isDisconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect repository?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the connection to {connection.full_name} and delete any cloned files.
                  You can reconnect the repository later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDisconnect}>
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {!isCloned && discoveryPhase === 'idle' && !isSyncing && (
        <p className="text-sm text-muted-foreground">
          Click &quot;Clone&quot; to download the repository. This is required before component extraction.
        </p>
      )}

      {isCloned && discoveryPhase === 'idle' && !syncResult && !isSyncing && (
        <p className="text-sm text-muted-foreground">
          Repository cloned and ready. Click Sync to discover components.
        </p>
      )}

      {discoveryPhase !== 'idle' && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {discoveryPhase === 'complete' ? 'Discovery complete' : 'Discovering components...'}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {discoveryPhase !== 'complete' && `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`}
            </span>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {discoveryPhase === 'cloning' && (
              <DiscoveryStep
                icon={<Download className="h-3.5 w-3.5" />}
                label="Cloning repository"
                status="active"
              />
            )}
            {discoveryPhase !== 'cloning' && (
              <>
                <DiscoveryStep
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                  label="Pull latest changes"
                  status={discoveryPhase === 'pulling' ? 'active' : 'done'}
                />
                <DiscoveryStep
                  icon={<Search className="h-3.5 w-3.5" />}
                  label={
                    discoveryProgress.total > 0 && discoveryPhase === 'scanning'
                      ? `Scanning components (${discoveryProgress.total} found)`
                      : discoveryProgress.total > 0
                        ? `Found ${discoveryProgress.total} components`
                        : 'Scan for components'
                  }
                  status={discoveryPhase === 'scanning' ? 'active' : discoveryPhase === 'pulling' ? 'pending' : 'done'}
                />
                <DiscoveryStep
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  label={
                    discoveryProgress.total > 0 && (discoveryPhase === 'categorizing' || discoveryPhase === 'previewing' || discoveryPhase === 'complete')
                      ? `Categorize components (${discoveryProgress.categorized}/${discoveryProgress.total})`
                      : 'Categorize components'
                  }
                  status={discoveryPhase === 'categorizing' ? 'active' : (discoveryPhase === 'previewing' || discoveryPhase === 'complete') ? 'done' : 'pending'}
                />
                <DiscoveryStep
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  label={
                    discoveryProgress.total > 0 && (discoveryPhase === 'previewing' || discoveryPhase === 'complete')
                      ? `Generate previews (${discoveryProgress.withPreview}/${discoveryProgress.total})`
                      : 'Generate previews'
                  }
                  status={discoveryPhase === 'previewing' ? 'active' : discoveryPhase === 'complete' ? 'done' : 'pending'}
                />
              </>
            )}
          </div>

          {/* Progress bar */}
          {(discoveryPhase === 'categorizing' || discoveryPhase === 'previewing') && discoveryProgress.total > 0 && (
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{
                  width: `${discoveryPhase === 'categorizing'
                    ? (discoveryProgress.categorized / discoveryProgress.total) * 100
                    : (discoveryProgress.withPreview / discoveryProgress.total) * 100
                  }%`
                }}
              />
            </div>
          )}

          {discoveryPhase === 'complete' && (
            <p className="text-xs text-muted-foreground">
              {discoveryProgress.total} component{discoveryProgress.total !== 1 ? 's' : ''} discovered and previewed.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function DiscoveryStep({
  icon,
  label,
  status,
}: {
  icon: React.ReactNode
  label: string
  status: 'pending' | 'active' | 'done'
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex items-center justify-center h-5 w-5 rounded-full flex-shrink-0 ${
        status === 'done'
          ? 'bg-primary text-primary-foreground'
          : status === 'active'
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground'
      }`}>
        {status === 'done' ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : status === 'active' ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <span className="scale-75">{icon}</span>
        )}
      </div>
      <span className={`text-sm ${
        status === 'done'
          ? 'text-foreground'
          : status === 'active'
            ? 'text-foreground font-medium'
            : 'text-muted-foreground'
      }`}>
        {label}
      </span>
    </div>
  )
}
