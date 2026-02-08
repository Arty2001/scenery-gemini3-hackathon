/**
 * Animation hook for timeline items.
 *
 * Implements animation patterns inspired by Remotion Lambda trailer:
 * - Spring physics with configurable presets (damping: 200 standard)
 * - Stagger delay support for multi-item sequences
 * - Advanced animations: flip, zoom-blur
 *
 * @see https://github.com/remotion-dev/trailer-lambda
 */

import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { AnimationConfig } from '@/lib/composition/types';
import { getSpringConfig } from './spring-presets';

interface AnimResult {
  opacity: number;
  transform: string;
  filter?: string;
}

/**
 * Compute enter animation based on config type.
 * Applies stagger delay if specified.
 */
function computeEnter(frame: number, fps: number, config: AnimationConfig): AnimResult {
  const dur = Math.max(1, config.durationInFrames ?? 15);
  const staggerDelay = config.staggerDelay ?? 0;

  // Apply stagger delay - animation doesn't start until delay passes
  const delayedFrame = Math.max(0, frame - staggerDelay);

  // Get spring config based on preset
  const springConfig = getSpringConfig(config.springPreset);

  // Compute spring progress (0 to 1)
  const progress = spring({
    frame: delayedFrame,
    fps,
    durationInFrames: dur,
    config: springConfig,
  });

  // If we're still in the stagger delay period, return hidden state
  if (frame < staggerDelay) {
    return getHiddenState(config);
  }

  switch (config.type) {
    // ===== Basic animations =====
    case 'fade':
      return { opacity: progress, transform: 'none' };

    case 'slide': {
      const distance = 100;
      const dir = config.direction ?? 'left';
      const axis = dir === 'left' || dir === 'right' ? 'X' : 'Y';
      const sign = dir === 'right' || dir === 'bottom' ? 1 : -1;
      const offset = interpolate(progress, [0, 1], [sign * distance, 0]);
      return { opacity: 1, transform: `translate${axis}(${offset}%)` };
    }

    case 'scale': {
      const scale = interpolate(progress, [0, 1], [0.5, 1]);
      return { opacity: progress, transform: `scale(${scale})` };
    }

    // ===== Spring-based animations (the trailer's signature) =====
    case 'spring-scale': {
      // THE signature animation from the trailer
      // Scale from 0 with spring physics, opacity fades in slightly faster
      const scale = interpolate(progress, [0, 1], [0, 1]);
      const opacity = interpolate(progress, [0, 0.3], [0, 1], {
        extrapolateRight: 'clamp',
      });
      return { opacity, transform: `scale(${scale})` };
    }

    case 'spring-slide': {
      // Slide with spring overshoot
      const distance = 120; // Slightly more distance for overshoot effect
      const dir = config.direction ?? 'left';
      const axis = dir === 'left' || dir === 'right' ? 'X' : 'Y';
      const sign = dir === 'right' || dir === 'bottom' ? 1 : -1;
      const offset = interpolate(progress, [0, 1], [sign * distance, 0]);
      const opacity = interpolate(progress, [0, 0.5], [0, 1], {
        extrapolateRight: 'clamp',
      });
      return { opacity, transform: `translate${axis}(${offset}%)` };
    }

    case 'spring-bounce': {
      // Bouncy scale - uses bouncy spring preset automatically if not specified
      const bounceConfig = config.springPreset ? springConfig : { damping: 100, mass: 1 };
      const bounceProgress = spring({
        frame: delayedFrame,
        fps,
        durationInFrames: dur,
        config: bounceConfig,
      });
      const scale = interpolate(bounceProgress, [0, 1], [0, 1]);
      const opacity = interpolate(bounceProgress, [0, 0.2], [0, 1], {
        extrapolateRight: 'clamp',
      });
      return { opacity, transform: `scale(${scale})` };
    }

    // ===== Advanced animations =====
    case 'flip': {
      // 3D card flip - rotates around Y axis
      const rotation = interpolate(progress, [0, 1], [Math.PI, 0]); // 180deg to 0deg
      const opacity = interpolate(progress, [0, 0.5], [0, 1], {
        extrapolateRight: 'clamp',
      });
      return {
        opacity,
        transform: `perspective(1000px) rotateY(${rotation}rad)`,
      };
    }

    case 'zoom-blur': {
      // Zoom in with blur effect
      const scale = interpolate(progress, [0, 1], [1.3, 1]);
      const opacity = interpolate(progress, [0, 1], [0, 1]);
      const blur = interpolate(progress, [0, 1], [10, 0]);
      return {
        opacity,
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
      };
    }

    default:
      return { opacity: 1, transform: 'none' };
  }
}

/**
 * Compute exit animation based on config type.
 */
