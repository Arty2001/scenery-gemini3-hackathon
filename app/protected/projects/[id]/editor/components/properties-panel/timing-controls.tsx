'use client';

import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TimelineItem } from '@/lib/composition/types';

interface TimingControlsProps {
  item: TimelineItem;
  fps: number;
  onUpdate: (updates: Partial<TimelineItem>) => void;
}

export function TimingControls({ item, fps, onUpdate }: TimingControlsProps) {
  // Convert frames to seconds for display
  const startSeconds = item.from / fps;
  const durationSeconds = item.durationInFrames / fps;
  const endSeconds = (item.from + item.durationInFrames) / fps;

  const handleStartChange = useCallback(
    (value: string) => {
      const newSeconds = parseFloat(value);
      if (isNaN(newSeconds)) return;

      const newFrom = Math.max(0, Math.round(newSeconds * fps));
      onUpdate({ from: newFrom });
    },
    [fps, onUpdate]
  );

  const handleDurationChange = useCallback(
    (value: string) => {
      const newSeconds = parseFloat(value);
      if (isNaN(newSeconds)) return;

      const newDuration = Math.max(1, Math.round(newSeconds * fps));
      onUpdate({ durationInFrames: newDuration });
    },
    [fps, onUpdate]
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Timing</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Start time */}
        <div className="space-y-1.5">
          <Label htmlFor="start-time" className="text-xs">
            Start (seconds)
          </Label>
          <Input
            id="start-time"
            type="number"
            step="0.1"
            min="0"
            defaultValue={startSeconds.toFixed(2)}
            key={`start-${item.id}-${item.from}`}
            onBlur={(e) => handleStartChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleStartChange(e.currentTarget.value);
                e.currentTarget.blur();
              }
            }}
            className="h-8"
          />
        </div>

        {/* Duration */}
        <div className="space-y-1.5">
          <Label htmlFor="duration" className="text-xs">
            Duration (seconds)
          </Label>
          <Input
            id="duration"
            type="number"
            step="0.1"
            min="0.1"
            defaultValue={durationSeconds.toFixed(2)}
            key={`duration-${item.id}-${item.durationInFrames}`}
            onBlur={(e) => handleDurationChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleDurationChange(e.currentTarget.value);
                e.currentTarget.blur();
              }
            }}
            className="h-8"
          />
        </div>
      </div>

      {/* End time display (read-only) */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>End: {endSeconds.toFixed(2)}s</span>
        <span>
          Frames: {item.from} - {item.from + item.durationInFrames}
        </span>
      </div>
    </div>
  );
}
