'use client';

/**
 * Scene Navigator - Displays scenes above the timeline ruler.
 * Allows adding, selecting, reordering, and deleting scenes.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useCompositionStore } from '@/lib/composition';
import type { Scene, SceneTransitionType } from '@/lib/composition/types';
import { Plus, Trash2, ChevronRight, MoreHorizontal } from 'lucide-react';

// Drag state for resizing scenes
interface DragState {
  sceneId: string;
  edge: 'left' | 'right';
  startX: number;
  originalStartFrame: number;
  originalDuration: number;
}
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface SceneNavigatorProps {
  pixelsPerFrame: number;
}

const SCENE_HEIGHT = 32;
const TRANSITION_ICON_SIZE = 16;

// Transition type icons/labels
const TRANSITION_INFO: Record<SceneTransitionType, { label: string; icon: string }> = {
  fade: { label: 'Fade', icon: '⬛' },
  slide: { label: 'Slide', icon: '➡️' },
  curtain: { label: 'Curtain', icon: '🎭' },
  wheel: { label: 'Wheel', icon: '🔄' },
  flip: { label: 'Flip', icon: '🔃' },
  wipe: { label: 'Wipe', icon: '◀️' },
  zoom: { label: 'Zoom', icon: '🔍' },
  'motion-blur': { label: 'Motion Blur', icon: '💨' },
};

export function SceneNavigator({ pixelsPerFrame }: SceneNavigatorProps) {
  const scenes = useCompositionStore((s) => s.scenes);
  const selectedSceneId = useCompositionStore((s) => s.selectedSceneId);
  const setSelectedSceneId = useCompositionStore((s) => s.setSelectedSceneId);
  const setSelectedItemId = useCompositionStore((s) => s.setSelectedItemId);
  const addScene = useCompositionStore((s) => s.addScene);
  const removeScene = useCompositionStore((s) => s.removeScene);
  const updateScene = useCompositionStore((s) => s.updateScene);
  const durationInFrames = useCompositionStore((s) => s.durationInFrames);
  const fps = useCompositionStore((s) => s.fps);

  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [mounted, setMounted] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Prevent hydration mismatch with Radix DropdownMenu
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle drag resize
  const handleDragStart = useCallback((
    e: React.MouseEvent,
    scene: Scene,
    edge: 'left' | 'right'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      sceneId: scene.id,
      edge,
      startX: e.clientX,
      originalStartFrame: scene.startFrame,
      originalDuration: scene.durationInFrames,
    });
  }, []);

  // Handle mouse move during drag
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaFrames = Math.round(deltaX / pixelsPerFrame);

      const scene = scenes.find(s => s.id === dragState.sceneId);
      if (!scene) return;

      const sceneIndex = scenes.findIndex(s => s.id === dragState.sceneId);
      const prevScene = sceneIndex > 0 ? scenes[sceneIndex - 1] : null;
      const nextScene = sceneIndex < scenes.length - 1 ? scenes[sceneIndex + 1] : null;

      if (dragState.edge === 'left') {
        // Dragging left edge: adjust startFrame and duration
        let newStartFrame = dragState.originalStartFrame + deltaFrames;
        let newDuration = dragState.originalDuration - deltaFrames;

        // Minimum duration of 1 frame (or fps/2 for usability)
        const minDuration = Math.max(1, Math.round(fps / 2));
        if (newDuration < minDuration) {
          newDuration = minDuration;
          newStartFrame = dragState.originalStartFrame + dragState.originalDuration - minDuration;
        }

        // Don't go before 0 or into previous scene
        const minStart = prevScene ? prevScene.startFrame + prevScene.durationInFrames : 0;
        if (newStartFrame < minStart) {
          const diff = minStart - newStartFrame;
          newStartFrame = minStart;
          newDuration = dragState.originalDuration - deltaFrames + diff;
        }

        updateScene(dragState.sceneId, {
          startFrame: newStartFrame,
          durationInFrames: newDuration,
        });
      } else {
        // Dragging right edge: only adjust duration
        let newDuration = dragState.originalDuration + deltaFrames;

        // Minimum duration
        const minDuration = Math.max(1, Math.round(fps / 2));
        if (newDuration < minDuration) {
          newDuration = minDuration;
        }

        // Don't go past composition end or into next scene
        const maxEnd = nextScene ? nextScene.startFrame : durationInFrames;
        const maxDuration = maxEnd - dragState.originalStartFrame;
        if (newDuration > maxDuration) {
          newDuration = maxDuration;
        }

        updateScene(dragState.sceneId, {
          durationInFrames: newDuration,
        });
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, pixelsPerFrame, scenes, fps, durationInFrames, updateScene]);

  // Calculate scene positions
  const getSceneStyle = useCallback((scene: Scene) => {
    const left = scene.startFrame * pixelsPerFrame;
    const width = scene.durationInFrames * pixelsPerFrame;
    return { left, width };
  }, [pixelsPerFrame]);

  // Handle adding a new scene
  const handleAddScene = useCallback(() => {
    // Calculate start frame for new scene (after last scene or at 0)
    const lastScene = scenes[scenes.length - 1];
    const startFrame = lastScene
      ? lastScene.startFrame + lastScene.durationInFrames
      : 0;

    // Default duration: 5 seconds
    const defaultDuration = fps * 5;

    // Don't exceed composition duration
    const maxDuration = durationInFrames - startFrame;
    if (maxDuration <= 0) return;

    const newSceneId = addScene({
      name: `Scene ${scenes.length + 1}`,
      startFrame,
      durationInFrames: Math.min(defaultDuration, maxDuration),
    });

    setSelectedSceneId(newSceneId);
  }, [scenes, fps, durationInFrames, addScene, setSelectedSceneId]);

  // Handle scene name edit
  const handleStartEdit = useCallback((scene: Scene, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSceneId(scene.id);
    setEditingName(scene.name);
  }, []);

  const handleFinishEdit = useCallback((sceneId: string) => {
    if (editingName.trim()) {
      updateScene(sceneId, { name: editingName.trim() });
    }
    setEditingSceneId(null);
    setEditingName('');
  }, [editingName, updateScene]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, sceneId: string) => {
    if (e.key === 'Enter') {
      handleFinishEdit(sceneId);
    } else if (e.key === 'Escape') {
      setEditingSceneId(null);
      setEditingName('');
    }
  }, [handleFinishEdit]);

  // If no scenes, show minimal UI
  if (scenes.length === 0) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b"
        style={{ height: SCENE_HEIGHT + 8, marginLeft: 96 }}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddScene}
          className="h-6 text-xs gap-1"
        >
          <Plus className="h-3 w-3" />
          Add Scene
        </Button>
        <span className="text-xs text-muted-foreground">
          Scenes help organize your video into slides
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative bg-muted/30 border-b"
      style={{ height: SCENE_HEIGHT + 8, marginLeft: 96 }}
    >
      {/* Scene blocks */}
      <div className="relative h-full">
        {scenes.map((scene, index) => {
          const { left, width } = getSceneStyle(scene);
          const isSelected = selectedSceneId === scene.id;
          const isEditing = editingSceneId === scene.id;
          const hasTransition = scene.transition && index > 0;

          return (
            <div key={scene.id} className="absolute top-1" style={{ left, width }}>
              {/* Transition indicator between scenes */}
              {hasTransition && (
                <div
                  className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center bg-primary/20 rounded-full cursor-pointer hover:bg-primary/40 transition-colors"
                  style={{ width: TRANSITION_ICON_SIZE, height: TRANSITION_ICON_SIZE }}
                  title={`${TRANSITION_INFO[scene.transition!.type].label} transition (${scene.transition!.durationInFrames}f)`}
                >
                  <ChevronRight className="h-3 w-3 text-primary" />
                </div>
              )}

              {/* Scene block - click to select, menu button for actions */}
              <div
                className={`
                  group relative w-full rounded-md px-2 flex items-center justify-between gap-1
                  text-xs font-medium truncate cursor-pointer transition-colors
                  ${isSelected
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1'
                    : 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                  }
                  ${dragState?.sceneId === scene.id ? 'ring-2 ring-primary' : ''}
                `}
                style={{ height: SCENE_HEIGHT }}
                onClick={() => {
                  setSelectedSceneId(scene.id);
                  setSelectedItemId(null); // Clear item selection when scene is selected
                }}
              >
                {/* Left resize handle */}
                <div
                  className={`
                    absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-20
                    opacity-0 group-hover:opacity-100 transition-opacity
                    ${dragState?.sceneId === scene.id && dragState?.edge === 'left' ? 'opacity-100' : ''}
                  `}
                  onMouseDown={(e) => handleDragStart(e, scene, 'left')}
                >
                  <div className="absolute left-0 top-1 bottom-1 w-1 bg-primary/60 rounded-full" />
                </div>

                {/* Right resize handle */}
                <div
                  className={`
                    absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-20
                    opacity-0 group-hover:opacity-100 transition-opacity
                    ${dragState?.sceneId === scene.id && dragState?.edge === 'right' ? 'opacity-100' : ''}
                  `}
                  onMouseDown={(e) => handleDragStart(e, scene, 'right')}
                >
                  <div className="absolute right-0 top-1 bottom-1 w-1 bg-primary/60 rounded-full" />
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleFinishEdit(scene.id)}
                    onKeyDown={(e) => handleKeyDown(e, scene.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border-none outline-none text-xs w-full"
                    autoFocus
                  />
                ) : (
                  <span
                    className="truncate flex-1 text-left"
                    onDoubleClick={(e) => handleStartEdit(scene, e)}
                  >
                    {scene.name}
                  </span>
                )}
                <span className="text-[10px] opacity-60 shrink-0">
                  {(scene.durationInFrames / fps).toFixed(1)}s
                </span>
                {/* Menu button - only show when mounted to avoid hydration issues */}
                {mounted && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className={`p-0.5 rounded hover:bg-black/10 ${isSelected ? 'hover:bg-white/20' : ''}`}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleStartEdit(scene, {} as React.MouseEvent)}>
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => removeScene(scene.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Scene
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          );
        })}

        {/* Add scene button at end */}
        <div
          className="absolute top-1"
          style={{
            left: scenes.length > 0
              ? (scenes[scenes.length - 1].startFrame + scenes[scenes.length - 1].durationInFrames) * pixelsPerFrame + 8
              : 8
          }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={handleAddScene}
            className="h-7 w-7"
            title="Add Scene"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
