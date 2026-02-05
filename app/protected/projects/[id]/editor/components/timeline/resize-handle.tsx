'use client';

import { useDraggable } from '@dnd-kit/core';
import type { TimelineItem } from '@/lib/composition/types';
import type { ResizeDragData } from '@/lib/timeline';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  itemId: string;
  trackId: string;
  edge: 'start' | 'end';
  item: TimelineItem;
}

export function ResizeHandle({
  itemId,
  trackId,
  edge,
  item,
}: ResizeHandleProps) {
  // Prepare resize drag data
  const dragData: ResizeDragData = {
    type: 'resize',
    edge,
    trackId,
    itemId,
    originalFrom: item.from,
    originalDuration: item.durationInFrames,
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: `resize-${edge}-${itemId}`,
    data: dragData,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'absolute top-0 bottom-0 w-2 cursor-ew-resize z-10',
        'opacity-0 hover:opacity-100 transition-opacity',
        'hover:bg-primary/40 active:bg-primary/60',
        edge === 'start' ? 'left-0 rounded-l' : 'right-0 rounded-r',
        isDragging && 'opacity-100 bg-primary/60'
      )}
      onClick={(e) => e.stopPropagation()} // Prevent clip selection when clicking handle
      onMouseDown={(e) => e.stopPropagation()} // Prevent clip drag when starting resize
      {...attributes}
      {...listeners}
    />
  );
}
