/**
 * Custom dnd-kit modifier for snapping to timeline points.
 */

import type { Modifier } from '@dnd-kit/core';
import type { SnapPoint } from './types';

const DEFAULT_SNAP_THRESHOLD = 10; // pixels

/**
 * Creates a dnd-kit modifier that snaps to specified points.
 *
 * @param snapPoints Array of snap point frames
 * @param pixelsPerFrame Current zoom level
 * @param threshold Snap distance in pixels (default 10)
 */
export function createSnapToPointsModifier(
  snapPoints: SnapPoint[],
  pixelsPerFrame: number,
  threshold: number = DEFAULT_SNAP_THRESHOLD
): Modifier {
  return ({ transform, active }) => {
    if (!active?.data?.current) {
      return transform;
    }

    const data = active.data.current as { originalFrom?: number };
    if (data.originalFrom === undefined) {
      return transform;
    }

    // Current clip position in pixels (original + delta)
    const currentPixelPosition = data.originalFrom * pixelsPerFrame + transform.x;

    // Convert to frame
    const currentFrame = currentPixelPosition / pixelsPerFrame;

    // Find closest snap point within threshold
    let closestPoint: SnapPoint | null = null;
    let closestDistance = threshold / pixelsPerFrame; // Convert threshold to frames

    for (const point of snapPoints) {
      const distance = Math.abs(currentFrame - point.frame);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPoint = point;
      }
    }

    // If we found a snap point, adjust transform
    if (closestPoint) {
      const targetPixels = closestPoint.frame * pixelsPerFrame;
      const originalPixels = data.originalFrom * pixelsPerFrame;
      const snappedX = targetPixels - originalPixels;

      return {
        ...transform,
        x: snappedX,
      };
    }

    return transform;
  };
}

export { DEFAULT_SNAP_THRESHOLD };
