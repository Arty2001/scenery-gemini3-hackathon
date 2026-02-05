import { getProjects } from '@/lib/actions/projects'
import { ProjectList } from '@/components/projects/project-list'
import { EmptyState } from '@/components/projects/empty-state'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function DashboardPage() {
  const result = await getProjects()

  if (!result.success) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive">{result.error}</p>
      </div>
    )
  }

  const projects = result.data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
          <p className="text-muted-foreground">
            Your video projects
          </p>
        </div>
        {projects.length > 0 && (
          <Button asChild>
            <Link href="/protected/projects/new">New project</Link>
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <ProjectList projects={projects} />
      )}
    </div>
  )
}
