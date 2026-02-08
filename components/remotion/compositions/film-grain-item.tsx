'use client';

/**
 * Film Grain Effect Renderer
 *
 * Creates an animated noise overlay for a cinematic film look.
 * Uses canvas-based noise generation for smooth animation.
 */

import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, random } from 'remotion';
import type { FilmGrainItem } from '@/lib/composition/types';

interface FilmGrainItemRendererProps {
  item: FilmGrainItem;
}

export const FilmGrainItemRenderer: React.FC<FilmGrainItemRendererProps> = ({
  item,
}) => {
  const frame = useCurrentFrame();
  const {
    intensity = 0.3,
    speed = 1,
    size = 1,
    colored = false,
    blendMode = 'overlay',
  } = item;

  // Generate grain pattern that changes each frame
  const grainSeed = Math.floor(frame * speed) % 10000;

  // Create SVG noise filter for grain effect
  const grainStyle = useMemo(() => {
    // Use frame-based seed for animation
    const baseFrequency = 0.65 / size;

    return {
      position: 'absolute' as const,
      inset: 0,
      width: '100%',
      height: '100%',
      mixBlendMode: blendMode as React.CSSProperties['mixBlendMode'],
      opacity: intensity,
      pointerEvents: 'none' as const,
    };
  }, [blendMode, intensity, size]);

  // Animate the noise position for grain movement
  const offsetX = random(`grain-x-${grainSeed}`) * 200 - 100;
  const offsetY = random(`grain-y-${grainSeed}`) * 200 - 100;

  // Unique filter ID per item to avoid conflicts
  const filterId = `grain-filter-${item.id}`;
  const baseFrequency = 0.65 / size;

  return (
    <AbsoluteFill style={grainStyle}>
      <svg
        width="100%"
        height="100%"
        style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}
      >
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={baseFrequency}
              numOctaves={3}
              seed={grainSeed}
              result="noise"
            />
            {colored ? (
              // Colored grain: use the noise directly with saturation
              <feColorMatrix
                in="noise"
                type="saturate"
                values="0.3"
                result="coloredNoise"
              />
            ) : (
              // Monochrome grain: desaturate completely
              <feColorMatrix
                in="noise"
                type="saturate"
                values="0"
                result="coloredNoise"
              />
            )}
            <feComponentTransfer in="coloredNoise" result="grain">
              <feFuncR type="linear" slope="2" intercept="-0.5" />
              <feFuncG type="linear" slope="2" intercept="-0.5" />
              <feFuncB type="linear" slope="2" intercept="-0.5" />
              <feFuncA type="linear" slope="1" intercept="0" />
            </feComponentTransfer>
          </filter>
        </defs>
        <rect
          width="100%"
          height="100%"
          filter={`url(#${filterId})`}
          fill="gray"
        />
      </svg>
    </AbsoluteFill>
  );
};
