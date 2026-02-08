'use client';

/**
 * Blob/Organic Shapes Effect Renderer
 *
 * Creates animated organic blob shapes for backgrounds and visual effects.
 * Uses SVG path morphing for smooth animations.
 */

import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import type { BlobItem, BlobAnimationStyle } from '@/lib/composition/types';

interface BlobItemRendererProps {
  item: BlobItem;
}

// Generate a random blob path with specified complexity
function generateBlobPath(
  seed: number,
  centerX: number,
  centerY: number,
  radius: number,
  complexity: number,
  frame: number,
  animationStyle: BlobAnimationStyle,
  speed: number
): string {
  const points = Math.floor(6 + complexity * 8); // 6-14 points based on complexity
  const angleStep = (Math.PI * 2) / points;
  const pathPoints: { x: number; y: number }[] = [];

  // Pseudo-random function based on seed
  const random = (n: number) => {
    const x = Math.sin(seed * 9999 + n * 7919) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < points; i++) {
    const angle = i * angleStep;
    let radiusVariation = 0;

    switch (animationStyle) {
      case 'morph':
        // Smooth morphing between shapes
        const morphPhase = (frame * speed * 0.02) % (Math.PI * 2);
        radiusVariation = Math.sin(angle * 3 + morphPhase + random(i) * Math.PI) * 0.3;
        break;
      case 'float':
        // Gentle floating movement
        const floatPhase = (frame * speed * 0.01) % (Math.PI * 2);
        radiusVariation = Math.sin(floatPhase + random(i) * Math.PI * 2) * 0.15;
        break;
      case 'pulse':
        // Pulsing in and out
        const pulsePhase = (frame * speed * 0.03) % (Math.PI * 2);
        radiusVariation = Math.sin(pulsePhase) * 0.2;
        break;
      case 'wave':
        // Wave-like deformation
        const wavePhase = (frame * speed * 0.02) % (Math.PI * 2);
        radiusVariation = Math.sin(angle * 2 + wavePhase) * 0.25;
        break;
    }

    const r = radius * (1 + radiusVariation + (random(i) - 0.5) * complexity * 0.4);
    pathPoints.push({
      x: centerX + Math.cos(angle) * r,
      y: centerY + Math.sin(angle) * r,
    });
  }

  // Create smooth bezier curve through points
  let path = `M ${pathPoints[0].x} ${pathPoints[0].y}`;

  for (let i = 0; i < points; i++) {
    const current = pathPoints[i];
    const next = pathPoints[(i + 1) % points];
    const nextNext = pathPoints[(i + 2) % points];

    // Calculate control points for smooth curve
    const cp1x = current.x + (next.x - pathPoints[(i - 1 + points) % points].x) * 0.25;
    const cp1y = current.y + (next.y - pathPoints[(i - 1 + points) % points].y) * 0.25;
    const cp2x = next.x - (nextNext.x - current.x) * 0.25;
    const cp2y = next.y - (nextNext.y - current.y) * 0.25;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }

  path += ' Z';
  return path;
}

export const BlobItemRenderer: React.FC<BlobItemRendererProps> = ({ item }) => {
  const frame = useCurrentFrame();
  const {
    colors = ['#6366f1', '#8b5cf6', '#a855f7'],
    blobCount = 3,
    complexity = 0.5,
    animationStyle = 'morph',
    speed = 1,
    opacity = 0.8,
    blendMode = 'normal',
    position = { x: 0.5, y: 0.5 },
    scale = 1,
  } = item;

  // Generate blob layers
  const blobs = useMemo(() => {
    return Array.from({ length: blobCount }, (_, i) => {
      const layerSeed = i * 1234 + 5678;
      const layerScale = 1 - i * 0.15; // Each layer slightly smaller
      const layerOpacity = 1 - i * 0.2; // Each layer slightly more transparent

      return {
        seed: layerSeed,
        color: colors[i % colors.length],
        scale: layerScale,
        opacity: layerOpacity,
        speedOffset: i * 0.3, // Stagger animation
      };
    });
  }, [blobCount, colors]);

  // Animation for floating movement
  const floatOffsetX = animationStyle === 'float'
    ? interpolate(
        (frame * speed) % 120,
        [0, 60, 120],
        [0, 15, 0],
        { easing: Easing.inOut(Easing.ease) }
      )
    : 0;

  const floatOffsetY = animationStyle === 'float'
    ? interpolate(
        (frame * speed + 30) % 120,
        [0, 60, 120],
        [0, 10, 0],
        { easing: Easing.inOut(Easing.ease) }
      )
    : 0;

  // Center position in pixels (assuming 1920x1080)
  const centerX = 960; // Will be scaled with viewBox
  const centerY = 540;
  const baseRadius = 400 * scale;

  return (
    <AbsoluteFill
      style={{
        opacity,
        mixBlendMode: blendMode as React.CSSProperties['mixBlendMode'],
        pointerEvents: 'none',
      }}
    >
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{
          width: '100%',
          height: '100%',
          transform: `translate(${(position.x - 0.5) * 100}%, ${(position.y - 0.5) * 100}%) translate(${floatOffsetX}px, ${floatOffsetY}px)`,
        }}
      >
        <defs>
          {/* Gradient definitions for each blob */}
          {blobs.map((blob, i) => (
            <radialGradient
              key={`gradient-${i}`}
              id={`blob-gradient-${item.id}-${i}`}
              cx="50%"
              cy="50%"
              r="50%"
            >
              <stop offset="0%" stopColor={blob.color} stopOpacity="1" />
              <stop offset="100%" stopColor={blob.color} stopOpacity="0.3" />
            </radialGradient>
          ))}

          {/* Blur filter for soft edges */}
          <filter id={`blob-blur-${item.id}`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="20" />
          </filter>
        </defs>

        {/* Render blob layers from back to front */}
        {blobs.map((blob, i) => {
          const adjustedFrame = frame + blob.speedOffset * 30;
          const path = generateBlobPath(
            blob.seed,
            centerX,
            centerY,
            baseRadius * blob.scale,
            complexity,
            adjustedFrame,
            animationStyle,
            speed
          );

          return (
            <path
              key={i}
              d={path}
              fill={`url(#blob-gradient-${item.id}-${i})`}
              opacity={blob.opacity}
              filter={`url(#blob-blur-${item.id})`}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
