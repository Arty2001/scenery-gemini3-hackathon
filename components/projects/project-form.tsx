'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { projectSchema, type ProjectInput, VALID_AI_MODELS, type AIModelId } from '@/lib/validations/project'
import { createProject, updateProject } from '@/lib/actions/projects'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Model display info
const MODEL_INFO: Record<AIModelId, { name: string; description: string }> = {
  'gemini-3-pro-preview': {
    name: 'Gemini 3 Pro',
    description: 'Most capable model for complex reasoning',
  },
  'gemini-3-flash-preview': {
    name: 'Gemini 3 Flash',
    description: 'Fast, efficient model for most tasks',
  },
}

interface ProjectFormProps {
  mode: 'create' | 'edit'
  projectId?: string
  defaultValues?: {
    name?: string
    description?: string | null
    repo_url?: string | null
    ai_model?: string | null
  }
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
      ai_model: (defaultValues?.ai_model as AIModelId) ?? 'gemini-3-pro-preview',
    },
  })

  const onSubmit = async (data: ProjectInput) => {
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData()
    formData.set('name', data.name)
    formData.set('description', data.description ?? '')
    formData.set('repo_url', data.repo_url ?? '')
    formData.set('ai_model', data.ai_model ?? 'gemini-3-pro-preview')

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

      <div className="space-y-2">
        <Label htmlFor="ai_model">AI Model</Label>
        <select
          id="ai_model"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          {...register('ai_model')}
        >
          {VALID_AI_MODELS.map((modelId) => {
            const info = MODEL_INFO[modelId];
            return (
              <option key={modelId} value={modelId}>
                {info?.name ?? modelId} - {info?.description ?? ''}
              </option>
            );
          })}
        </select>
        {errors.ai_model && (
          <p className="text-sm text-destructive">{errors.ai_model.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Select which Gemini model to use for AI features in this project
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
