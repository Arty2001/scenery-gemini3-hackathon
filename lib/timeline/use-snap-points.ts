'use client';

/**
 * Hook to calculate snap points from current composition state.
 * Returns array of frames where snapping should occur (playhead, clip edges, etc.)
 */

import { useMemo } from 'react';
import { useCompositionStore } from '@/lib/composition';
import type { SnapPoint } from './types';

/**
 * Calculate snap points from current tracks and playhead position.
 * Returns array of frames where snapping should occur.
 */
export function useSnapPoints(): SnapPoint[] {
  const tracks = useCompositionStore((s) => s.tracks);
  const currentFrame = useCompositionStore((s) => s.currentFrame);
  const durationInFrames = useCompositionStore((s) => s.durationInFrames);

  return useMemo(() => {
    const points: SnapPoint[] = [];

    // Always snap to timeline start
    points.push({ frame: 0, label: 'timeline-start' });

    // Snap to playhead
    points.push({ frame: currentFrame, label: 'playhead' });

    // Snap to end of composition
    points.push({ frame: durationInFrames, label: 'clip-end' });

    // Collect all clip edges
    for (const track of tracks) {
      for (const item of track.items) {
        // Snap to clip start
        points.push({ frame: item.from, label: 'clip-start' });

        // Snap to clip end
        points.push({ frame: item.from + item.durationInFrames, label: 'clip-end' });
      }
    }

    // Remove duplicates (same frame may appear multiple times)
    const uniqueFrames = new Map<number, SnapPoint>();
    for (const point of points) {
      if (!uniqueFrames.has(point.frame)) {
        uniqueFrames.set(point.frame, point);
      }
    }

    return Array.from(uniqueFrames.values());
  }, [tracks, currentFrame, durationInFrames]);
}
