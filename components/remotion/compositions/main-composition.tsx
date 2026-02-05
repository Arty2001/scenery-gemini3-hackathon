'use client';

/**
 * Main Remotion composition component.
 *
 * Renders all tracks from the composition state as layered AbsoluteFill
 * components. Each track contains Sequences for its timeline items,
 * which are rendered by the appropriate item renderer.
 */

import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import type { Track, TimelineItem, TransitionConfig } from '@/lib/composition/types';
import { ComponentItemRenderer } from './component-item';
import { TextItemRenderer } from './text-item';
import { MediaItemRenderer } from './media-item';
import { CursorOverlay } from './cursor-overlay';
import { ShapeItemRenderer } from './shape-item';
import { ParticleItemRenderer } from './particle-item';
import { useInteractionState } from '@/components/remotion/animation/use-interaction-state';

// =============================================
// Types
// =============================================

interface MainCompositionProps {
  tracks: Track[];
  componentPreviews?: Record<string, string>; // Map of componentId -> preview HTML
}

// =============================================
// Main Composition
// =============================================

export const MainComposition: React.FC<MainCompositionProps> = ({
  tracks,
  componentPreviews = {},
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {tracks
        .filter((track) => track.visible !== false)
        .map((track, trackIndex) => (
          <TrackLayer
            key={track.id}
            track={track}
            zIndex={trackIndex}
            componentPreviews={componentPreviews}
            allTracks={tracks}
          />
        ))}
    </AbsoluteFill>
  );
};

// =============================================
// Track Layer
// =============================================

interface TrackLayerProps {
  track: Track;
  zIndex: number;
  componentPreviews: Record<string, string>;
  allTracks: Track[];
}

function getPresentation(config: TransitionConfig) {
  switch (config.type) {
    case 'slide':
      return slide({
        direction: config.direction
          ? (`from-${config.direction}` as 'from-left' | 'from-right' | 'from-top' | 'from-bottom')
          : 'from-left',
      });
    case 'fade':
    default:
      return fade();
  }
}

function TrackLayer({ track, zIndex, componentPreviews, allTracks }: TrackLayerProps) {
  const sortedItems = [...track.items].sort((a, b) => a.from - b.from);
  const hasTransitions = sortedItems.some((item) => item.transitionIn);

  // If any item has transitionIn, render via TransitionSeries
  if (hasTransitions) {
    return (
      <AbsoluteFill style={{ zIndex }}>
        <TransitionSeries>
          {sortedItems.map((item, i) => (
            <React.Fragment key={item.id}>
              {/* Insert transition before this item if it has transitionIn */}
              {item.transitionIn && i > 0 && (
                <TransitionSeries.Transition
                  presentation={getPresentation(item.transitionIn)}
                  timing={linearTiming({
                    durationInFrames: item.transitionIn.durationInFrames,
                  })}
                />
              )}
              <TransitionSeries.Sequence
                durationInFrames={item.durationInFrames}
              >
                <ItemRenderer item={item} componentPreviews={componentPreviews} tracks={allTracks} />
              </TransitionSeries.Sequence>
            </React.Fragment>
          ))}
        </TransitionSeries>
      </AbsoluteFill>
    );
  }

  // Default: standard Sequence-per-item rendering (backward compatible)
  return (
    <AbsoluteFill style={{ zIndex }}>
      {sortedItems.map((item) => (
        <Sequence
          key={item.id}
          from={item.from}
          durationInFrames={item.durationInFrames}
        >
          <ItemRenderer item={item} componentPreviews={componentPreviews} tracks={allTracks} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

// =============================================
// Item Renderer
// =============================================

interface ItemRendererProps {
  item: TimelineItem;
  componentPreviews: Record<string, string>;
  tracks: Track[];
}

function ItemRenderer({ item, componentPreviews, tracks }: ItemRendererProps) {
  // Pass item's start frame so useInteractionState can calculate absolute frame
  // (useCurrentFrame() returns relative frame inside a Sequence)
  const interactionState = useInteractionState(tracks, item.from);

  switch (item.type) {
    case 'component':
      return (
        <ComponentItemRenderer
          item={item}
          previewHtml={componentPreviews[item.componentId]}
          interactionState={interactionState}
        />
      );
    case 'text':
      return <TextItemRenderer item={item} />;
    case 'video':
    case 'audio':
    case 'image':
      return <MediaItemRenderer item={item} />;
    case 'shape':
      return <ShapeItemRenderer item={item} />;
    case 'cursor':
      return <CursorOverlay item={item} />;
    case 'particles':
      return <ParticleItemRenderer item={item} />;
    default:
      return null;
  }
}
