/**
 * Composition module exports.
 * Provides a clean import path: `import { useCompositionStore, Composition } from '@/lib/composition'`
 */

// =============================================
// Types
// =============================================

export type {
  Composition,
  Track,
  TimelineItem,
  ComponentItem,
  TextItem,
  MediaItem,
  ImageItem,
  BaseTimelineItem,
} from './types';

// =============================================
// Schemas
// =============================================

export {
  CompositionSchema,
  TrackSchema,
  TimelineItemSchema,
  ComponentItemSchema,
  TextItemSchema,
  MediaItemSchema,
  ImageItemSchema,
  BaseItemSchema,
} from './schema';

// =============================================
// Store
// =============================================

export { useCompositionStore } from './store';

// =============================================
// Hooks
// =============================================

export { useAutoSave, type SaveStatus, type AutoSaveResult } from './use-auto-save';