function computeExit(framesFromEnd: number, fps: number, config: AnimationConfig): AnimResult {
  const exitDur = Math.max(1, config.durationInFrames ?? 10);
  const springConfig = getSpringConfig(config.springPreset);

  const progress = spring({
    frame: exitDur - framesFromEnd,
    fps,
    durationInFrames: exitDur,
    config: springConfig,
  });

  switch (config.type) {
    case 'fade':
      return { opacity: 1 - progress, transform: 'none' };

    case 'slide': {
      const distance = 100;
      const dir = config.direction ?? 'right';
      const axis = dir === 'left' || dir === 'right' ? 'X' : 'Y';
      const sign = dir === 'right' || dir === 'bottom' ? 1 : -1;
      const offset = interpolate(progress, [0, 1], [0, sign * distance]);
      return { opacity: 1, transform: `translate${axis}(${offset}%)` };
    }

    case 'scale':
    case 'spring-scale':
    case 'spring-bounce': {
      const scale = interpolate(progress, [0, 1], [1, 0]);
      const opacity = interpolate(progress, [0.7, 1], [1, 0], {
        extrapolateLeft: 'clamp',
      });
      return { opacity, transform: `scale(${scale})` };
    }

    case 'spring-slide': {
      const distance = 120;
      const dir = config.direction ?? 'right';
      const axis = dir === 'left' || dir === 'right' ? 'X' : 'Y';
      const sign = dir === 'right' || dir === 'bottom' ? 1 : -1;
      const offset = interpolate(progress, [0, 1], [0, sign * distance]);
      const opacity = interpolate(progress, [0.5, 1], [1, 0], {
        extrapolateLeft: 'clamp',
      });
      return { opacity, transform: `translate${axis}(${offset}%)` };
    }

    case 'flip': {
      const rotation = interpolate(progress, [0, 1], [0, -Math.PI]); // 0 to -180deg
      const opacity = interpolate(progress, [0.5, 1], [1, 0], {
        extrapolateLeft: 'clamp',
      });
      return {
        opacity,
        transform: `perspective(1000px) rotateY(${rotation}rad)`,
      };
    }

    case 'zoom-blur': {
      const scale = interpolate(progress, [0, 1], [1, 0.7]);
      const opacity = interpolate(progress, [0, 1], [1, 0]);
      const blur = interpolate(progress, [0, 1], [0, 10]);
      return {
        opacity,
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
      };
    }

    default:
      return { opacity: 1, transform: 'none' };
  }
}

/**
 * Get hidden state for animation type (used during stagger delay).
 */
function getHiddenState(config: AnimationConfig): AnimResult {
  switch (config.type) {
    case 'fade':
      return { opacity: 0, transform: 'none' };
    case 'scale':
    case 'spring-scale':
    case 'spring-bounce':
      return { opacity: 0, transform: 'scale(0)' };
    case 'slide':
    case 'spring-slide': {
      const distance = 100;
      const dir = config.direction ?? 'left';
      const axis = dir === 'left' || dir === 'right' ? 'X' : 'Y';
      const sign = dir === 'right' || dir === 'bottom' ? 1 : -1;
      return { opacity: 0, transform: `translate${axis}(${sign * distance}%)` };
    }
    case 'flip':
      return { opacity: 0, transform: 'perspective(1000px) rotateY(3.14159rad)' };
    case 'zoom-blur':
      return { opacity: 0, transform: 'scale(1.3)', filter: 'blur(10px)' };
    default:
      return { opacity: 0, transform: 'none' };
  }
}

/**
 * Compute enter + exit animation styles for a timeline item.
 *
 * Features:
 * - Spring physics with configurable presets
 * - Stagger delay support (config.staggerDelay)
 * - Advanced animations: spring-scale, flip, zoom-blur
 *
 * Pass exitConfig and durationInFrames to enable smooth exit animations.
 * Backward compatible: calling with just enterConfig works as before.
 */
export function useItemAnimation(
  enterConfig?: AnimationConfig,
  exitConfig?: AnimationConfig,
  durationInFrames?: number,
) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let enterResult: AnimResult = { opacity: 1, transform: 'none' };
  let exitResult: AnimResult = { opacity: 1, transform: 'none' };

  if (enterConfig && enterConfig.type !== 'none') {
    const enterDur = enterConfig.durationInFrames ?? 15;
    const staggerDelay = enterConfig.staggerDelay ?? 0;
    const totalEnterTime = enterDur + staggerDelay;

    if (frame >= totalEnterTime) {
      // Enter animation complete — snap to fully visible
      enterResult = { opacity: 1, transform: 'none' };
    } else {
      enterResult = computeEnter(frame, fps, enterConfig);
    }
  }

  if (exitConfig && exitConfig.type !== 'none' && durationInFrames != null) {
    const exitDur = exitConfig.durationInFrames ?? 10;
    const framesFromEnd = durationInFrames - frame;
    if (framesFromEnd <= exitDur) {
      exitResult = computeExit(framesFromEnd, fps, exitConfig);
    }
  }

  const opacity = enterResult.opacity * exitResult.opacity;
  const transforms = [enterResult.transform, exitResult.transform]
    .filter(t => t && t !== 'none')
    .join(' ');

  // Combine filters if present
  const filters = [enterResult.filter, exitResult.filter].filter(Boolean).join(' ');

  return {
    opacity,
    transform: transforms || 'none',
    filter: filters || undefined,
  };
}

/**
 * Helper hook to calculate stagger delay for items in a sequence.
 * Use this when you have multiple items that should animate in sequence.
 *
 * @param itemIndex - The index of the item in the sequence (0-based)
 * @param staggerFrames - Frames between each item's animation start (default: 8)
 * @returns The stagger delay in frames
 *
 * @example
 * const items = ['Button', 'Card', 'Modal'];
 * items.map((item, i) => {
 *   const staggerDelay = useStaggerDelay(i, 8);
 *   return <Item enterAnimation={{ type: 'spring-scale', staggerDelay }} />;
 * });
 */
export function useStaggerDelay(itemIndex: number, staggerFrames = 8): number {
  return itemIndex * staggerFrames;
}
