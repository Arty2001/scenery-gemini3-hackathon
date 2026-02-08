'use client';

/**
 * Media controls for video, audio, and image timeline items.
 * Provides trim start, volume, position, size, clip shape controls,
 * and an asset picker to select from uploaded project assets.
 */

import { useEffect, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Move, ChevronDown, Image, Video, Music, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MediaItem, ImageItem, TimelineItem } from '@/lib/composition/types';
import { listProjectAssets, type ProjectAsset } from '@/lib/actions/assets';

// =============================================
// Types
// =============================================

interface MediaControlsProps {
  item: MediaItem | ImageItem;
  fps: number;
  projectId: string;
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

export function MediaControls({ item, fps, projectId, onUpdate }: MediaControlsProps) {
  const isVideoOrAudio = item.type === 'video' || item.type === 'audio';
  const mediaItem = isVideoOrAudio ? (item as MediaItem) : null;
  const currentClip = item.clipShape ?? 'none';
  const posX = item.position?.x ?? 0.5;
  const posY = item.position?.y ?? 0.5;
  const w = item.width ?? 1.0;
  const h = item.height ?? 1.0;

  // Asset picker state
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);

  // Filter assets based on item type
  const filteredAssets = assets.filter((asset) => {
    if (item.type === 'image') return asset.type === 'image';
    if (item.type === 'video') return asset.type === 'video';
    if (item.type === 'audio') return asset.type === 'audio';
    return true;
  });

  // Fetch assets when picker is opened
  useEffect(() => {
    if (showAssetPicker && assets.length === 0) {
      setLoadingAssets(true);
      listProjectAssets(projectId)
        .then(setAssets)
        .finally(() => setLoadingAssets(false));
    }
  }, [showAssetPicker, projectId, assets.length]);

  // Get icon for asset type
  const getAssetIcon = (type: ProjectAsset['type']) => {
    switch (type) {
      case 'image':
        return <Image className="h-3.5 w-3.5" />;
      case 'video':
        return <Video className="h-3.5 w-3.5" />;
      case 'audio':
        return <Music className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  // Get current filename from src
  const currentFileName = item.src.split('/').pop() || item.src;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Media</h3>

      {/* Source selector */}
      <div className="space-y-2">
        <Label className="text-xs">Source</Label>
        <div className="relative">
          <button
            onClick={() => setShowAssetPicker(!showAssetPicker)}
            className="w-full flex items-center justify-between gap-2 h-8 px-2 text-xs rounded-md border bg-background hover:bg-accent transition-colors"
          >
            <span className="truncate flex-1 text-left" title={item.src}>
              {currentFileName}
            </span>
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", showAssetPicker && "rotate-180")} />
          </button>

          {showAssetPicker && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
              {loadingAssets ? (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading assets...
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No {item.type}s uploaded yet
                </div>
              ) : (
                filteredAssets.map((asset) => (
                  <button
                    key={asset.url}
                    onClick={() => {
                      onUpdate({ src: asset.url } as Partial<TimelineItem>);
                      setShowAssetPicker(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent transition-colors",
                      asset.url === item.src && "bg-accent"
                    )}
                  >
                    {getAssetIcon(asset.type)}
                    <span className="truncate">{asset.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Use Import Media to upload new files
        </p>
      </div>

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
          <Label className="text-xs">Trim Start (seconds)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              step={0.1}
              defaultValue={(mediaItem.startFrom / fps).toFixed(1)}
              key={`trimStart-${item.id}-${mediaItem.startFrom}`}
              onBlur={(e) => {
                const seconds = parseFloat(e.target.value);
                if (!isNaN(seconds)) {
                  onUpdate({ startFrom: Math.max(0, Math.round(seconds * fps)) });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const seconds = parseFloat(e.currentTarget.value);
                  if (!isNaN(seconds)) {
                    onUpdate({ startFrom: Math.max(0, Math.round(seconds * fps)) });
                  }
                  e.currentTarget.blur();
                }
              }}
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}

      {/* Freeze at End (video only) */}
      {item.type === 'video' && mediaItem && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Freeze Last Frame</Label>
              <p className="text-[10px] text-muted-foreground">Hold last frame when clip is longer than video</p>
            </div>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border"
              checked={mediaItem.freezeAtEnd ?? false}
              onChange={(e) => onUpdate({ freezeAtEnd: e.target.checked })}
            />
          </div>
          {mediaItem.freezeAtEnd && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Video End (seconds)</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                placeholder="Auto-detect"
                defaultValue={mediaItem.endAt ? (mediaItem.endAt / fps).toFixed(1) : ''}
                key={`endAt-${item.id}-${mediaItem.endAt}`}
                onBlur={(e) => {
                  const seconds = parseFloat(e.target.value);
                  if (!isNaN(seconds) && seconds > 0) {
                    onUpdate({ endAt: Math.round(seconds * fps) });
                  } else if (e.target.value === '') {
                    onUpdate({ endAt: undefined });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const seconds = parseFloat(e.currentTarget.value);
                    if (!isNaN(seconds) && seconds > 0) {
                      onUpdate({ endAt: Math.round(seconds * fps) });
                    }
                    e.currentTarget.blur();
                  }
                }}
                className="h-7 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Enter the video's actual duration in seconds
              </p>
            </div>
          )}
        </div>
      )}

      {/* Position */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Move className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs">Position</Label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-muted-foreground">X</Label>
              <span className="text-xs text-muted-foreground font-mono">
                {Math.round(posX * 100)}%
              </span>
            </div>
            <Slider
              value={[posX * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => onUpdate({ position: { x: v / 100, y: posY } } as Partial<TimelineItem>)}
              className="h-4"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-muted-foreground">Y</Label>
              <span className="text-xs text-muted-foreground font-mono">
                {Math.round(posY * 100)}%
              </span>
            </div>
            <Slider
              value={[posY * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => onUpdate({ position: { x: posX, y: v / 100 } } as Partial<TimelineItem>)}
              className="h-4"
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-6 px-2"
          onClick={() => onUpdate({ position: { x: 0.5, y: 0.5 } } as Partial<TimelineItem>)}
        >
          Reset to Center
        </Button>
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
              defaultValue={w.toFixed(2)}
              key={`width-${item.id}-${w}`}
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) onUpdate({ width: Math.max(0.05, v) } as Partial<TimelineItem>);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = parseFloat(e.currentTarget.value);
                  if (!isNaN(v)) onUpdate({ width: Math.max(0.05, v) } as Partial<TimelineItem>);
                  e.currentTarget.blur();
                }
              }}
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Height</Label>
            <Input
              type="number"
              min={0.05} max={2} step={0.05}
              defaultValue={h.toFixed(2)}
              key={`height-${item.id}-${h}`}
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) onUpdate({ height: Math.max(0.05, v) } as Partial<TimelineItem>);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = parseFloat(e.currentTarget.value);
                  if (!isNaN(v)) onUpdate({ height: Math.max(0.05, v) } as Partial<TimelineItem>);
                  e.currentTarget.blur();
                }
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
    </div>
  );
}
