'use client';

import { useCallback, useRef } from 'react';
import { useCompositionStore } from '@/lib/composition';

interface PlayheadProps {
  pixelsPerFrame: number;
}

const LABEL_COLUMN_WIDTH = 96; // w-24 track label sidebar

export function Playhead({ pixelsPerFrame }: PlayheadProps) {
  const currentFrame = useCompositionStore((s) => s.currentFrame);
  const setCurrentFrame = useCompositionStore((s) => s.setCurrentFrame);
  const durationInFrames = useCompositionStore((s) => s.durationInFrames);
  const dragging = useRef(false);

  const left = LABEL_COLUMN_WIDTH + currentFrame * pixelsPerFrame;

  const pixelToFrame = useCallback(
    (clientX: number, container: HTMLElement) => {
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left - LABEL_COLUMN_WIDTH;
      const frame = Math.round(x / pixelsPerFrame);
      return Math.max(0, Math.min(frame, durationInFrames));
    },
    [pixelsPerFrame, durationInFrames]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragging.current = true;

      // Find the scrollable timeline container (the relative parent of tracks)
      const trackArea = (e.currentTarget as HTMLElement).parentElement;
      if (!trackArea) return;

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        setCurrentFrame(pixelToFrame(ev.clientX, trackArea));
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [pixelToFrame, setCurrentFrame]
  );

  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none"
      style={{ left }}
    >
      {/* Playhead handle - this IS interactive */}
      <div
        className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-b-sm cursor-ew-resize pointer-events-auto"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
