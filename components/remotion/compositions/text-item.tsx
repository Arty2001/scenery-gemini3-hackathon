'use client';

/**
 * Text item renderer for Remotion compositions.
 *
 * Renders text overlays with configurable:
 * - Font family, size, and color
 * - Position (relative 0-1 coordinates mapped to flex alignment)
 */

import { useEffect, useState } from 'react';
import { AbsoluteFill } from 'remotion';
import { getAvailableFonts } from '@remotion/google-fonts';
import type { TextItem } from '@/lib/composition/types';
import { useItemAnimation } from '@/components/remotion/animation/use-item-animation';
import { useKeyframeAnimation } from '@/components/remotion/animation/use-keyframe-animation';
import { useCompositionStore } from '@/lib/composition/store';
import { buildFilterStyle, buildSkewTransform, buildShadowStyle } from '@/components/remotion/animation/build-styles';

// =============================================
// Types
// =============================================

interface TextItemRendererProps {
  item: TextItem;
}

// =============================================
// Helper Functions
// =============================================

/**
 * Convert relative position (0-1) to CSS translate offset.
 * 0 = 0%, 0.5 = -50% (centered), 1 = -100%
 */
function getTranslatePercent(position: number): string {
  return `${-position * 100}%`;
}

/**
 * Ensure text always has a readable background.
 * If transparent or too light, enforce a dark semi-transparent background.
 */
function ensureReadableBackground(bg: string | undefined): string {
  if (!bg || bg === 'transparent' || bg === 'none') {
    return 'rgba(0, 0, 0, 0.85)';
  }

  // If it's rgba with low alpha, boost the alpha
  const rgbaMatch = bg.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    const alpha = a !== undefined ? parseFloat(a) : 1;
    // If alpha is too low (< 0.6), enforce minimum for readability
    if (alpha < 0.6) {
      return `rgba(${r}, ${g}, ${b}, 0.85)`;
    }
  }

  return bg;
}

// =============================================
// Component
// =============================================

const availableFonts = getAvailableFonts();

export function TextItemRenderer({ item }: TextItemRendererProps) {
  const animStyle = useItemAnimation(item.enterAnimation, item.exitAnimation, item.durationInFrames);
  const kf = useKeyframeAnimation(item.keyframes);
  const isSelected = useCompositionStore((s) => s.selectedItemId) === item.id;
  const [loadedFamily, setLoadedFamily] = useState<string>(item.fontFamily);

  useEffect(() => {
    const match = availableFonts.find((f) => f.fontFamily === item.fontFamily);
    if (match) {
      match.load().then((googleFont) => {
        googleFont.loadFont();
        setLoadedFamily(googleFont.fontFamily);
      });
    } else {
      setLoadedFamily(item.fontFamily);
    }
  }, [item.fontFamily]);

  // Keyframes override static values
  const posX = kf.positionX ?? item.position?.x ?? 0.5;
  const posY = kf.positionY ?? item.position?.y ?? 0.5;
  const kfOpacity = kf.opacity ?? 1;
  const kfScale = kf.scale ?? 1;
  const kfFontSize = kf.fontSize ?? item.fontSize;
  const kfRotation = kf.rotation ?? 0;

  // Advanced animation properties
  const kfLetterSpacing = kf.letterSpacing ?? item.letterSpacing;
  const kfWordSpacing = kf.wordSpacing;
  const kfBorderRadius = kf.borderRadius ?? item.borderRadius ?? 10;

  // Build filter and shadow styles from keyframes
  const filterStyle = buildFilterStyle(kf);
  const skewTransform = buildSkewTransform(kf);
  const shadowStyle = buildShadowStyle(kf);

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
            skewTransform,
          ].filter(Boolean).join(' '),
          opacity: animStyle.opacity * kfOpacity,
          filter: filterStyle !== 'none' ? filterStyle : undefined,
          maxWidth: '90%',
          outline: isSelected ? '2px solid rgba(59,130,246,0.7)' : undefined,
          outlineOffset: 4,
          borderRadius: isSelected ? 4 : undefined,
        }}
      >
        <div
          style={{
            fontFamily: loadedFamily,
            fontSize: kfFontSize,
            color: item.color ?? '#ffffff',
            fontWeight: item.fontWeight ?? 400,
            textAlign: item.textAlign ?? 'left',
            // ALWAYS ensure readable background - enforce minimum opacity
            backgroundColor: ensureReadableBackground(item.backgroundColor),
            padding: item.padding ?? 16,
            borderRadius: kfBorderRadius,
            // Always add text shadow for readability over any background
            textShadow: item.textShadow ?? '0 2px 4px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)',
            boxShadow: shadowStyle ?? '0 4px 24px rgba(0,0,0,0.4)',
            letterSpacing: kfLetterSpacing != null ? `${kfLetterSpacing}px` : undefined,
            wordSpacing: kfWordSpacing != null ? `${kfWordSpacing}px` : undefined,
            lineHeight: item.lineHeight != null ? item.lineHeight : 1.4,
            whiteSpace: 'pre-wrap',
            // Ensure text is always crisp
            WebkitFontSmoothing: 'antialiased',
          } as React.CSSProperties}
        >
          {item.text}
        </div>
      </div>
    </AbsoluteFill>
  );
}
