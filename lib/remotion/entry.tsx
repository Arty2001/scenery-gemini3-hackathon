/**
 * Remotion Lambda entry point.
 *
 * This file is the root for Remotion Lambda bundling via deploySite().
 * It registers the MainComposition so Lambda can render it.
 *
 * Uses calculateMetadata to derive duration/fps/dimensions from inputProps
 * so exported videos match the actual composition settings.
 */

import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { MainComposition } from '@/components/remotion/compositions/main-composition';
import type { Track } from '@/lib/composition/types';

// =============================================
// Root Component
// =============================================

interface CompositionInputProps {
  tracks: Track[];
  componentPreviews: Record<string, string>;
  durationInFrames?: number;
  fps?: number;
  width?: number;
  height?: number;
}

const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MainComposition"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component={MainComposition as any}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        tracks: [] as Track[],
        componentPreviews: {} as Record<string, string>,
      }}
      calculateMetadata={({ props }) => {
        const p = props as CompositionInputProps;
        return {
          durationInFrames: p.durationInFrames || 900,
          fps: p.fps || 30,
          width: p.width || 1920,
          height: p.height || 1080,
          props: {
            tracks: p.tracks,
            componentPreviews: p.componentPreviews,
          },
        };
      }}
    />
  );
};

registerRoot(RemotionRoot);
