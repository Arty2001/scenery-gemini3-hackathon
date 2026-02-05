'use client';

/**
 * Media controls for video, audio, and image timeline items.
 * Provides trim start, volume, position, size, and clip shape controls.
 */

import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MediaItem, ImageItem, TimelineItem } from '@/lib/composition/types';

// =============================================
// Types
// =============================================

interface MediaControlsProps {
  item: MediaItem | ImageItem;
  fps: number;
  onUpdate: (updates: Partial<TimelineItem>) => void;
}

const CLIP_SHAPES = [
  { value: 'none', label: 'None' },
  { value: 'circle', label: 'Circle' },
  { value: 'rounded-rect', label: 'Rounded' },
  { value: 'hexagon', label: 'Hex' },
  { value: 'diamond', label: 'Diamond' },
] as const;

// =============================================
// Component
// =============================================

export function MediaControls({ item, fps, onUpdate }: MediaControlsProps) {
  const isVideoOrAudio = item.type === 'video' || item.type === 'audio';
  const mediaItem = isVideoOrAudio ? (item as MediaItem) : null;
  const currentClip = item.clipShape ?? 'none';
  const posX = item.position?.x ?? 0.5;
  const posY = item.position?.y ?? 0.5;
  const w = item.width ?? 1.0;
  const h = item.height ?? 1.0;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Media</h3>

      {/* Volume control (video/audio only) */}
      {mediaItem && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Volume</Label>
            <span className="text-xs text-muted-foreground">{Math.round(mediaItem.volume * 100)}%</span>
          </div>
          <Slider
            value={[Math.round(mediaItem.volume * 100)]}
            min={0}
            max={100}
            step={1}
            onValueChange={([value]) => onUpdate({ volume: value / 100 })}
          />
        </div>
      )}

      {/* Trim Start control (video/audio only) */}
      {mediaItem && (
        <div className="space-y-2">
          <Label className="text-xs">Trim Start</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              step={0.1}
              value={(mediaItem.startFrom / fps).toFixed(1)}
              onChange={(e) => {
                const seconds = parseFloat(e.target.value);
                if (!isNaN(seconds)) {
                  onUpdate({ startFrom: Math.max(0, Math.round(seconds * fps)) });
                }
              }}
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}

      {/* Position */}
      <div className="space-y-2">
        <Label className="text-xs">Position</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">X</Label>
            <Input
              type="number"
              min={0} max={1} step={0.05}
              value={posX.toFixed(2)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) onUpdate({ position: { x: Math.max(0, Math.min(1, v)), y: posY } } as Partial<TimelineItem>);
              }}
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Y</Label>
            <Input
              type="number"
              min={0} max={1} step={0.05}
              value={posY.toFixed(2)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) onUpdate({ position: { x: posX, y: Math.max(0, Math.min(1, v)) } } as Partial<TimelineItem>);
              }}
              className="h-7 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Size */}
      <div className="space-y-2">
        <Label className="text-xs">Size</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">Width</Label>
            <Input
              type="number"
              min={0.05} max={2} step={0.05}
              value={w.toFixed(2)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) onUpdate({ width: Math.max(0.05, v) } as Partial<TimelineItem>);
              }}
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Height</Label>
            <Input
              type="number"
              min={0.05} max={2} step={0.05}
              value={h.toFixed(2)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) onUpdate({ height: Math.max(0.05, v) } as Partial<TimelineItem>);
              }}
              className="h-7 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Clip Shape */}
      <div className="space-y-2">
        <Label className="text-xs">Clip Shape</Label>
        <div className="flex flex-wrap gap-1">
          {CLIP_SHAPES.map(({ value, label }) => (
            <Button
              key={value}
              variant="outline"
              size="sm"
              className={cn(
                'h-7 text-xs px-2',
                currentClip === value && 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
              onClick={() => onUpdate({ clipShape: value } as Partial<TimelineItem>)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Source display */}
      <div className="space-y-2">
        <Label className="text-xs">Source</Label>
        <p className="text-xs text-muted-foreground truncate" title={item.src}>
          {item.src}
        </p>
      </div>
    </div>
  );
}
