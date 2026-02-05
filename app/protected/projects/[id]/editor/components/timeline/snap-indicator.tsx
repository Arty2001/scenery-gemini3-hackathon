'use client';

/**
 * Visual indicator shown when a clip is snapping to a point.
 * Renders a yellow vertical line with a label at the snap location.
 */

import type { SnapPoint } from '@/lib/timeline';

interface SnapIndicatorProps {
  activeSnapPoint: SnapPoint | null;
  pixelsPerFrame: number;
}

export function SnapIndicator({
  activeSnapPoint,
  pixelsPerFrame,
}: SnapIndicatorProps) {
  if (!activeSnapPoint) return null;

  const left = activeSnapPoint.frame * pixelsPerFrame;

  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-40 pointer-events-none"
      style={{ left }}
    >
      {/* Snap label at top */}
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-yellow-400 text-yellow-950 text-[10px] font-medium rounded whitespace-nowrap">
        {activeSnapPoint.label === 'playhead' && 'Playhead'}
        {activeSnapPoint.label === 'clip-start' && 'Clip Start'}
        {activeSnapPoint.label === 'clip-end' && 'Clip End'}
        {activeSnapPoint.label === 'timeline-start' && 'Start'}
      </div>
    </div>
  );
}
