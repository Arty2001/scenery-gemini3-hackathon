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

// Video role determines how the component should be showcased
export const VIDEO_ROLES = ['hero', 'supporting', 'detail'] as const;
export type VideoRole = typeof VIDEO_ROLES[number];

// Device frames for displaying components
export const DEVICE_FRAMES = ['phone', 'laptop', 'tablet', 'none'] as const;
export type DeviceFrame = typeof DEVICE_FRAMES[number];

export const categorySchema = z.object({
  primary: z.enum(COMPONENT_CATEGORIES).describe('Primary UI category'),
  secondary: z.array(z.string()).optional().describe('Additional categories if applicable'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  reasoning: z.string().describe('Brief explanation for categorization'),
  // Video-specific fields for Director/Scene Planner
  videoRole: z.enum(VIDEO_ROLES).describe('Role in video: hero (full-screen showcase), supporting (shown in context), detail (close-up feature)'),
  suggestedDuration: z.number().min(60).max(360).describe('Suggested screen time in frames (60-360, where 30f = 1s)'),
  suggestedDeviceFrame: z.enum(DEVICE_FRAMES).describe('Best device frame for display'),
  visualWeight: z.enum(['heavy', 'medium', 'light']).describe('Visual prominence: heavy (full layouts), medium (cards/modals), light (buttons/inputs)'),
});

export type CategoryResult = z.infer<typeof categorySchema>;

export const demoPropsSchema = z.object({
  props: z.record(z.string(), z.unknown()).describe('Props values that produce realistic preview'),
  notes: z.string().optional().describe('Any caveats about these demo props'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence in props quality'),
  // New fields for cursor targeting
  interactiveElements: z.array(z.object({
    selector: z.string().describe('CSS selector for the element'),
    action: z.enum(['click', 'hover', 'type', 'focus', 'select', 'check']).describe('Interaction type'),
    description: z.string().describe('What this element does'),
    sampleValue: z.string().optional().describe('For type/select: sample value to enter'),
  })).optional().describe('Interactive elements for cursor tutorials'),
  suggestedState: z.string().optional().describe('For stateful components: which state to show and why'),
});

export type DemoPropsResult = z.infer<typeof demoPropsSchema>;

export const previewHtmlSchema = z.object({
  html: z.string().describe('Self-contained HTML snippet with inline styles that visually represents the component'),
});

export type PreviewHtmlResult = z.infer<typeof previewHtmlSchema>;
