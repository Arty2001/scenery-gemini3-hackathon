import { z } from 'zod'

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
})

export type ProjectInput = z.infer<typeof projectSchema>
