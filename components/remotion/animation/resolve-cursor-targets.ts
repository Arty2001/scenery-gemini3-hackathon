/**
 * Resolves cursor target selectors to actual screen positions.
 *
 * Finds elements matching CSS selectors in component previews and returns
 * their center positions in composition coordinates.
 */

import type { CursorKeyframe, Track, ComponentItem } from '@/lib/composition/types';

export interface ResolvedPosition {
  x: number;
  y: number;
  /** Whether the target was found (false = used fallback position) */
  found: boolean;
}

export interface CursorTargetContext {
  /** Map of componentId → container ref */
  componentRefs: Map<string, HTMLElement | null>;
  /** Composition dimensions */
  compositionWidth: number;
  compositionHeight: number;
  /** Preview container ref (the entire remotion player area) */
  previewContainerRef: HTMLElement | null;
}

/**
 * Resolves a cursor target selector to a position in composition coordinates.
 *
 * @param target - CSS selector to find
 * @param targetOffset - Optional offset from element center
 * @param context - References to component containers and dimensions
 * @param fallbackX - X position to use if target not found
 * @param fallbackY - Y position to use if target not found
 */
export function resolveCursorTarget(
  target: string,
  targetOffset: { x: number; y: number } | undefined,
  context: CursorTargetContext,
  fallbackX: number,
  fallbackY: number
): ResolvedPosition {
  const { componentRefs, previewContainerRef, compositionWidth, compositionHeight } = context;

  // If no target specified, use manual coordinates
  if (!target) {
    return { x: fallbackX, y: fallbackY, found: false };
  }

  // Search all component containers for the target element
  for (const [, containerEl] of componentRefs) {
    if (!containerEl) continue;

    try {
      const targetEl = containerEl.querySelector(target);
      if (!targetEl) continue;

      // Found the element! Get its bounding rect
      const targetRect = targetEl.getBoundingClientRect();

      // Get the preview container rect to calculate relative position
      if (!previewContainerRef) {
        console.warn('[resolveCursorTarget] No preview container ref');
        continue;
      }

      const containerRect = previewContainerRef.getBoundingClientRect();

      // Calculate center of element relative to preview container
      const centerX = targetRect.left + targetRect.width / 2 - containerRect.left;
      const centerY = targetRect.top + targetRect.height / 2 - containerRect.top;

      // Scale to composition coordinates
      const scaleX = compositionWidth / containerRect.width;
      const scaleY = compositionHeight / containerRect.height;

      let x = centerX * scaleX;
      let y = centerY * scaleY;

      // Apply offset if specified
      if (targetOffset) {
        x += targetOffset.x;
        y += targetOffset.y;
      }

      console.log(`[resolveCursorTarget] Found "${target}" at (${x.toFixed(0)}, ${y.toFixed(0)})`);
      return { x, y, found: true };
    } catch (err) {
      // Invalid selector or other error
      console.warn(`[resolveCursorTarget] Error finding "${target}":`, err);
    }
  }

  console.warn(`[resolveCursorTarget] Target "${target}" not found, using fallback`);
  return { x: fallbackX, y: fallbackY, found: false };
}

/**
 * Get component items that are visible at a given frame.
 */
export function getVisibleComponentItems(tracks: Track[], frame: number): ComponentItem[] {
  const components: ComponentItem[] = [];

  for (const track of tracks) {
    if (track.type !== 'component' || track.visible === false) continue;

    for (const item of track.items) {
      if (item.type !== 'component') continue;
      if (frame >= item.from && frame < item.from + item.durationInFrames) {
        components.push(item);
      }
    }
  }

  return components;
}

/**
 * Pre-resolve all cursor keyframe targets for a composition.
 * Call this in a useEffect to update positions when components change.
 *
 * Returns a map of "cursorId:keyframeFrame" → resolved position
 */
export function resolveAllCursorTargets(
  tracks: Track[],
  context: CursorTargetContext
): Map<string, ResolvedPosition> {
  const resolved = new Map<string, ResolvedPosition>();
  const { compositionWidth, compositionHeight } = context;

  for (const track of tracks) {
    if (track.type !== 'cursor') continue;

    for (const item of track.items) {
      if (item.type !== 'cursor') continue;

      for (const kf of item.keyframes) {
        const key = `${item.id}:${kf.frame}`;

        if (kf.target) {
          const position = resolveCursorTarget(
            kf.target,
            kf.targetOffset,
            context,
            kf.x ?? compositionWidth / 2,
            kf.y ?? compositionHeight / 2
          );
          resolved.set(key, position);
        } else if (kf.x != null && kf.y != null) {
          resolved.set(key, { x: kf.x, y: kf.y, found: true });
        }
      }
    }
  }

  return resolved;
}
