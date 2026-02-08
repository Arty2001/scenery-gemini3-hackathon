'use client';

/**
 * Scene Properties Panel - Edit scene settings including name, duration,
 * background color, and transition configuration.
 */

import { useCallback, useMemo } from 'react';
import { useCompositionStore } from '@/lib/composition';
import type { Scene, SceneTransitionType, SlideDirection } from '@/lib/composition/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Layers, Clock, Palette, Sparkles, Play, Eye, EyeOff } from 'lucide-react';

interface ScenePropertiesProps {
  scene: Scene;
}

// Transition type options
const TRANSITION_TYPES: { value: SceneTransitionType; label: string; description: string }[] = [
  { value: 'fade', label: 'Fade', description: 'Cross-fade between scenes' },
  { value: 'slide', label: 'Slide', description: 'Slide in from edge' },
  { value: 'curtain', label: 'Curtain', description: 'Two panels slide apart' },
  { value: 'wheel', label: 'Wheel', description: 'Rotational swing effect' },
  { value: 'flip', label: 'Flip', description: '3D card flip' },
  { value: 'wipe', label: 'Wipe', description: 'Edge wipe reveal' },
  { value: 'zoom', label: 'Zoom', description: 'Zoom in/out effect' },
  { value: 'motion-blur', label: 'Motion Blur', description: 'Fast motion blur' },
];

// Direction options
const DIRECTION_OPTIONS: { value: SlideDirection; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];

