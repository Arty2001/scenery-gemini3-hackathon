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
import { TransitionSeries, linearTiming, type TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import type { Track, TimelineItem, TransitionConfig, Scene } from '@/lib/composition/types';
import { curtain, wheel, flip, wipe, zoom, motionBlur } from '@/components/remotion/transitions/scene-transitions';
import { ComponentItemRenderer } from './component-item';
import { TextItemRenderer } from './text-item';
import { MediaItemRenderer } from './media-item';
import { CursorOverlay } from './cursor-overlay';
import { ShapeItemRenderer } from './shape-item';
import { ParticleItemRenderer } from './particle-item';
import { CustomHtmlItemRenderer } from './custom-html-item';
import { GradientItemRenderer } from './gradient-item';
import { FilmGrainItemRenderer } from './film-grain-item';
import { VignetteItemRenderer } from './vignette-item';
import { ColorGradeItemRenderer } from './color-grade-item';
import { BlobItemRenderer } from './blob-item';
import { useInteractionState } from '@/components/remotion/animation/use-interaction-state';

// =============================================
// Types
// =============================================

interface MainCompositionProps {
  tracks: Track[];
  scenes?: Scene[];  // Optional scenes for slide-based editing
  componentPreviews?: Record<string, string>; // Map of componentId -> preview HTML
}

// =============================================
// Main Composition
// =============================================

export const MainComposition: React.FC<MainCompositionProps> = ({
  tracks,
  scenes,
  componentPreviews = {},
}) => {
  // If scenes are provided, use scene-based rendering with transitions
  if (scenes && scenes.length > 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#000' }}>
        <SceneRenderer
          scenes={scenes}
          tracks={tracks}
          componentPreviews={componentPreviews}
        />
      </AbsoluteFill>
    );
  }

  // Default: render all tracks without scene grouping (backward compatible)
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
// Scene Renderer
// =============================================

interface SceneRendererProps {
  scenes: Scene[];
  tracks: Track[];
  componentPreviews: Record<string, string>;
}

function SceneRenderer({ scenes, tracks, componentPreviews }: SceneRendererProps) {
  // Sort scenes by start frame
  const sortedScenes = [...scenes].sort((a, b) => a.startFrame - b.startFrame);

  // Check if any scene has a transition
  const hasTransitions = sortedScenes.some((scene, i) => i > 0 && scene.transition);

  // Get items that belong to a specific scene (by sceneId or by time range)
  const getSceneItems = (scene: Scene, track: Track): TimelineItem[] => {
    return track.items.filter((item) => {
      // If item has explicit sceneId, use that
      if (item.sceneId) {
        return item.sceneId === scene.id;
      }
      // Otherwise, check if item falls within scene's time range
      const itemEnd = item.from + item.durationInFrames;
      const sceneEnd = scene.startFrame + scene.durationInFrames;
      return item.from >= scene.startFrame && item.from < sceneEnd;
    });
  };

  if (hasTransitions) {
    return (
      <TransitionSeries>
        {sortedScenes.map((scene, sceneIndex) => (
          <React.Fragment key={scene.id}>
            {/* Insert transition before this scene if it has one */}
            {scene.transition && sceneIndex > 0 && (
              <TransitionSeries.Transition
                presentation={getPresentation(scene.transition)}
                timing={linearTiming({
                  durationInFrames: scene.transition.durationInFrames,
                })}
              />
            )}
            <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
              <SceneContent
                scene={scene}
                tracks={tracks}
                componentPreviews={componentPreviews}
                getSceneItems={getSceneItems}
              />
            </TransitionSeries.Sequence>
          </React.Fragment>
        ))}
      </TransitionSeries>
    );
  }

  // No transitions: use regular Sequences for each scene
  return (
    <>
      {sortedScenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
        >
          <SceneContent
            scene={scene}
            tracks={tracks}
            componentPreviews={componentPreviews}
            getSceneItems={getSceneItems}
          />
        </Sequence>
      ))}
    </>
  );
}

