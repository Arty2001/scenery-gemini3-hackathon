'use client';

/**
 * Drag overlay for the Remotion preview.
 *
 * Renders a transparent layer on top of the Player that captures
 * mouse events and converts pixel deltas to 0-1 normalised position
 * updates in the composition store.
 */

import { useCallback, useRef, useState } from 'react';
import { useCompositionStore } from '@/lib/composition/store';
import { pauseHistory, resumeHistory } from '@/lib/composition/store';
import type { TimelineItem, Track } from '@/lib/composition/types';

// =============================================
// Types
// =============================================

interface DragState {
  trackId: string;
  itemId: string;
  startMouseX: number;
  startMouseY: number;
  startPosX: number;
  startPosY: number;
}

// Device frame sizes (must match component-item.tsx)
const DEVICE_SIZES: Record<string, { width: number; height: number }> = {
  phone: { width: 375, height: 812 },
  laptop: { width: 1280, height: 800 },
};

// =============================================
// Helpers
// =============================================

/** Get the 0-1 position of an item, defaulting to center. */
function getItemPosition(item: TimelineItem): { x: number; y: number } | null {
  if (item.type === 'text' || item.type === 'shape') {
    return item.position ?? { x: 0.5, y: 0.5 };
  }
  if (item.type === 'component') {
    return item.position ?? { x: 0.5, y: 0.5 };
  }
  if (item.type === 'video' || item.type === 'image') {
    return item.position ?? { x: 0.5, y: 0.5 };
  }
  return null; // audio, cursor — not draggable
}

/** Estimate a rough bounding box in 0-1 coords for hit testing. */
function getItemBounds(
  item: TimelineItem,
  compWidth: number,
  compHeight: number
): { x: number; y: number; hw: number; hh: number } | null {
  const pos = getItemPosition(item);
  if (!pos) return null;

  if (item.type === 'text') {
    // Rough estimate based on font size
    const fontSize = item.fontSize ?? 24;
    const charCount = Math.max(item.text.length, 5);
    const hw = Math.min((fontSize * charCount * 0.5) / compWidth / 2, 0.4);
    const hh = (fontSize * 1.5) / compHeight / 2;
    return { x: pos.x, y: pos.y, hw, hh };
  }

  if (item.type === 'shape') {
    const w = item.width ?? 0.1;
    const h = item.height ?? 0.1;
    return { x: pos.x, y: pos.y, hw: w / 2, hh: h / 2 };
  }

  if (item.type === 'component') {
    const displaySize = item.displaySize ?? 'laptop';
    const preset = DEVICE_SIZES[displaySize];
    if (!preset && displaySize !== 'full') {
      return { x: pos.x, y: pos.y, hw: 0.3, hh: 0.25 };
    }
    if (displaySize === 'full') {
      return { x: pos.x, y: pos.y, hw: 0.45, hh: 0.45 };
    }
    const frameW = item.containerWidth ?? preset.width;
    const frameH = item.containerHeight ?? preset.height;
    const padding = 60;
    const availW = compWidth - padding * 2;
    const availH = compHeight - padding * 2;
    const zoom = Math.min(availW / frameW, availH / frameH);
    const hw = (frameW * zoom) / compWidth / 2;
    const hh = (frameH * zoom) / compHeight / 2;
    return { x: pos.x, y: pos.y, hw, hh };
  }

  if (item.type === 'video' || item.type === 'image') {
    const w = item.width ?? 1.0;
    const h = item.height ?? 1.0;
    return { x: pos.x, y: pos.y, hw: w / 2, hh: h / 2 };
  }

  return null;
}

// =============================================
// Component
// =============================================

export function PreviewDragOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const tracks = useCompositionStore((s) => s.tracks);
  const currentFrame = useCompositionStore((s) => s.currentFrame);
  const isPlaying = useCompositionStore((s) => s.isPlaying);
  const compWidth = useCompositionStore((s) => s.width);
  const compHeight = useCompositionStore((s) => s.height);
  const updateItem = useCompositionStore((s) => s.updateItem);
  const setSelectedItemId = useCompositionStore((s) => s.setSelectedItemId);

  /** Find visible items at the current frame, ordered back-to-front. */
  const getVisibleItems = useCallback((): Array<{ track: Track; item: TimelineItem }> => {
    const result: Array<{ track: Track; item: TimelineItem }> = [];
    for (const track of tracks) {
      if (!track.visible) continue;
      for (const item of track.items) {
        if (currentFrame >= item.from && currentFrame < item.from + item.durationInFrames) {
          result.push({ track, item });
        }
      }
    }
    return result;
  }, [tracks, currentFrame]);

  /** Hit test: find the top-most item under a normalised coordinate. */
  const hitTest = useCallback(
    (nx: number, ny: number): { trackId: string; item: TimelineItem } | null => {
      const visible = getVisibleItems();
      // Iterate back-to-front (later tracks = higher z-index), return last match
      let best: { trackId: string; item: TimelineItem } | null = null;
      for (const { track, item } of visible) {
        const bounds = getItemBounds(item, compWidth, compHeight);
        if (!bounds) continue;
        if (
          nx >= bounds.x - bounds.hw &&
          nx <= bounds.x + bounds.hw &&
          ny >= bounds.y - bounds.hh &&
          ny <= bounds.y + bounds.hh
        ) {
          best = { trackId: track.id, item };
        }
      }
      return best;
    },
    [getVisibleItems, compWidth, compHeight]
  );

  /** Convert page mouse coords to 0-1 normalised overlay coords. */
  const toNormalized = useCallback(
    (clientX: number, clientY: number): { nx: number; ny: number } | null => {
      const el = overlayRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        nx: (clientX - rect.left) / rect.width,
        ny: (clientY - rect.top) / rect.height,
      };
    },
    []
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isPlaying) return;
      const norm = toNormalized(e.clientX, e.clientY);
      if (!norm) return;

      const hit = hitTest(norm.nx, norm.ny);
      if (!hit) {
        setSelectedItemId(null);
        return;
      }

      setSelectedItemId(hit.item.id);

      const pos = getItemPosition(hit.item);
      if (!pos) return;

      pauseHistory();
      dragRef.current = {
        trackId: hit.trackId,
        itemId: hit.item.id,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startPosX: pos.x,
        startPosY: pos.y,
      };

      e.preventDefault();
    },
    [isPlaying, toNormalized, hitTest, setSelectedItemId]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPlaying) {
        setHoveredItemId(null);
        return;
      }

      // Handle active drag
      const drag = dragRef.current;
      if (drag) {
        const el = overlayRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const dx = (e.clientX - drag.startMouseX) / rect.width;
        const dy = (e.clientY - drag.startMouseY) / rect.height;
        const newX = Math.max(0, Math.min(1, drag.startPosX + dx));
        const newY = Math.max(0, Math.min(1, drag.startPosY + dy));

        updateItem(drag.trackId, drag.itemId, {
          position: { x: newX, y: newY },
        } as Partial<TimelineItem>);
        return;
      }

      // Hover detection
      const norm = toNormalized(e.clientX, e.clientY);
      if (!norm) return;
      const hit = hitTest(norm.nx, norm.ny);
      setHoveredItemId(hit?.item.id ?? null);
    },
    [isPlaying, toNormalized, hitTest, updateItem]
  );

  const onMouseUp = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      resumeHistory();
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      resumeHistory();
    }
    setHoveredItemId(null);
  }, []);

  return (
    <div
      ref={overlayRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        cursor: dragRef.current
          ? 'grabbing'
          : hoveredItemId && !isPlaying
            ? 'grab'
            : 'default',
      }}
    />
  );
}
