'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { projectSchema, type ProjectInput } from '@/lib/validations/project'
import { createProject, updateProject } from '@/lib/actions/projects'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface ProjectFormProps {
  mode: 'create' | 'edit'
  projectId?: string
  defaultValues?: Partial<ProjectInput>
}

export function ProjectForm({ mode, projectId, defaultValues }: ProjectFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      repo_url: defaultValues?.repo_url ?? '',
    },
  })

  const onSubmit = async (data: ProjectInput) => {
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData()
    formData.set('name', data.name)
    formData.set('description', data.description ?? '')
    formData.set('repo_url', data.repo_url ?? '')

    const result = mode === 'create'
      ? await createProject(formData)
      : await updateProject(projectId!, formData)

    if (result.success) {
      if (mode === 'create' && 'data' in result && result.data) {
        router.push(`/protected/projects/${result.data.id}`)
      } else {
        router.push('/protected')
      }
    } else {
      setError(result.error)
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Project name *</Label>
        <Input
          id="name"
          placeholder="My awesome demo"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          placeholder="A short description of your video"
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="repo_url">Repository URL</Label>
        <Input
          id="repo_url"
          placeholder="https://github.com/username/repo"
          {...register('repo_url')}
        />
        {errors.repo_url && (
          <p className="text-sm text-destructive">{errors.repo_url.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Connect a GitHub repository to use its components in your video
        </p>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create project' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
