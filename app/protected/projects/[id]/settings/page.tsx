import { getProject, deleteProject } from '@/lib/actions/projects'
import { ProjectForm } from '@/components/projects/project-form'
import { redirect, notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface SettingsPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectSettingsPage({ params }: SettingsPageProps) {
  const { id } = await params
  const result = await getProject(id)

  if (!result.success || !result.data) {
    notFound()
  }

  const project = result.data

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Project settings</h2>
        <p className="text-muted-foreground">
          Manage your project details
        </p>
      </div>

      <ProjectForm
        mode="edit"
        projectId={id}
        defaultValues={{
          name: project.name,
          description: project.description,
          repo_url: project.repo_url,
        }}
      />

      <div className="border-t pt-8">
        <h3 className="text-lg font-semibold text-destructive">Danger zone</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Permanently delete this project and all of its data.
        </p>
        <form
          action={async () => {
            'use server'
            await deleteProject(id)
            redirect('/protected')
          }}
        >
          <Button type="submit" variant="destructive">
            Delete project
          </Button>
        </form>
      </div>
    </div>
  )
}
