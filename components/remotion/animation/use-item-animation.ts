import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { AnimationConfig } from '@/lib/composition/types';

interface AnimResult {
  opacity: number;
  transform: string;
}

function computeEnter(frame: number, fps: number, config: AnimationConfig): AnimResult {
  const dur = Math.max(1, config.durationInFrames ?? 15);
  const progress = spring({
    frame,
    fps,
    durationInFrames: dur,
    config: { damping: 200 },
  });

  switch (config.type) {
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
    default:
      return { opacity: 1, transform: 'none' };
  }
}

function computeExit(framesFromEnd: number, fps: number, config: AnimationConfig): AnimResult {
  const exitDur = Math.max(1, config.durationInFrames ?? 10);
  const progress = spring({
    frame: exitDur - framesFromEnd,
    fps,
    durationInFrames: exitDur,
    config: { damping: 200 },
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
    case 'scale': {
      const scale = interpolate(progress, [0, 1], [1, 0.5]);
      return { opacity: 1 - progress, transform: `scale(${scale})` };
    }
    default:
      return { opacity: 1, transform: 'none' };
  }
}

/**
 * Compute enter + exit animation styles for a timeline item.
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
    if (frame >= enterDur) {
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

  return { opacity, transform: transforms || 'none' };
}
