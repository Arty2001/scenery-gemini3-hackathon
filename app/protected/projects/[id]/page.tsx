import { getProject } from '@/lib/actions/projects'
import { getRepositoryConnection, type RepositoryConnection } from '@/lib/actions/github'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Video, PackageOpen, LogIn, Github } from 'lucide-react'
import { isDemoProject } from '@/lib/demo-projects'
import { createClient } from '@/lib/supabase/server'
import { ConnectRepoSection, RepoStatus } from '@/components/github'

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

function getDemoConnection(project: { id: string; repo_url: string | null }): RepositoryConnection | null {
  if (!project.repo_url) return null
  const match = project.repo_url.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) return null
  return {
    id: `demo-conn-${project.id}`,
    project_id: project.id,
    owner: match[1],
    name: match[2],
    full_name: `${match[1]}/${match[2]}`,
    default_branch: 'main',
    is_private: false,
    clone_url: `${project.repo_url}.git`,
    local_path: null,
    last_synced_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params
  const projectResult = await getProject(id)

  if (!projectResult.success || !projectResult.data) {
    notFound()
  }

  const project = projectResult.data
  const isDemo = isDemoProject(id)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // For demo projects, synthesize connection from repo_url; for real projects, fetch from DB
  let connection: RepositoryConnection | null = null
  if (isDemo) {
    connection = getDemoConnection(project)
  } else {
    const repoResult = await getRepositoryConnection(id)
    connection = repoResult.success ? repoResult.data : null
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button asChild>
          <Link href={`/protected/projects/${id}/editor`}>
            <Video className="h-4 w-4 mr-2" />
            Video Editor
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/protected/projects/${id}/components`}>
            <PackageOpen className="h-4 w-4 mr-2" />
            Components
          </Link>
        </Button>
      </div>

      {/* Repository Connection Section */}
      <div className="border rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Github className="h-5 w-5" />
          Repository
        </h3>

        {connection ? (
          <RepoStatus connection={connection} projectId={id} />
        ) : (
          <ConnectRepoSection projectId={id} />
        )}
      </div>

      {/* Sign in prompt for anonymous users */}
      {!user && (
        <div className="border rounded-lg p-6 bg-muted/50 flex items-center justify-between">
          <div>
            <p className="font-medium">Want to use your own projects?</p>
            <p className="text-sm text-muted-foreground">
              Sign in to connect your GitHub repos and create personal projects.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/auth/login">
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
