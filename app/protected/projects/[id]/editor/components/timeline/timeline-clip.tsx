'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { TimelineItem, Track, TextItem } from '@/lib/composition/types';
import type { ClipDragData } from '@/lib/timeline';
import { ResizeHandle } from './resize-handle';
import { cn } from '@/lib/utils';

interface TimelineClipProps {
  item: TimelineItem;
  track: Track;
  pixelsPerFrame: number;
  isSelected: boolean;
  onSelect: (itemId: string, addToSelection?: boolean) => void;
}

const clipColors: Record<string, { bg: string; border: string }> = {
  component: { bg: 'bg-blue-500/30', border: 'border-blue-500/50' },
  text: { bg: 'bg-green-500/30', border: 'border-green-500/50' },
  video: { bg: 'bg-purple-500/30', border: 'border-purple-500/50' },
  audio: { bg: 'bg-orange-500/30', border: 'border-orange-500/50' },
  image: { bg: 'bg-pink-500/30', border: 'border-pink-500/50' },
  shape: { bg: 'bg-yellow-500/30', border: 'border-yellow-500/50' },
  cursor: { bg: 'bg-cyan-500/30', border: 'border-cyan-500/50' },
  particles: { bg: 'bg-indigo-500/30', border: 'border-indigo-500/50' },
  'custom-html': { bg: 'bg-emerald-500/30', border: 'border-emerald-500/50' },
};

export function TimelineClip({
  item,
  track,
  pixelsPerFrame,
  isSelected,
  onSelect,
}: TimelineClipProps) {
  // Prepare drag data for clip move
  const dragData: ClipDragData = {
    type: 'clip',
    trackId: track.id,
    itemId: item.id,
    originalFrom: item.from,
  };

  // Configure useDraggable for clip body (move operation)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `clip-${item.id}`,
    data: dragData,
  });

  // Calculate clip position and size
  const left = item.from * pixelsPerFrame;
  const width = item.durationInFrames * pixelsPerFrame;

  // Build transform style with dnd-kit utilities
  const style = {
    left,
    width,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 100 : isSelected ? 10 : 1,
  };

  const colors = clipColors[item.type] || clipColors.component;

  // Get display label based on item type
  const getLabel = () => {
    if (item.type === 'component') {
      return 'Component';
    }
    if (item.type === 'text') {
      return (item as TextItem).text?.slice(0, 20) || 'Text';
    }
    if (item.type === 'custom-html') {
      return 'HTML';
    }
    return item.type.charAt(0).toUpperCase() + item.type.slice(1);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'absolute top-1 bottom-1 rounded border cursor-move group',
        colors.bg,
        colors.border,
        isSelected && 'ring-2 ring-primary ring-offset-1',
        isDragging && 'shadow-lg'
      )}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        // Ctrl/Cmd+click for multi-select
        const addToSelection = e.ctrlKey || e.metaKey;
        onSelect(item.id, addToSelection);
      }}
      {...attributes}
      {...listeners}
    >
      {/* Left resize handle (trim start) */}
      <ResizeHandle
        itemId={item.id}
        trackId={track.id}
        edge="start"
        item={item}
      />

      {/* Clip content */}
      <div className="h-full flex items-center px-3 overflow-hidden pointer-events-none">
        <span className="text-xs font-medium truncate">
          {getLabel()}
        </span>
      </div>

      {/* Right resize handle (trim end) */}
      <ResizeHandle
        itemId={item.id}
        trackId={track.id}
        edge="end"
        item={item}
      />
    </div>
  );
}
