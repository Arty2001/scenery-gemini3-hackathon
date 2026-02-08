'use client';

/**
 * Animated gradient background renderer for Remotion compositions.
 *
 * Renders beautiful animated gradient backgrounds with support for:
 * - Linear, radial, and conic gradients
 * - Multiple color stops
 * - Angle animation (rotation)
 * - Color shifting animation
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { GradientItem, GradientColorStop } from '@/lib/composition/types';
import { useItemAnimation } from '@/components/remotion/animation/use-item-animation';
import { useKeyframeAnimation } from '@/components/remotion/animation/use-keyframe-animation';

// =============================================
// Types
// =============================================

interface GradientItemRendererProps {
  item: GradientItem;
}

// =============================================
// Helper Functions
// =============================================

/**
 * Convert relative position (0-1) to CSS translate offset.
 */
function getTranslatePercent(position: number): string {
  return `${-position * 100}%`;
}

/**
 * Build CSS color stops string from gradient color stops.
 */
function buildColorStops(colors: GradientColorStop[]): string {
  return colors
    .map(stop => `${stop.color} ${stop.position}%`)
    .join(', ');
}

/**
 * Shift colors through stops for animation effect.
 * Creates a seamless looping color shift.
 */
function shiftColors(colors: GradientColorStop[], progress: number): GradientColorStop[] {
  if (colors.length < 2) return colors;

  // Shift position by progress (0-1 maps to 0-100%)
  const shift = progress * 100;

  return colors.map(stop => ({
    ...stop,
    position: ((stop.position + shift) % 100 + 100) % 100,
  })).sort((a, b) => a.position - b.position);
}

/**
 * Build the gradient CSS string.
 */
function buildGradientCSS(
  type: 'linear' | 'radial' | 'conic',
  colors: GradientColorStop[],
  angle: number,
  centerX: number,
  centerY: number
): string {
  const colorStops = buildColorStops(colors);

  switch (type) {
    case 'linear':
      return `linear-gradient(${angle}deg, ${colorStops})`;
    case 'radial':
      return `radial-gradient(circle at ${centerX * 100}% ${centerY * 100}%, ${colorStops})`;
    case 'conic':
      return `conic-gradient(from ${angle}deg at ${centerX * 100}% ${centerY * 100}%, ${colorStops})`;
    default:
      return `linear-gradient(${angle}deg, ${colorStops})`;
  }
}

// =============================================
// Component
// =============================================

export function GradientItemRenderer({ item }: GradientItemRendererProps) {
  const frame = useCurrentFrame();
  const { width: compWidth, height: compHeight } = useVideoConfig();
  const animStyle = useItemAnimation(item.enterAnimation, item.exitAnimation, item.durationInFrames);
  const kf = useKeyframeAnimation(item.keyframes);

  // Get keyframe values with fallbacks
  const posX = kf.positionX ?? item.position?.x ?? 0.5;
  const posY = kf.positionY ?? item.position?.y ?? 0.5;
  const kfWidth = kf.width ?? item.width ?? 1;
  const kfHeight = kf.height ?? item.height ?? 1;
  const kfOpacity = kf.opacity ?? 1;
  const kfScale = kf.scale ?? 1;
  const kfRotation = kf.rotation ?? 0;

  // Calculate pixel dimensions
  const w = kfWidth * compWidth;
  const h = kfHeight * compHeight;

  // Animation settings
  const speed = item.speed ?? 1;
  const animate = item.animate ?? false;
  const animateAngle = item.animateAngle ?? false;
  const animateColors = item.animateColors ?? false;

  // Calculate animated angle
  let angle = item.angle ?? 135;
  if (animate && animateAngle) {
    // Complete rotation over ~300 frames (10 seconds at 30fps) adjusted by speed
    const rotationProgress = (frame * speed) / 300;
    angle = (item.angle ?? 0) + (rotationProgress * 360);
  }

  // Calculate animated color shift
  let colors = item.colors;
  if (animate && animateColors && colors.length >= 2) {
    // Complete color cycle over ~180 frames (6 seconds at 30fps) adjusted by speed
    const colorProgress = ((frame * speed) / 180) % 1;
    colors = shiftColors(item.colors, colorProgress);
  }

  // Build gradient CSS
  const gradientCSS = buildGradientCSS(
    item.gradientType,
    colors,
    angle,
    item.centerX ?? 0.5,
    item.centerY ?? 0.5
  );

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: `${posX * 100}%`,
          top: `${posY * 100}%`,
          transform: [
            `translate(${getTranslatePercent(posX)}, ${getTranslatePercent(posY)})`,
            kfScale !== 1 ? `scale(${kfScale})` : '',
            kfRotation !== 0 ? `rotate(${kfRotation}deg)` : '',
          ].filter(Boolean).join(' '),
          width: w,
          height: h,
          opacity: kfOpacity * (animStyle.opacity ?? 1),
          background: gradientCSS,
        }}
      />
    </AbsoluteFill>
  );
}
