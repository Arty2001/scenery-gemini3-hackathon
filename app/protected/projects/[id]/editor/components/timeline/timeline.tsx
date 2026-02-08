'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import useResizeObserver from 'use-resize-observer';
import { useCompositionStore } from '@/lib/composition';
import { pauseHistory, resumeHistory } from '@/lib/composition/store';
import {
  useTimelineZoom,
  pixelsToFrames,
  calculateTimelineWidth,
  useSnapPoints,
  createSnapToPointsModifier,
  type SnapPoint,
} from '@/lib/timeline';
import type { DragData } from '@/lib/timeline';
import { TimelineTrack } from './timeline-track';
import { TimelineRuler } from './timeline-ruler';
import { Playhead } from './playhead';
import { SnapIndicator } from './snap-indicator';
import { SceneNavigator } from './scene-navigator';
import { ZoomIn, ZoomOut, Maximize2, Plus, Type, Square, Image, Video, Music, MousePointer2, Sparkles, Layers, Palette, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import type { Track } from '@/lib/composition/types';

interface TimelineProps {
  selectedItemId: string | null;
  onSelectItem: (itemId: string | null) => void;
}

export function Timeline({ selectedItemId, onSelectItem }: TimelineProps) {
  const { ref: containerRef, width: containerWidth = 800 } = useResizeObserver();

  // Composition state
  const tracks = useCompositionStore((s) => s.tracks);
  const durationInFrames = useCompositionStore((s) => s.durationInFrames);
  const fps = useCompositionStore((s) => s.fps);
  const setDuration = useCompositionStore((s) => s.setDuration);
  const updateItem = useCompositionStore((s) => s.updateItem);
  const removeItem = useCompositionStore((s) => s.removeItem);
  const reorderTrack = useCompositionStore((s) => s.reorderTrack);
  const addTrack = useCompositionStore((s) => s.addTrack);
  const selectedItemIds = useCompositionStore((s) => s.selectedItemIds);
  const toggleItemSelection = useCompositionStore((s) => s.toggleItemSelection);
  const clearSelection = useCompositionStore((s) => s.clearSelection);

  // Track type options for the dropdown
  const trackTypes: { type: Track['type']; label: string; icon: typeof Type }[] = [
    { type: 'text', label: 'Text', icon: Type },
    { type: 'shape', label: 'Shape', icon: Square },
    { type: 'gradient', label: 'Gradient', icon: Palette },
    { type: 'image', label: 'Image', icon: Image },
    { type: 'video', label: 'Video', icon: Video },
    { type: 'audio', label: 'Audio', icon: Music },
    { type: 'component', label: 'Component', icon: Layers },
    { type: 'cursor', label: 'Cursor', icon: MousePointer2 },
    { type: 'particles', label: 'Particles', icon: Sparkles },
  ];

  const handleAddTrack = useCallback((type: Track['type']) => {
    const typeLabel = trackTypes.find(t => t.type === type)?.label || type;
    const existingCount = tracks.filter(t => t.type === type).length;
    addTrack({
      name: `${typeLabel} ${existingCount + 1}`,
      type,
      items: [],
      locked: false,
      visible: true,
    });
  }, [addTrack, tracks, trackTypes]);

  // Zoom state
  const {
    zoom,
    pixelsPerFrame,
    zoomIn,
    zoomOut,
    fitToView,
    setZoom,
    handleWheel,
  } = useTimelineZoom();

  // Active drag state for overlay
  const [, setActiveId] = useState<string | null>(null);

  // Prevent hydration mismatch with Radix DropdownMenu
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Snap points
  const snapPoints = useSnapPoints();
  const [activeSnapPoint, setActiveSnapPoint] = useState<SnapPoint | null>(null);

  // Create snap modifier
  const snapModifier = useMemo(
    () =>
      createSnapToPointsModifier(
        snapPoints,
        pixelsPerFrame,
        10 // threshold in pixels
      ),
    [snapPoints, pixelsPerFrame]
  );

  // Configure sensors with activation constraint
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor)
  );

  // Handle drag end - update item position
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      resumeHistory();
      const { active, delta } = event;
      setActiveId(null);
      setActiveSnapPoint(null); // Clear snap indicator

      if (!active.data.current) return;

      const data = active.data.current as DragData;

      // Guard: reject drags on locked tracks
      const sourceTrack = tracks.find((t) => t.id === data.trackId);
      if (sourceTrack?.locked) return;

      const frameDelta = pixelsToFrames(delta.x, pixelsPerFrame);

      if (data.type === 'clip') {
        // Move all selected clips (or just the dragged one if not in selection)
        const itemsToMove = selectedItemIds.includes(data.itemId)
          ? selectedItemIds
          : [data.itemId];

        // Find and update each selected item
        for (const itemId of itemsToMove) {
          for (const track of tracks) {
            const item = track.items.find((i) => i.id === itemId);
            if (item && !track.locked) {
              const newFrom = Math.max(0, item.from + frameDelta);
              updateItem(track.id, itemId, { from: newFrom });
              break;
            }
          }
        }
      } else if (data.type === 'resize') {
        // Handle resize (implemented in 06-04)
        if (data.edge === 'start') {
          const newFrom = Math.max(0, data.originalFrom + frameDelta);
          const newDuration = data.originalDuration - frameDelta;
          if (newDuration > 0) {
            updateItem(data.trackId, data.itemId, {
              from: newFrom,
              durationInFrames: newDuration,
            });
          }
        } else {
          const newDuration = Math.max(1, data.originalDuration + frameDelta);
          updateItem(data.trackId, data.itemId, { durationInFrames: newDuration });
        }
      }
    },
    [pixelsPerFrame, updateItem, tracks]
  );

  // Handle drag move - detect snap points (safe for setState, runs outside render)
  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const { active, delta } = event;

      if (!active?.data?.current) {
        setActiveSnapPoint(null);
        return;
      }

      const data = active.data.current as DragData;
      if (data.type !== 'clip' || data.originalFrom === undefined) {
        setActiveSnapPoint(null);
        return;
      }

      // Calculate current position in pixels
      const currentPixelPosition = data.originalFrom * pixelsPerFrame + delta.x;
      const currentFrame = currentPixelPosition / pixelsPerFrame;

      // Find closest snap point within threshold (10px)
      const thresholdInFrames = 10 / pixelsPerFrame;
      let closestPoint: SnapPoint | null = null;
      let closestDistance = thresholdInFrames;

      for (const point of snapPoints) {
        const distance = Math.abs(currentFrame - point.frame);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = point;
        }
      }

      setActiveSnapPoint(closestPoint);
    },
    [pixelsPerFrame, snapPoints]
  );

  const handleDragStart = useCallback((event: { active: { id: string | number } }) => {
    pauseHistory();
    setActiveId(String(event.active.id));
  }, []);

  // Track reorder via drag
  const reorderState = useRef<{ trackId: string; startY: number; startIndex: number } | null>(null);

  const handleReorderStart = useCallback(
    (trackId: string, e: React.MouseEvent) => {
      const index = tracks.findIndex((t) => t.id === trackId);
      if (index === -1) return;
      reorderState.current = { trackId, startY: e.clientY, startIndex: index };

      const onMouseMove = (ev: MouseEvent) => {
        if (!reorderState.current) return;
        const dy = ev.clientY - reorderState.current.startY;
        const indexDelta = Math.round(dy / 48); // TRACK_HEIGHT
        const newIndex = reorderState.current.startIndex + indexDelta;
        reorderTrack(reorderState.current.trackId, newIndex);
      };

      const onMouseUp = () => {
        reorderState.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [tracks, reorderTrack]
  );

  // Handle item selection with multi-select support
  const handleSelectItem = useCallback(
    (itemId: string | null, addToSelection?: boolean) => {
      if (itemId === null) {
        clearSelection();
        onSelectItem(null);
      } else {
        toggleItemSelection(itemId, addToSelection);
      }
    },
    [toggleItemSelection, clearSelection, onSelectItem]
  );

  // Keyboard: delete selected clips
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemIds.length > 0) {
        // Don't delete if user is typing in an input
        if ((e.target as HTMLElement).tagName === 'INPUT') return;

        // Delete all selected items
        for (const itemId of selectedItemIds) {
          for (const track of tracks) {
            if (track.items.some((item) => item.id === itemId)) {
              removeItem(track.id, itemId);
              break;
            }
          }
        }
        clearSelection();
        onSelectItem(null);
      }
    },
    [selectedItemIds, tracks, removeItem, clearSelection, onSelectItem]
  );

  const timelineWidth = calculateTimelineWidth(durationInFrames, pixelsPerFrame);

  return (
    <div
      className="flex flex-col h-full overflow-hidden border-t bg-muted/30"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Timeline</span>
          {mounted ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Add Track
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel className="text-xs">Track Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {trackTypes.map(({ type, label, icon: Icon }) => (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => handleAddTrack(type)}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm" className="h-7 gap-1" disabled>
              <Plus className="h-3.5 w-3.5" />
              Add Track
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Duration control */}
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="number"
              min={1}
              step={1}
              defaultValue={Math.round(durationInFrames / fps)}
              key={`duration-${durationInFrames}`}
              onBlur={(e) => {
                const seconds = parseFloat(e.target.value);
                if (!isNaN(seconds) && seconds > 0) {
                  setDuration(Math.round(seconds * fps));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const seconds = parseFloat(e.currentTarget.value);
                  if (!isNaN(seconds) && seconds > 0) {
                    setDuration(Math.round(seconds * fps));
                  }
                  e.currentTarget.blur();
                }
              }}
              className="h-7 w-16 text-xs"
              title="Video duration in seconds"
            />
            <span className="text-xs text-muted-foreground">sec</span>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomOut}
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Slider
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              min={0.1}
              max={10}
              step={0.1}
              className="w-24"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomIn}
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fitToView(containerWidth - 96, durationInFrames)}
              title="Fit to view"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12">
              {Math.round(zoom * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Timeline content */}
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-auto flex-1 min-h-0"
        onWheel={handleWheel}
      >
        <div style={{ width: timelineWidth, minWidth: '100%' }}>
          {/* Scene navigator */}
          <SceneNavigator pixelsPerFrame={pixelsPerFrame} />

          {/* Time ruler */}
          <TimelineRuler
            durationInFrames={durationInFrames}
            fps={fps}
            pixelsPerFrame={pixelsPerFrame}
          />

          {/* Tracks with DndContext */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis, snapModifier]}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          >
            <div className="relative">
              {/* Snap indicator */}
              <SnapIndicator
                activeSnapPoint={activeSnapPoint}
                pixelsPerFrame={pixelsPerFrame}
              />

              {/* Playhead */}
              <Playhead pixelsPerFrame={pixelsPerFrame} />

              {/* Track rows */}
              {tracks.map((track) => (
                <TimelineTrack
                  key={track.id}
                  track={track}
                  pixelsPerFrame={pixelsPerFrame}
                  selectedItemId={selectedItemId}
                  selectedItemIds={selectedItemIds}
                  onSelectItem={handleSelectItem}
                  onReorderStart={handleReorderStart}
                />
              ))}
            </div>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
