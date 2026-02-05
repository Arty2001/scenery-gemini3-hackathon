'use client';

import { useMemo, useCallback } from 'react';
import { useCompositionStore } from '@/lib/composition';
import type { TimelineItem, ComponentItem, MediaItem, ImageItem, TextItem, CursorItem, ShapeItem, ParticleItem } from '@/lib/composition/types';
import { TimingControls } from './timing-controls';
import { ComponentProperties } from './component-properties';
import { MediaControls } from './media-controls';
import { CursorProperties } from './cursor-properties';
import { TextProperties } from './text-properties';
import { ShapeProperties } from './shape-properties';
import { ParticleProperties } from './particle-properties';
import { MousePointer2 } from 'lucide-react';
import { AnimationControls } from './animation-controls';

interface PropertiesPanelProps {
  selectedItemId: string | null;
}

export function PropertiesPanel({ selectedItemId }: PropertiesPanelProps) {
  const tracks = useCompositionStore((s) => s.tracks);
  const fps = useCompositionStore((s) => s.fps);
  const updateItem = useCompositionStore((s) => s.updateItem);

  // Find selected item and its track
  const { item, trackId } = useMemo(() => {
    if (!selectedItemId) return { item: null, trackId: null };

    for (const track of tracks) {
      const foundItem = track.items.find((i) => i.id === selectedItemId);
      if (foundItem) {
        return { item: foundItem, trackId: track.id };
      }
    }

    return { item: null, trackId: null };
  }, [tracks, selectedItemId]);

  // Create update handler bound to trackId and itemId
  const handleUpdate = useCallback(
    (updates: Partial<TimelineItem>) => {
      if (trackId && item) {
        updateItem(trackId, item.id, updates);
      }
    },
    [trackId, item, updateItem]
  );

  // Empty state when nothing selected
  if (!item || !trackId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <MousePointer2 className="h-8 w-8 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          No clip selected
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Select a clip on the timeline to edit its properties
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Properties</h2>
        <p className="text-xs text-muted-foreground capitalize">
          {item.type} Clip
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Timing controls - always shown */}
        <TimingControls
          item={item}
          fps={fps}
          onUpdate={handleUpdate}
        />

        {/* Type-specific controls */}
        {item.type === 'component' && (
          <ComponentProperties
            item={item as ComponentItem}
            onUpdate={handleUpdate}
          />
        )}

        {item.type === 'text' && (
          <TextProperties
            item={item as TextItem}
            onUpdate={handleUpdate}
          />
        )}

        {(item.type === 'video' || item.type === 'audio' || item.type === 'image') && (
          <MediaControls
            item={item as MediaItem | ImageItem}
            fps={fps}
            onUpdate={handleUpdate}
          />
        )}

        {item.type === 'cursor' && (
          <CursorProperties
            item={item as CursorItem}
            onUpdate={handleUpdate}
          />
        )}

        {item.type === 'shape' && (
          <ShapeProperties
            item={item as ShapeItem}
            onUpdate={handleUpdate}
          />
        )}

        {item.type === 'particles' && (
          <ParticleProperties
            item={item as ParticleItem}
            onUpdate={handleUpdate}
          />
        )}

        {/* Keyframe animation controls - shown for all item types except cursor and particles */}
        {item.type !== 'cursor' && item.type !== 'particles' && (
          <AnimationControls
            keyframes={item.keyframes}
            durationInFrames={item.durationInFrames}
            onUpdate={handleUpdate}
          />
        )}
      </div>
    </div>
  );
}
