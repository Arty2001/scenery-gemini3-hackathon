import { ProjectForm } from '@/components/projects/project-form'

export default function NewProjectPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Create project</h2>
        <p className="text-muted-foreground">
          Start a new video project
        </p>
      </div>
      <ProjectForm mode="create" />
    </div>
  )
}