export function SceneProperties({ scene }: ScenePropertiesProps) {
  const updateScene = useCompositionStore((s) => s.updateScene);
  const setSceneTransition = useCompositionStore((s) => s.setSceneTransition);
  const updateTrack = useCompositionStore((s) => s.updateTrack);
  const updateItem = useCompositionStore((s) => s.updateItem);
  const fps = useCompositionStore((s) => s.fps);
  const scenes = useCompositionStore((s) => s.scenes);
  const tracks = useCompositionStore((s) => s.tracks);

  // Check if this is the first scene (can't have transition)
  const isFirstScene = scenes.length > 0 && scenes[0].id === scene.id;

  // Get composition duration to limit start frame
  const durationInFrames = useCompositionStore((s) => s.durationInFrames);

  // Find tracks that have items overlapping with this scene
  const sceneEnd = scene.startFrame + scene.durationInFrames;
  const involvedTracks = useMemo(() => {
    return tracks.filter(track =>
      track.items.some(item => {
        const itemEnd = item.from + item.durationInFrames;
        // Check if item overlaps with scene time range
        return item.from < sceneEnd && itemEnd > scene.startFrame;
      })
    );
  }, [tracks, scene.startFrame, sceneEnd]);

  // Check if all involved tracks are currently hidden
  const allInvolvedHidden = involvedTracks.length > 0 &&
    involvedTracks.every(track => !track.visible);

  // Toggle visibility of all involved tracks
  const handleToggleInvolvedTracks = useCallback(() => {
    const newVisibility = allInvolvedHidden; // If all hidden, show them; otherwise hide
    involvedTracks.forEach(track => {
      updateTrack(track.id, { visible: newVisibility });
    });
  }, [involvedTracks, allInvolvedHidden, updateTrack]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateScene(scene.id, { name: e.target.value });
  }, [scene.id, updateScene]);

  const handleStartFrameChange = useCallback((value: number[]) => {
    // Ensure start frame doesn't exceed composition duration minus scene duration
    const maxStart = Math.max(0, durationInFrames - scene.durationInFrames);
    const newStartFrame = Math.min(value[0], maxStart);
    const delta = newStartFrame - scene.startFrame;

    // Move all items within this scene by the same delta (except audio - audio flows independently)
    if (delta !== 0) {
      involvedTracks.forEach(track => {
        // Skip audio tracks - they shouldn't be constrained to scenes
        if (track.type === 'audio') return;

        track.items.forEach(item => {
          const itemEnd = item.from + item.durationInFrames;
          // Only move items that overlap with the current scene position
          if (item.from < sceneEnd && itemEnd > scene.startFrame) {
            updateItem(track.id, item.id, { from: Math.max(0, item.from + delta) });
          }
        });
      });
    }

    updateScene(scene.id, { startFrame: newStartFrame });
  }, [scene.id, scene.startFrame, scene.durationInFrames, sceneEnd, durationInFrames, involvedTracks, updateItem, updateScene]);

  const handleDurationChange = useCallback((value: number[]) => {
    updateScene(scene.id, { durationInFrames: Math.max(1, value[0]) });
  }, [scene.id, updateScene]);

  const handleBackgroundChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateScene(scene.id, { backgroundColor: e.target.value });
  }, [scene.id, updateScene]);

  const handleTransitionTypeChange = useCallback((type: SceneTransitionType | 'none') => {
    if (type === 'none') {
      setSceneTransition(scene.id, undefined);
    } else {
      setSceneTransition(scene.id, {
        type,
        durationInFrames: scene.transition?.durationInFrames || Math.round(fps * 0.5),
        direction: scene.transition?.direction,
      });
    }
  }, [scene.id, scene.transition, fps, setSceneTransition]);

  const handleTransitionDurationChange = useCallback((value: number[]) => {
    if (scene.transition) {
      setSceneTransition(scene.id, {
        ...scene.transition,
        durationInFrames: Math.max(1, value[0]),
      });
    }
  }, [scene.id, scene.transition, setSceneTransition]);

  const handleTransitionDirectionChange = useCallback((direction: SlideDirection) => {
    if (scene.transition) {
      setSceneTransition(scene.id, {
        ...scene.transition,
        direction,
      });
    }
  }, [scene.id, scene.transition, setSceneTransition]);

  const startInSeconds = scene.startFrame / fps;
  const durationInSeconds = scene.durationInFrames / fps;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Scene Properties</h2>
        <p className="text-xs text-muted-foreground">{scene.name}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Scene Name */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <Label className="text-xs font-medium">Name</Label>
          </div>
          <Input
            value={scene.name}
            onChange={handleNameChange}
            className="h-8 text-sm"
            placeholder="Scene name"
          />
        </div>

        {/* Track Visibility */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {allInvolvedHidden ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
              <Label className="text-xs font-medium">Tracks in Scene</Label>
            </div>
            <span className="text-xs text-muted-foreground">
              {involvedTracks.length} track{involvedTracks.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={handleToggleInvolvedTracks}
              disabled={involvedTracks.length === 0}
            >
              {allInvolvedHidden ? (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  Show All Tracks
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3 mr-1" />
                  Hide All Tracks
                </>
              )}
            </Button>
          </div>
          {involvedTracks.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No tracks have clips in this scene
            </p>
          )}
        </div>

        {/* Start Time */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs font-medium">Start Time</Label>
            </div>
            <span className="text-xs text-muted-foreground">
              {startInSeconds.toFixed(1)}s ({scene.startFrame} frames)
            </span>
          </div>
          <Slider
            value={[scene.startFrame]}
            onValueChange={handleStartFrameChange}
            min={0}
            max={Math.max(0, durationInFrames - scene.durationInFrames)}
            step={1}
            className="w-full"
          />
        </div>

        {/* Duration */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs font-medium">Duration</Label>
            </div>
            <span className="text-xs text-muted-foreground">
              {durationInSeconds.toFixed(1)}s ({scene.durationInFrames} frames)
            </span>
          </div>
          <Slider
            value={[scene.durationInFrames]}
            onValueChange={handleDurationChange}
            min={1}
            max={fps * 60} // 60 seconds max
            step={1}
            className="w-full"
          />
        </div>

        {/* Background Color */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <Label className="text-xs font-medium">Background</Label>
          </div>
          <div className="flex gap-2">
            <input
              type="color"
              value={scene.backgroundColor || '#000000'}
              onChange={handleBackgroundChange}
              className="w-8 h-8 rounded border cursor-pointer"
            />
            <Input
              value={scene.backgroundColor || '#000000'}
              onChange={handleBackgroundChange}
              className="h-8 text-sm flex-1"
              placeholder="#000000"
            />
          </div>
        </div>

        {/* Transition Settings */}
        {!isFirstScene && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs font-medium">Transition In</Label>
            </div>

            {/* Transition Type Grid */}
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => handleTransitionTypeChange('none')}
                className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                  !scene.transition
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 hover:bg-muted border-border'
                }`}
              >
                None
              </button>
              {TRANSITION_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleTransitionTypeChange(t.value)}
                  title={t.description}
                  className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                    scene.transition?.type === t.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 hover:bg-muted border-border'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Transition Duration */}
            {scene.transition && (
              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Duration</Label>
                  <span className="text-xs text-muted-foreground">
                    {(scene.transition.durationInFrames / fps).toFixed(2)}s
                  </span>
                </div>
                <Slider
                  value={[scene.transition.durationInFrames]}
                  onValueChange={handleTransitionDurationChange}
                  min={1}
                  max={fps * 3} // 3 seconds max
                  step={1}
                  className="w-full"
                />
              </div>
            )}

            {/* Transition Direction (for slide, curtain, wheel, flip) */}
            {scene.transition && scene.transition.type !== 'fade' && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Direction</Label>
                <div className="grid grid-cols-4 gap-1">
                  {DIRECTION_OPTIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => handleTransitionDirectionChange(d.value)}
                      className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                        scene.transition?.direction === d.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 hover:bg-muted border-border'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {isFirstScene && (
          <p className="text-xs text-muted-foreground italic">
            First scene cannot have a transition in.
          </p>
        )}
      </div>
    </div>
  );
}
