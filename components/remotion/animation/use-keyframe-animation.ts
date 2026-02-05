import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { PropertyKeyframe, EasingType } from '@/lib/composition/types';

/**
 * Interpolates between keyframe values for a given property at the current frame.
 * Returns a Record of property name → current interpolated value.
 *
 * Usage:
 *   const kfValues = useKeyframeAnimation(item.keyframes);
 *   // kfValues.positionX, kfValues.opacity, kfValues.scale, etc.
 */
export function useKeyframeAnimation(
  keyframes?: PropertyKeyframe[]
): Record<string, number> {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!keyframes || keyframes.length === 0) return {};

  // Filter to only keyframes with valid frame numbers
  const validKeyframes = keyframes.filter(
    (kf) => typeof kf.frame === 'number' && isFinite(kf.frame)
  );

  if (validKeyframes.length === 0) return {};
  if (validKeyframes.length === 1) {
    // Filter to only valid numeric values
    const values = validKeyframes[0].values ?? {};
    const result: Record<string, number> = {};
    for (const [key, val] of Object.entries(values)) {
      if (typeof val === 'number' && isFinite(val)) {
        result[key] = val;
      }
    }
    return result;
  }

  // Sort by frame ascending
  const sorted = [...validKeyframes].sort((a, b) => a.frame - b.frame);

  // Collect all unique property names across all keyframes
  const propNames = new Set<string>();
  for (const kf of sorted) {
    for (const key of Object.keys(kf.values ?? {})) {
      propNames.add(key);
    }
  }

  const result: Record<string, number> = {};

  for (const prop of propNames) {
    // Build input/output arrays for this property (only keyframes that define it with valid numbers)
    const relevantKfs = sorted.filter(
      (kf) => kf.values && prop in kf.values &&
              typeof kf.values[prop] === 'number' && isFinite(kf.values[prop])
    );
    if (relevantKfs.length === 0) continue;
    if (relevantKfs.length === 1) {
      result[prop] = relevantKfs[0].values![prop];
      continue;
    }

    // Find the two surrounding keyframes for the current frame
    let prevKf = relevantKfs[0];
    let nextKf = relevantKfs[relevantKfs.length - 1];

    for (let i = 0; i < relevantKfs.length - 1; i++) {
      if (frame >= relevantKfs[i].frame && frame <= relevantKfs[i + 1].frame) {
        prevKf = relevantKfs[i];
        nextKf = relevantKfs[i + 1];
        break;
      }
    }

    // Clamp: before first keyframe or after last
    if (frame <= prevKf.frame && prevKf === relevantKfs[0]) {
      result[prop] = prevKf.values![prop];
      continue;
    }
    if (frame >= nextKf.frame && nextKf === relevantKfs[relevantKfs.length - 1]) {
      result[prop] = nextKf.values![prop];
      continue;
    }

    const segmentDuration = nextKf.frame - prevKf.frame;

    // Safety: avoid division by zero or invalid duration
    if (segmentDuration <= 0) {
      result[prop] = prevKf.values![prop];
      continue;
    }

    const localFrame = frame - prevKf.frame;
    const easing = nextKf.easing ?? 'ease-out';

    // Get 0-1 progress with easing
    const progress = applyEasing(localFrame, segmentDuration, easing, fps);

    // Final safety check - ensure both values are valid numbers
    const prevVal = prevKf.values![prop];
    const nextVal = nextKf.values![prop];

    if (typeof prevVal !== 'number' || !isFinite(prevVal) ||
        typeof nextVal !== 'number' || !isFinite(nextVal)) {
      // Skip this property if values aren't valid
      continue;
    }

    result[prop] = interpolate(progress, [0, 1], [prevVal, nextVal]);
  }

  return result;
}

function applyEasing(
  localFrame: number,
  duration: number,
  easing: EasingType,
  fps: number,
): number {
  // Safety: ensure duration is valid and > 0
  if (!isFinite(duration) || duration <= 0) {
    return 1; // Return end state if duration is invalid
  }

  // Safety: ensure localFrame is valid
  if (!isFinite(localFrame)) {
    return 0;
  }

  switch (easing) {
    case 'linear':
      return interpolate(localFrame, [0, duration], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

    case 'spring':
      return spring({
        frame: localFrame,
        fps,
        durationInFrames: Math.max(1, duration), // Ensure at least 1 frame
        config: { damping: 200 },
      });

    case 'ease-in': {
      const t = interpolate(localFrame, [0, duration], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      return t * t; // quadratic ease-in
    }

    case 'ease-out': {
      const t = interpolate(localFrame, [0, duration], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      return 1 - (1 - t) * (1 - t); // quadratic ease-out
    }

    case 'ease-in-out': {
      const t = interpolate(localFrame, [0, duration], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    }

    default:
      return interpolate(localFrame, [0, duration], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
  }
}
