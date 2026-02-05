/**
 * Zod validation schemas for the composition system.
 * Provides runtime validation for composition data.
 */

import { z } from 'zod';

// =============================================
// Base Item Schema
// =============================================

/**
 * Shared fields for all timeline items.
 */
// =============================================
// Animation Schemas
// =============================================

export const animationConfigSchema = z.object({
  type: z.enum(['none', 'fade', 'slide', 'scale']),
  direction: z.enum(['left', 'right', 'top', 'bottom']).optional(),
  durationInFrames: z.number().int().positive().optional(),
});

export const transitionConfigSchema = z.object({
  type: z.enum(['fade', 'slide']),
  direction: z.enum(['left', 'right', 'top', 'bottom']).optional(),
  durationInFrames: z.number().int().positive(),
});

export const cursorKeyframeSchema = z.object({
  frame: z.number().int().min(0),
  x: z.number(),
  y: z.number(),
  click: z.boolean().optional(),
});

export const BaseItemSchema = z.object({
  id: z.string().uuid(),
  from: z.number().int().min(0),
  durationInFrames: z.number().int().positive(),
  enterAnimation: animationConfigSchema.optional(),
  exitAnimation: animationConfigSchema.optional(),
  transitionIn: transitionConfigSchema.optional(),
});

// =============================================
// Item Type Schemas
// =============================================

/**
 * Component item - user's React component from discovered_components.
 */
export const ComponentItemSchema = BaseItemSchema.extend({
  type: z.literal('component'),
  componentId: z.string().uuid(),
  props: z.record(z.string(), z.unknown()),
});

/**
 * Text overlay item.
 */
export const TextItemSchema = BaseItemSchema.extend({
  type: z.literal('text'),
  text: z.string(),
  fontFamily: z.string(),
  fontSize: z.number().positive(),
  color: z.string(),
  position: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }),
  fontWeight: z.number().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  backgroundColor: z.string().optional(),
  padding: z.number().optional(),
});

/**
 * Media item - video or audio.
 */
export const MediaItemSchema = BaseItemSchema.extend({
  type: z.enum(['video', 'audio']),
  src: z.string().url(),
  volume: z.number().min(0).max(1),
  startFrom: z.number().int().min(0),
});

/**
 * Image item - static image on the timeline.
 */
export const ImageItemSchema = BaseItemSchema.extend({
  type: z.literal('image'),
  src: z.string().url(),
});

/**
 * Union of all timeline item types.
 * Discriminated on 'type' field for efficient parsing.
 */
/**
 * Cursor item - animated cursor overlay.
 */
export const CursorItemSchema = BaseItemSchema.extend({
  type: z.literal('cursor'),
  keyframes: z.array(cursorKeyframeSchema),
  cursorStyle: z.enum(['pointer', 'default', 'hand']).optional(),
  clickEffect: z.enum(['ripple', 'highlight', 'none']).optional(),
  scale: z.number().positive().optional(),
});

export const TimelineItemSchema = z.discriminatedUnion('type', [
  ComponentItemSchema,
  TextItemSchema,
  MediaItemSchema,
  ImageItemSchema,
  CursorItemSchema,
]);

// =============================================
// Track Schema
// =============================================

/**
 * Track containing timeline items.
 */
export const TrackSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['component', 'text', 'video', 'audio', 'image', 'cursor']),
  locked: z.boolean(),
  visible: z.boolean(),
  items: z.array(TimelineItemSchema),
});

// =============================================
// Composition Schema
// =============================================

/**
 * Full composition schema.
 */
export const CompositionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  tracks: z.array(TrackSchema),
  durationInFrames: z.number().int().positive(),
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// =============================================
// Inferred Types (re-export for convenience)
// =============================================

export type AnimationConfigSchema = z.infer<typeof animationConfigSchema>;
export type TransitionConfigSchema = z.infer<typeof transitionConfigSchema>;
export type CursorKeyframeSchema = z.infer<typeof cursorKeyframeSchema>;
export type CursorItemSchema = z.infer<typeof CursorItemSchema>;
export type ComponentItemSchema = z.infer<typeof ComponentItemSchema>;
export type TextItemSchema = z.infer<typeof TextItemSchema>;
export type MediaItemSchema = z.infer<typeof MediaItemSchema>;
export type ImageItemSchema = z.infer<typeof ImageItemSchema>;
export type TimelineItemSchema = z.infer<typeof TimelineItemSchema>;
export type TrackSchema = z.infer<typeof TrackSchema>;
export type CompositionSchema = z.infer<typeof CompositionSchema>;
