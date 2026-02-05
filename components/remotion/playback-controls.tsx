'use client';

/**
 * Playback controls for Remotion Player.
 *
 * Provides play/pause, skip forward/back, and scrubber functionality.
 * Syncs with Remotion Player state via PlayerRef events.
 */

import { PlayerRef } from '@remotion/player';
import { useCallback, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useCompositionStore } from '@/lib/composition';

// =============================================
// Types
// =============================================

interface PlaybackControlsProps {
  playerRef: React.RefObject<PlayerRef | null>;
}

// =============================================
// Component
// =============================================

export function PlaybackControls({ playerRef }: PlaybackControlsProps) {
  const durationInFrames = useCompositionStore((s) => s.durationInFrames);
  const fps = useCompositionStore((s) => s.fps);
  const currentFrame = useCompositionStore((s) => s.currentFrame);
  const setCurrentFrame = useCompositionStore((s) => s.setCurrentFrame);
  const isPlaying = useCompositionStore((s) => s.isPlaying);
  const setIsPlaying = useCompositionStore((s) => s.setIsPlaying);

  // Track whether the store update came from the player itself
  const playerIsSource = useRef(false);

  // Sync player → store (player events update the store)
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onFrameUpdate = () => {
      playerIsSource.current = true;
      setCurrentFrame(player.getCurrentFrame());
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    player.addEventListener('frameupdate', onFrameUpdate);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);

    return () => {
      player.removeEventListener('frameupdate', onFrameUpdate);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
    };
  }, [playerRef, setCurrentFrame, setIsPlaying]);

  // Sync store → player (timeline clicks/drags seek the player)
  useEffect(() => {
    if (playerIsSource.current) {
      playerIsSource.current = false;
      return;
    }
    const player = playerRef.current;
    if (!player) return;
    if (player.getCurrentFrame() !== currentFrame) {
      player.seekTo(currentFrame);
    }
  }, [currentFrame, playerRef]);

  const togglePlay = useCallback(() => {
    playerRef.current?.toggle();
  }, [playerRef]);

  const seekTo = useCallback(
    (frame: number) => {
      playerRef.current?.seekTo(frame);
    },
    [playerRef]
  );

  const skipBack = useCallback(() => {
    const newFrame = Math.max(0, currentFrame - fps * 5); // 5 seconds
    seekTo(newFrame);
  }, [currentFrame, fps, seekTo]);

  const skipForward = useCallback(() => {
    const newFrame = Math.min(durationInFrames - 1, currentFrame + fps * 5);
    seekTo(newFrame);
  }, [currentFrame, durationInFrames, fps, seekTo]);

  /**
   * Format frame number as mm:ss timestamp
   */
  const formatTime = (frame: number) => {
    const seconds = Math.floor(frame / fps);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-background border-t relative z-10">
      {/* Transport controls */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={skipBack} title="Skip back 5s">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button variant="ghost" size="icon" onClick={skipForward} title="Skip forward 5s">
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      {/* Current time display */}
      <span className="text-sm font-mono w-20">
        {formatTime(currentFrame)}
      </span>

      {/* Scrubber / Timeline slider */}
      <Slider
        value={[currentFrame]}
        onValueChange={([value]) => seekTo(value)}
        max={durationInFrames - 1}
        min={0}
        step={1}
        className="flex-1"
      />

      {/* Duration display */}
      <span className="text-sm font-mono w-20 text-right">
        {formatTime(durationInFrames)}
      </span>
    </div>
  );
}
