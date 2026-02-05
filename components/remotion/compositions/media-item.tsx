'use client';

/**
 * Media item renderer for Remotion compositions.
 *
 * Renders video, audio, and image items with support for:
 * - 0-1 normalised positioning
 * - Shape clipping (circle, rounded-rect, hexagon, diamond)
 * - Keyframe animations (positionX/Y, scale, opacity)
 */

import { AbsoluteFill, OffthreadVideo, Audio, Img, useVideoConfig } from 'remotion';
import type { MediaItem, ImageItem } from '@/lib/composition/types';
import { useItemAnimation } from '@/components/remotion/animation/use-item-animation';
import { useKeyframeAnimation } from '@/components/remotion/animation/use-keyframe-animation';
import { buildFilterStyle, buildSkewTransform, buildShadowStyle } from '@/components/remotion/animation/build-styles';

// =============================================
// Clip-path map
// =============================================

const CLIP_PATHS: Record<string, string> = {
  circle: 'circle(50% at 50% 50%)',
  'rounded-rect': 'inset(0 round 16px)',
  hexagon: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
  diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
};

// =============================================
// Helpers
// =============================================

function getTranslatePercent(v: number) {
  return v <= 0.25 ? '0%' : v >= 0.75 ? '-100%' : '-50%';
}

// =============================================
// Component
// =============================================

interface MediaItemRendererProps {
  item: MediaItem | ImageItem;
}

export function MediaItemRenderer({ item }: MediaItemRendererProps) {
  const animStyle = useItemAnimation(item.enterAnimation, item.exitAnimation, item.durationInFrames);
  const kf = useKeyframeAnimation(item.keyframes);
  const { width: compWidth, height: compHeight } = useVideoConfig();

  // Guard: skip rendering if src is missing
  if (!item.src) {
    return (
      <AbsoluteFill>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#1a1a2e', color: '#666' }}>
          <span>No media source</span>
        </div>
      </AbsoluteFill>
    );
  }

  // Audio items don't need a visual container
  if (item.type === 'audio') {
    return (
      <Audio
        src={item.src}
        volume={(item as MediaItem).volume}
        startFrom={(item as MediaItem).startFrom}
      />
    );
  }

  // Resolve position (keyframe overrides static)
  const posX = kf.positionX ?? item.position?.x;
  const posY = kf.positionY ?? item.position?.y;
  const hasPosition = posX != null || posY != null;
  const finalX = posX ?? 0.5;
  const finalY = posY ?? 0.5;

  // Resolve size
  const w = item.width != null ? item.width * compWidth : compWidth;
  const h = item.height != null ? item.height * compHeight : compHeight;

  // Clip shape
  const clipPath = item.clipShape && item.clipShape !== 'none'
    ? CLIP_PATHS[item.clipShape]
    : undefined;

  // Keyframe overrides
  const kfOpacity = kf.opacity ?? 1;
  const kfScale = kf.scale ?? 1;
  const kfRotation = kf.rotation ?? 0;

  // Build advanced styles from keyframes
  const filterStyle = buildFilterStyle(kf);
  const skewTransform = buildSkewTransform(kf);
  const shadowStyle = buildShadowStyle(kf);

  // Build transforms
  const transforms: string[] = [];
  if (hasPosition) {
    transforms.push(`translate(${getTranslatePercent(finalX)}, ${getTranslatePercent(finalY)})`);
  }
  if (kfScale !== 1) transforms.push(`scale(${kfScale})`);
  if (kfRotation !== 0) transforms.push(`rotate(${kfRotation}deg)`);
  if (skewTransform) transforms.push(skewTransform);
  if (animStyle.transform && animStyle.transform !== 'none') transforms.push(animStyle.transform);
  const transform = transforms.length > 0 ? transforms.join(' ') : 'none';

  // Positioning style
  const positionStyle: React.CSSProperties = hasPosition
    ? {
        position: 'absolute',
        left: `${finalX * 100}%`,
        top: `${finalY * 100}%`,
      }
    : {
        position: 'absolute',
        inset: 0,
      };

  // The visual content
  const mediaElement = item.type === 'image' ? (
    <Img
      src={item.src}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  ) : (
    <OffthreadVideo
      src={item.src}
      volume={(item as MediaItem).volume}
      startFrom={(item as MediaItem).startFrom}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );

  return (
    <AbsoluteFill>
      <div
        style={{
          ...positionStyle,
          width: w,
          height: h,
          opacity: animStyle.opacity * kfOpacity,
          transform,
          filter: filterStyle !== 'none' ? filterStyle : undefined,
          boxShadow: shadowStyle,
          clipPath,
          overflow: 'hidden',
        }}
      >
        {mediaElement}
      </div>
    </AbsoluteFill>
  );
}
