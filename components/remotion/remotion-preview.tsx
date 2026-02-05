'use client';

/**
 * Remotion Player preview component.
 *
 * Wraps the Remotion Player with composition state from Zustand store.
 * Handles:
 * - Fetching component source codes for bundling
 * - Memoizing inputProps to prevent unnecessary re-renders
 * - Exposing playerRef for parent playback controls
 */

import { Player, PlayerRef } from '@remotion/player';
import {
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useState,
} from 'react';
import { MainComposition } from './compositions/main-composition';
import { useCompositionStore } from '@/lib/composition';
import { getComponentPreviews } from '@/lib/actions/components';
import { PreviewDragOverlay } from './preview-drag-overlay';

// =============================================
// Types
// =============================================

interface RemotionPreviewProps {
  width?: number;
  height?: number;
}

export interface RemotionPreviewHandle {
  playerRef: React.RefObject<PlayerRef | null>;
}

// =============================================
// Component
// =============================================

export const RemotionPreview = forwardRef<
  RemotionPreviewHandle,
  RemotionPreviewProps
>(function RemotionPreview({ width = 1280, height = 720 }, ref) {
  const playerRef = useRef<PlayerRef>(null);
  const [componentPreviews, setComponentPreviews] = useState<Record<string, string>>(
    {}
  );

  // Get composition state from Zustand store
  const tracks = useCompositionStore((s) => s.tracks);
  const fps = useCompositionStore((s) => s.fps);
  const durationInFrames = useCompositionStore((s) => s.durationInFrames);
  const compositionWidth = useCompositionStore((s) => s.width);
  const compositionHeight = useCompositionStore((s) => s.height);
  const previewRefreshKey = useCompositionStore((s) => s.previewRefreshKey);

  // Extract all componentIds from tracks
  const componentIds = useMemo(() => {
    const ids = new Set<string>();
    tracks.forEach((track) => {
      track.items.forEach((item) => {
        if (item.type === 'component') {
          ids.add(item.componentId);
        }
      });
    });
    return Array.from(ids);
  }, [tracks]);

  // Fetch component preview HTML when componentIds change or after a sync refresh
  useEffect(() => {
    if (componentIds.length === 0) {
      setComponentPreviews({});
      return;
    }

    getComponentPreviews(componentIds).then((previews) => {
      setComponentPreviews(previews);
    });
  }, [componentIds, previewRefreshKey]);

  // Expose playerRef to parent for playback controls
  useImperativeHandle(
    ref,
    () => ({
      playerRef,
    }),
    []
  );

  // Memoize inputProps to prevent unnecessary re-renders (critical per research)
  const inputProps = useMemo(
    () => ({
      tracks,
      componentPreviews,
    }),
    [tracks, componentPreviews]
  );

  return (
    <div style={{ position: 'relative', width: '100%', maxHeight: '100%', aspectRatio: `${compositionWidth}/${compositionHeight}` }}>
      <Player
        ref={playerRef}
        component={MainComposition}
        inputProps={inputProps}
        durationInFrames={durationInFrames}
        fps={fps}
        compositionWidth={compositionWidth}
        compositionHeight={compositionHeight}
        style={{ width: '100%', height: '100%' }}
        controls={false}
        loop={false}
        clickToPlay={false}
        spaceKeyToPlayOrPause
      />
      <PreviewDragOverlay />
    </div>
  );
});