// =============================================
// Scene Content
// =============================================

interface SceneContentProps {
  scene: Scene;
  tracks: Track[];
  componentPreviews: Record<string, string>;
  getSceneItems: (scene: Scene, track: Track) => TimelineItem[];
}

function SceneContent({ scene, tracks, componentPreviews, getSceneItems }: SceneContentProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: scene.backgroundColor || '#000' }}>
      {tracks
        .filter((track) => track.visible !== false)
        .map((track, trackIndex) => {
          const sceneItems = getSceneItems(scene, track);
          if (sceneItems.length === 0) return null;

          // Create a virtual track with only the items for this scene
          // Adjust item.from to be relative to scene start
          const adjustedTrack: Track = {
            ...track,
            items: sceneItems.map((item) => ({
              ...item,
              from: item.sceneId ? item.from : item.from - scene.startFrame,
            })),
          };

          return (
            <TrackLayer
              key={track.id}
              track={adjustedTrack}
              zIndex={trackIndex}
              componentPreviews={componentPreviews}
              allTracks={tracks}
            />
          );
        })}
    </AbsoluteFill>
  );
}

// =============================================
// Track Layer
// =============================================

interface TrackLayerProps {
  track: Track;
  zIndex: number;
  componentPreviews: Record<string, string>;
  allTracks: Track[];
}

function getPresentation(config: TransitionConfig): TransitionPresentation<Record<string, unknown>> {
  switch (config.type) {
    case 'slide':
      return slide({
        direction: config.direction
          ? (`from-${config.direction}` as 'from-left' | 'from-right' | 'from-top' | 'from-bottom')
          : 'from-left',
      }) as TransitionPresentation<Record<string, unknown>>;
    case 'curtain':
      return curtain({
        direction: config.direction === 'top' || config.direction === 'bottom'
          ? 'vertical'
          : 'horizontal',
      }) as TransitionPresentation<Record<string, unknown>>;
    case 'wheel':
      return wheel({
        direction: config.direction === 'left' ? 'counter-clockwise' : 'clockwise',
      }) as TransitionPresentation<Record<string, unknown>>;
    case 'flip':
      return flip({
        direction: config.direction === 'top' || config.direction === 'bottom'
          ? 'vertical'
          : 'horizontal',
      }) as TransitionPresentation<Record<string, unknown>>;
    case 'wipe': {
      // Map 'top'/'bottom' to 'up'/'down' for wipe direction
      const wipeDir = config.direction === 'top' ? 'up'
        : config.direction === 'bottom' ? 'down'
        : (config.direction ?? 'left');
      return wipe({
        direction: wipeDir as 'left' | 'right' | 'up' | 'down',
      }) as TransitionPresentation<Record<string, unknown>>;
    }
    case 'zoom':
      return zoom({
        direction: 'in',
      }) as TransitionPresentation<Record<string, unknown>>;
    case 'motion-blur': {
      // Map 'top'/'bottom' to 'up'/'down' for motion blur direction
      const blurDir = config.direction === 'top' ? 'up'
        : config.direction === 'bottom' ? 'down'
        : (config.direction ?? 'left');
      return motionBlur({
        direction: blurDir as 'left' | 'right' | 'up' | 'down',
        intensity: 2,
      }) as TransitionPresentation<Record<string, unknown>>;
    }
    case 'fade':
    default:
      return fade() as TransitionPresentation<Record<string, unknown>>;
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
    case 'custom-html':
      return <CustomHtmlItemRenderer item={item} />;
    case 'gradient':
      return <GradientItemRenderer item={item} />;
    case 'film-grain':
      return <FilmGrainItemRenderer item={item} />;
    case 'vignette':
      return <VignetteItemRenderer item={item} />;
    case 'color-grade':
      return <ColorGradeItemRenderer item={item} />;
    case 'blob':
      return <BlobItemRenderer item={item} />;
    default:
      return null;
  }
}
