'use client';

/**
 * Text item renderer for Remotion compositions.
 *
 * Renders text overlays with configurable:
 * - Font family, size, and color
 * - Position (relative 0-1 coordinates mapped to flex alignment)
 * - Per-letter animation with various effects
 */

import { useEffect, useState, useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { getAvailableFonts } from '@remotion/google-fonts';
import type { TextItem, LetterAnimation, LetterAnimationType, TextGradient, GlowEffect, GlassEffect, TextAnimationMode } from '@/lib/composition/types';
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
 * Get background color, respecting user's choice including transparent.
 */
function getBackgroundColor(bg: string | undefined): string | undefined {
  if (!bg || bg === 'transparent' || bg === 'none') {
    return undefined; // Truly transparent - no background
  }
  return bg;
}

/**
 * Build CSS for gradient text fill.
 */
function buildGradientTextStyles(
  gradient: TextGradient | undefined,
  frame: number
): React.CSSProperties | undefined {
  if (!gradient?.enabled || !gradient.colors || gradient.colors.length < 2) {
    return undefined;
  }

  // Calculate animated angle if enabled
  let angle = gradient.angle ?? 90;
  if (gradient.animate) {
    const speed = gradient.speed ?? 1;
    angle = (angle + (frame * speed)) % 360;
  }

  const colorStops = gradient.colors
    .map(stop => `${stop.color} ${stop.position}%`)
    .join(', ');

  return {
    background: `linear-gradient(${angle}deg, ${colorStops})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  } as React.CSSProperties;
}

/**
 * Build CSS for glow effect.
 */
function buildGlowStyles(
  glow: GlowEffect | undefined,
  frame: number
): React.CSSProperties | undefined {
  if (!glow?.enabled) {
    return undefined;
  }

  let intensity = glow.intensity ?? 0.5;

  // Animate pulse if enabled
  if (glow.animate) {
    const pulseSpeed = glow.pulseSpeed ?? 1;
    // Oscillate intensity between 50% and 100%
    const pulse = Math.sin(frame * 0.1 * pulseSpeed) * 0.25 + 0.75;
    intensity = intensity * pulse;
  }

  const size = glow.size ?? 20;
  const color = glow.color ?? '#ffffff';

  // Multiple shadows for richer glow
  const shadows = [
    `0 0 ${size * 0.5}px ${color}${Math.round(intensity * 80).toString(16).padStart(2, '0')}`,
    `0 0 ${size}px ${color}${Math.round(intensity * 60).toString(16).padStart(2, '0')}`,
    `0 0 ${size * 2}px ${color}${Math.round(intensity * 40).toString(16).padStart(2, '0')}`,
  ].join(', ');

  return {
    textShadow: shadows,
  };
}

/**
 * Build CSS for glass/frosted effect on background.
 */
function buildGlassStyles(
  glass: GlassEffect | undefined
): React.CSSProperties | undefined {
  if (!glass?.enabled) {
    return undefined;
  }

  const blur = glass.blur ?? 10;
  const opacity = glass.opacity ?? 0.2;
  const tint = glass.tint ?? 'rgba(255,255,255,0.1)';
  const saturation = glass.saturation ?? 1.2;

  return {
    backdropFilter: `blur(${blur}px) saturate(${saturation})`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(${saturation})`,
    backgroundColor: tint.includes('rgba') ? tint : `${tint}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
  } as React.CSSProperties;
}

/**
 * Get the animation order indices based on direction.
 * Works for both letter-by-letter and word-by-word animation.
 */
function getAnimationIndices(length: number, direction: LetterAnimation['direction']): number[] {
  const indices = Array.from({ length }, (_, i) => i);

  switch (direction) {
    case 'backward':
      return indices.reverse();
    case 'center': {
      // Animate from center outward
      const center = Math.floor(length / 2);
      const result: number[] = [];
      for (let i = 0; i <= center; i++) {
        if (center - i >= 0) result.push(center - i);
        if (center + i < length && i !== 0) result.push(center + i);
      }
      return result;
    }
    case 'random': {
      // Shuffle using seeded random (consistent across frames)
      const shuffled = [...indices];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor((Math.sin(i * 12.9898) * 43758.5453) % 1 * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }
    case 'forward':
    default:
      return indices;
  }
}

/**
 * Split text into words while preserving spaces.
 * Returns array of word objects with text and whether it's a space.
 */
function splitIntoWords(text: string): { text: string; isSpace: boolean }[] {
  const result: { text: string; isSpace: boolean }[] = [];
  const regex = /(\s+)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add the word before the space
    if (match.index > lastIndex) {
      result.push({ text: text.slice(lastIndex, match.index), isSpace: false });
    }
    // Add the space(s)
    result.push({ text: match[1], isSpace: true });
    lastIndex = regex.lastIndex;
  }

  // Add any remaining text after the last space
  if (lastIndex < text.length) {
    result.push({ text: text.slice(lastIndex), isSpace: false });
  }

  return result;
}

/**
 * Get easing function based on type.
 */
function getEasing(easing: LetterAnimation['easing']) {
  switch (easing) {
    case 'linear':
      return Easing.linear;
    case 'ease-in-out':
      return Easing.inOut(Easing.cubic);
    case 'spring':
      return Easing.out(Easing.back(1.5));
    case 'ease-out':
    default:
      return Easing.out(Easing.cubic);
  }
}

/**
 * Calculate letter animation style based on type and progress.
 */
function getLetterAnimationStyle(
  type: LetterAnimationType,
  progress: number // 0 = start, 1 = fully visible
): React.CSSProperties {
  // Clamp progress
  const p = Math.max(0, Math.min(1, progress));

  switch (type) {
    case 'fade':
      return { opacity: p };

    case 'slide-up':
      return {
        opacity: p,
        transform: `translateY(${(1 - p) * 30}px)`,
      };

    case 'slide-down':
      return {
        opacity: p,
        transform: `translateY(${(1 - p) * -30}px)`,
      };

    case 'slide-left':
      return {
        opacity: p,
        transform: `translateX(${(1 - p) * 30}px)`,
      };

    case 'slide-right':
      return {
        opacity: p,
        transform: `translateX(${(1 - p) * -30}px)`,
      };

    case 'scale':
      return {
        opacity: p,
        transform: `scale(${0.3 + p * 0.7})`,
      };

    case 'scale-down':
      return {
        opacity: p,
        transform: `scale(${1.5 - p * 0.5})`,
      };

    case 'blur':
      return {
        opacity: p,
        filter: `blur(${(1 - p) * 8}px)`,
      };

    case 'rotate':
      return {
        opacity: p,
        transform: `rotate(${(1 - p) * 90}deg) scale(${0.5 + p * 0.5})`,
      };

    case 'bounce':
      // Overshoot effect
      const bounceP = p < 0.6 ? p / 0.6 : 1 + Math.sin((p - 0.6) / 0.4 * Math.PI) * 0.1;
      return {
        opacity: Math.min(1, p * 1.5),
        transform: `translateY(${(1 - bounceP) * 40}px) scale(${0.8 + bounceP * 0.2})`,
      };

    case 'typewriter':
      // Instant appear (step function)
      return {
        opacity: p > 0 ? 1 : 0,
      };

    default:
      return { opacity: p };
  }
}

// =============================================
// Animated Letter Component
// =============================================

interface AnimatedLetterProps {
  char: string;
  index: number;
  orderIndex: number; // Position in animation order (may differ from index)
  letterAnim: LetterAnimation;
  frame: number;
  baseStyle: React.CSSProperties;
}

function AnimatedLetter({ char, orderIndex, letterAnim, frame, baseStyle }: AnimatedLetterProps) {
  const { type, staggerFrames, durationPerLetter, easing } = letterAnim;

  // Calculate when this letter starts animating
  const startFrame = orderIndex * staggerFrames;
  const endFrame = startFrame + durationPerLetter;

  // Calculate progress (0-1)
  const rawProgress = (frame - startFrame) / durationPerLetter;
  const easingFn = getEasing(easing);
  const progress = easingFn(Math.max(0, Math.min(1, rawProgress)));

  // Get animation style based on type and progress
  const animStyle = getLetterAnimationStyle(type, progress);

  // Preserve whitespace
  if (char === ' ') {
    return <span style={{ ...baseStyle, ...animStyle }}>&nbsp;</span>;
  }

  return (
    <span
      style={{
        ...baseStyle,
        ...animStyle,
        display: 'inline-block',
        willChange: 'transform, opacity, filter',
      }}
    >
      {char}
    </span>
  );
}

// =============================================
// Animated Word Component
// =============================================

interface AnimatedWordProps {
  word: { text: string; isSpace: boolean };
  orderIndex: number; // Position in animation order
  letterAnim: LetterAnimation;
  frame: number;
  baseStyle: React.CSSProperties;
}

function AnimatedWord({ word, orderIndex, letterAnim, frame, baseStyle }: AnimatedWordProps) {
  const { type, staggerFrames, durationPerLetter, easing } = letterAnim;

  // Calculate when this word starts animating
  const startFrame = orderIndex * staggerFrames;

  // Calculate progress (0-1)
  const rawProgress = (frame - startFrame) / durationPerLetter;
  const easingFn = getEasing(easing);
  const progress = easingFn(Math.max(0, Math.min(1, rawProgress)));

  // Get animation style based on type and progress
  const animStyle = getLetterAnimationStyle(type, progress);

  // Render spaces normally (no animation effect on whitespace)
  if (word.isSpace) {
    return (
      <span style={{ ...baseStyle, whiteSpace: 'pre' }}>{word.text}</span>
    );
  }

  return (
    <span
      style={{
        ...baseStyle,
        ...animStyle,
        display: 'inline-block',
        willChange: 'transform, opacity, filter',
      }}
    >
      {word.text}
    </span>
  );
}

// =============================================
// Component
// =============================================

const availableFonts = getAvailableFonts();

export function TextItemRenderer({ item }: TextItemRendererProps) {
  const frame = useCurrentFrame();
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

  // Text animation setup (letter or word mode)
  const letterAnim = item.letterAnimation;
  const hasTextAnimation = letterAnim?.enabled && letterAnim.type;
  const animationMode = letterAnim?.mode ?? 'letter';

  // Pre-calculate animation order indices (memoized for performance)
  // Works for both letter-by-letter and word-by-word modes
  const { orderMap, words } = useMemo(() => {
    if (!hasTextAnimation) return { orderMap: null, words: null };

    if (animationMode === 'word') {
      // Word mode: split into words
      const wordList = splitIntoWords(item.text);
      // Only animate non-space words
      const animatableIndices = wordList
        .map((w, i) => (w.isSpace ? -1 : i))
        .filter(i => i !== -1);
      const orderIndices = getAnimationIndices(animatableIndices.length, letterAnim?.direction);

      // Create map from animatable index to animation order
      const map = new Map<number, number>();
      orderIndices.forEach((origPos, orderPos) => {
        map.set(animatableIndices[origPos], orderPos);
      });

      return { orderMap: map, words: wordList };
    } else {
      // Letter mode: split into characters
      const chars = item.text.split('');
      const orderIndices = getAnimationIndices(chars.length, letterAnim?.direction);
      const map = new Map<number, number>();
      orderIndices.forEach((originalIndex, orderPosition) => {
        map.set(originalIndex, orderPosition);
      });
      return { orderMap: map, words: null };
    }
  }, [hasTextAnimation, item.text, letterAnim?.direction, animationMode]);

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

  // Build gradient, glow, and glass styles
  const gradientStyles = buildGradientTextStyles(item.gradient, frame);
  const glowStyles = buildGlowStyles(item.glow, frame);
  const glassStyles = buildGlassStyles(item.glass);

  // Determine if we have gradient text (changes how we style)
  const hasGradientText = gradientStyles != null;

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
          maxWidth: item.maxWidth ? `${item.maxWidth}px` : '90%',
          outline: isSelected ? '2px solid rgba(59,130,246,0.7)' : undefined,
          outlineOffset: 4,
          borderRadius: isSelected ? 4 : undefined,
        }}
      >
        <div
          style={{
            fontFamily: loadedFamily,
            fontSize: kfFontSize,
            // Use gradient styles color handling if gradient is enabled, otherwise solid color
            color: hasGradientText ? undefined : (item.color ?? '#ffffff'),
            fontWeight: item.fontWeight ?? 400,
            textAlign: item.textAlign ?? 'left',
            // Apply glass effect to background if enabled, otherwise use background color
            ...(glassStyles ?? {}),
            backgroundColor: glassStyles ? undefined : getBackgroundColor(item.backgroundColor),
            padding: (glassStyles || getBackgroundColor(item.backgroundColor)) ? (item.padding ?? 16) : 0,
            borderRadius: (glassStyles || getBackgroundColor(item.backgroundColor)) ? kfBorderRadius : 0,
            // Text shadow: use glow effect if enabled, otherwise default shadow
            textShadow: glowStyles?.textShadow ?? item.textShadow ?? (
              getBackgroundColor(item.backgroundColor)
                ? '0 2px 4px rgba(0,0,0,0.3)'
                : '0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)'
            ),
            // Only show box shadow when there's a background
            boxShadow: (glassStyles || getBackgroundColor(item.backgroundColor)) ? (shadowStyle ?? '0 4px 24px rgba(0,0,0,0.4)') : undefined,
            letterSpacing: kfLetterSpacing != null ? `${kfLetterSpacing}px` : undefined,
            wordSpacing: kfWordSpacing != null ? `${kfWordSpacing}px` : undefined,
            lineHeight: item.lineHeight != null ? item.lineHeight : 1.4,
            whiteSpace: item.noWrap ? 'nowrap' : 'pre-wrap',
            WebkitFontSmoothing: 'antialiased',
            // Apply gradient text styles
            ...gradientStyles,
          } as React.CSSProperties}
        >
          {hasTextAnimation && letterAnim && orderMap ? (
            // Render animated text (letter or word mode)
            animationMode === 'word' && words ? (
              // Word-by-word animation
              words.map((word, index) => (
                <AnimatedWord
                  key={index}
                  word={word}
                  orderIndex={orderMap.get(index) ?? 0}
                  letterAnim={letterAnim}
                  frame={frame}
                  baseStyle={{
                    color: 'inherit',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    fontWeight: 'inherit',
                  }}
                />
              ))
            ) : (
              // Letter-by-letter animation
              item.text.split('').map((char, index) => (
                <AnimatedLetter
                  key={index}
                  char={char}
                  index={index}
                  orderIndex={orderMap.get(index) ?? index}
                  letterAnim={letterAnim}
                  frame={frame}
                  baseStyle={{
                    color: 'inherit',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    fontWeight: 'inherit',
                  }}
                />
              ))
            )
          ) : (
            // Regular text rendering
            item.text
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
}
