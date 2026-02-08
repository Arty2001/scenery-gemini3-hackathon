import { z } from 'zod'

// Valid Gemini model IDs (pro is default/first)
export const VALID_AI_MODELS = [
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
] as const

export type AIModelId = typeof VALID_AI_MODELS[number]

export const projectSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .nullable(),
  repo_url: z
    .string()
    .url('Invalid URL')
    .optional()
    .nullable()
    .or(z.literal('')),
  ai_model: z
    .enum(VALID_AI_MODELS)
    .optional()
    .nullable(),
})

export type ProjectInput = z.infer<typeof projectSchema>
