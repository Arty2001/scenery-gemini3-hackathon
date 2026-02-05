import { z } from 'zod';

// Helper to convert Zod schemas to JSON Schema for Gemini structured outputs
// Uses Zod v4's built-in toJSONSchema (no need for external zod-to-json-schema package)
export function toJsonSchema<T extends z.ZodType>(schema: T): object {
  return z.toJSONSchema(schema);
}

// Category options based on common UI patterns
export const COMPONENT_CATEGORIES = [
  'button', 'input', 'form', 'card', 'modal', 'dialog',
  'navigation', 'menu', 'header', 'footer', 'sidebar',
  'table', 'list', 'grid', 'layout', 'container',
  'alert', 'notification', 'toast', 'badge', 'tag',
  'avatar', 'icon', 'image', 'media', 'video',
  'loading', 'skeleton', 'progress', 'spinner',
  'tab', 'accordion', 'collapse', 'dropdown',
  'tooltip', 'popover', 'overlay',
  'chart', 'graph', 'visualization',
  'typography', 'text', 'heading',
  'divider', 'separator', 'spacer',
  'hero', 'pricing', 'testimonial', 'feature',
  'utility', 'other'
] as const;

export type ComponentCategory = typeof COMPONENT_CATEGORIES[number];

export const categorySchema = z.object({
  primary: z.enum(COMPONENT_CATEGORIES).describe('Primary UI category'),
  secondary: z.array(z.string()).optional().describe('Additional categories if applicable'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  reasoning: z.string().describe('Brief explanation for categorization'),
});

export type CategoryResult = z.infer<typeof categorySchema>;

export const demoPropsSchema = z.object({
  props: z.record(z.string(), z.unknown()).describe('Props values that produce realistic preview'),
  notes: z.string().optional().describe('Any caveats about these demo props'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence in props quality'),
});

export type DemoPropsResult = z.infer<typeof demoPropsSchema>;

export const previewHtmlSchema = z.object({
  html: z.string().describe('Self-contained HTML snippet with inline styles that visually represents the component'),
});

export type PreviewHtmlResult = z.infer<typeof previewHtmlSchema>;
