/**
 * Timeline-specific types for drag-and-drop and zoom interactions.
 */

/**
 * Represents a snap point on the timeline (playhead, clip edges, etc.)
 */
export interface SnapPoint {
  frame: number;
  label: 'playhead' | 'clip-start' | 'clip-end' | 'timeline-start';
}

/**
 * Data attached to a draggable clip for move operations.
 */
export interface ClipDragData {
  type: 'clip';
  trackId: string;
  itemId: string;
  originalFrom: number;
}

/**
 * Data attached to a resize handle for trim operations.
 */
export interface ResizeDragData {
  type: 'resize';
  edge: 'start' | 'end';
  trackId: string;
  itemId: string;
  originalFrom: number;
  originalDuration: number;
}

/**
 * Union type for all drag data types.
 */
export type DragData = ClipDragData | ResizeDragData;

/**
 * Selection state for timeline items.
 */
export interface TimelineSelection {
  trackId: string | null;
  itemId: string | null;
}

/**
 * Timeline zoom state.
 */
export interface ZoomState {
  zoom: number;
  pixelsPerFrame: number;
}
