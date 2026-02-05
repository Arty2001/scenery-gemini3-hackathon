'use client';

import { useMemo, useCallback } from 'react';
import { useCompositionStore } from '@/lib/composition';
import { formatTime } from '@/lib/timeline';

interface TimelineRulerProps {
  durationInFrames: number;
  fps: number;
  pixelsPerFrame: number;
}

export function TimelineRuler({
  durationInFrames,
  fps,
  pixelsPerFrame,
}: TimelineRulerProps) {
  // Calculate marker interval based on zoom level
  const { majorInterval, minorInterval } = useMemo(() => {
    // At zoom 1 (2px/frame), show markers every second
    // Adjust interval based on pixelsPerFrame to keep markers readable
    const pixelsPerSecond = pixelsPerFrame * fps;

    if (pixelsPerSecond < 30) {
      // Very zoomed out: markers every 10 seconds
      return { majorInterval: fps * 10, minorInterval: fps * 5 };
    } else if (pixelsPerSecond < 60) {
      // Zoomed out: markers every 5 seconds
      return { majorInterval: fps * 5, minorInterval: fps };
    } else if (pixelsPerSecond < 120) {
      // Normal: markers every second
      return { majorInterval: fps, minorInterval: Math.floor(fps / 2) };
    } else {
      // Zoomed in: markers every half second
      return { majorInterval: Math.floor(fps / 2), minorInterval: Math.floor(fps / 4) };
    }
  }, [pixelsPerFrame, fps]);

  // Generate marker positions
  const markers = useMemo(() => {
    const result: Array<{ frame: number; isMajor: boolean }> = [];

    for (let frame = 0; frame <= durationInFrames; frame += minorInterval) {
      const isMajor = frame % majorInterval === 0;
      result.push({ frame, isMajor });
    }

    return result;
  }, [durationInFrames, majorInterval, minorInterval]);

  const LABEL_WIDTH = 96; // must match track label sidebar w-24
  const width = LABEL_WIDTH + durationInFrames * pixelsPerFrame;
  const setCurrentFrame = useCompositionStore((s) => s.setCurrentFrame);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - LABEL_WIDTH;
      const frame = Math.round(x / pixelsPerFrame);
      setCurrentFrame(Math.max(0, Math.min(frame, durationInFrames)));
    },
    [pixelsPerFrame, durationInFrames, setCurrentFrame]
  );

  return (
    <div
      className="relative h-6 bg-muted/50 border-b select-none cursor-pointer"
      style={{ width }}
      onClick={handleClick}
    >
      {markers.map(({ frame, isMajor }) => (
        <div
          key={frame}
          className="absolute top-0"
          style={{ left: LABEL_WIDTH + frame * pixelsPerFrame }}
        >
          {/* Tick mark */}
          <div
            className={`w-px bg-border ${isMajor ? 'h-4' : 'h-2'}`}
          />
          {/* Time label for major markers */}
          {isMajor && (
            <span className="absolute top-3 left-1 text-[10px] text-muted-foreground whitespace-nowrap">
              {formatTime(frame, fps)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
