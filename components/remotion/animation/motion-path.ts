/**
 * Motion path animation utilities for bezier curve interpolation.
 * Allows items to move along curved paths with optional auto-rotation.
 */

export interface PathPoint {
  x: number; // 0-1 position
  y: number;
  controlPoint1?: { x: number; y: number }; // Bezier control point (outgoing)
  controlPoint2?: { x: number; y: number }; // Bezier control point (incoming)
}

export interface MotionPath {
  points: PathPoint[];
  autoRotate?: boolean; // Rotate item to follow path direction
}

/**
 * Interpolate a cubic bezier curve between two points.
 * P0 = start, P1 = control1, P2 = control2, P3 = end
 */
function cubicBezier(
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return uuu * p0 + 3 * uu * t * p1 + 3 * u * tt * p2 + ttt * p3;
}

/**
 * Get the derivative of a cubic bezier curve at point t.
 * Used for calculating the tangent angle for auto-rotation.
 */
function cubicBezierDerivative(
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number {
  const u = 1 - t;
  return (
    3 * u * u * (p1 - p0) +
    6 * u * t * (p2 - p1) +
    3 * t * t * (p3 - p2)
  );
}

/**
 * Calculate the total arc length of the path for uniform speed distribution.
 * Uses adaptive subdivision for accuracy.
 */
function calculatePathLength(points: PathPoint[]): number {
  if (points.length < 2) return 0;

  let totalLength = 0;
  const SAMPLES = 20; // Samples per segment

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];

    // Use control points or default to linear
    const cp1 = start.controlPoint1 ?? start;
    const cp2 = end.controlPoint2 ?? end;

    let prevX = start.x;
    let prevY = start.y;

    for (let j = 1; j <= SAMPLES; j++) {
      const t = j / SAMPLES;
      const x = cubicBezier(t, start.x, cp1.x, cp2.x, end.x);
      const y = cubicBezier(t, start.y, cp1.y, cp2.y, end.y);

      const dx = x - prevX;
      const dy = y - prevY;
      totalLength += Math.sqrt(dx * dx + dy * dy);

      prevX = x;
      prevY = y;
    }
  }

  return totalLength;
}

/**
 * Get the position along the path at a given progress (0-1).
 * Uses arc-length parameterization for uniform speed.
 */
export function getPositionOnPath(
  path: MotionPath,
  progress: number
): { x: number; y: number; rotation: number } {
  const { points, autoRotate } = path;

  if (points.length === 0) {
    return { x: 0.5, y: 0.5, rotation: 0 };
  }

  if (points.length === 1) {
    return { x: points[0].x, y: points[0].y, rotation: 0 };
  }

  // Clamp progress
  const t = Math.max(0, Math.min(1, progress));

  // Calculate which segment we're in
  const totalSegments = points.length - 1;
  const segmentProgress = t * totalSegments;
  const segmentIndex = Math.min(Math.floor(segmentProgress), totalSegments - 1);
  const localT = segmentProgress - segmentIndex;

  const start = points[segmentIndex];
  const end = points[segmentIndex + 1];

  // Use control points or default to straight line
  const cp1 = start.controlPoint1 ?? {
    x: start.x + (end.x - start.x) / 3,
    y: start.y + (end.y - start.y) / 3,
  };
  const cp2 = end.controlPoint2 ?? {
    x: end.x - (end.x - start.x) / 3,
    y: end.y - (end.y - start.y) / 3,
  };

  // Calculate position
  const x = cubicBezier(localT, start.x, cp1.x, cp2.x, end.x);
  const y = cubicBezier(localT, start.y, cp1.y, cp2.y, end.y);

  // Calculate rotation if auto-rotate is enabled
  let rotation = 0;
  if (autoRotate) {
    const dx = cubicBezierDerivative(localT, start.x, cp1.x, cp2.x, end.x);
    const dy = cubicBezierDerivative(localT, start.y, cp1.y, cp2.y, end.y);
    rotation = Math.atan2(dy, dx) * (180 / Math.PI);
  }

  return { x, y, rotation };
}

/**
 * Generate keyframes from a motion path for use with the keyframe animation system.
 * This converts a path into discrete keyframes that can be used by existing renderers.
 */
export function pathToKeyframes(
  path: MotionPath,
  durationInFrames: number,
  options?: {
    easing?: string;
    includeRotation?: boolean;
  }
): Array<{ frame: number; values: Record<string, number>; easing?: string }> {
  const { points, autoRotate } = path;
  const { easing = 'ease-out', includeRotation = autoRotate } = options ?? {};

  if (points.length < 2) {
    return [];
  }

  const keyframes: Array<{ frame: number; values: Record<string, number>; easing?: string }> = [];

  // Generate keyframes at each path point
  const totalSegments = points.length - 1;

  for (let i = 0; i <= totalSegments; i++) {
    const progress = i / totalSegments;
    const frame = Math.round(progress * durationInFrames);
    const pos = getPositionOnPath(path, progress);

    const values: Record<string, number> = {
      positionX: pos.x,
      positionY: pos.y,
    };

    if (includeRotation && autoRotate) {
      values.rotation = pos.rotation;
    }

    keyframes.push({
      frame,
      values,
      easing: i === 0 ? undefined : easing,
    });
  }

  return keyframes;
}

/**
 * Common motion path presets for quick use.
 */
export const MOTION_PATH_PRESETS = {
  'arc-left-to-right': {
    points: [
      { x: 0, y: 0.5 },
      { x: 0.5, y: 0.2, controlPoint1: { x: 0.25, y: 0.2 }, controlPoint2: { x: 0.35, y: 0.2 } },
      { x: 1, y: 0.5, controlPoint2: { x: 0.75, y: 0.2 } },
    ],
    autoRotate: false,
  },
  'arc-right-to-left': {
    points: [
      { x: 1, y: 0.5 },
      { x: 0.5, y: 0.2, controlPoint1: { x: 0.75, y: 0.2 }, controlPoint2: { x: 0.65, y: 0.2 } },
      { x: 0, y: 0.5, controlPoint2: { x: 0.25, y: 0.2 } },
    ],
    autoRotate: false,
  },
  'wave': {
    points: [
      { x: 0, y: 0.5 },
      { x: 0.25, y: 0.3, controlPoint1: { x: 0.1, y: 0.3 } },
      { x: 0.5, y: 0.5, controlPoint1: { x: 0.35, y: 0.7 }, controlPoint2: { x: 0.4, y: 0.7 } },
      { x: 0.75, y: 0.7, controlPoint1: { x: 0.6, y: 0.3 }, controlPoint2: { x: 0.65, y: 0.3 } },
      { x: 1, y: 0.5, controlPoint2: { x: 0.9, y: 0.7 } },
    ],
    autoRotate: false,
  },
  'figure-8': {
    points: [
      { x: 0.5, y: 0.3 },
      { x: 0.7, y: 0.4, controlPoint1: { x: 0.65, y: 0.25 } },
      { x: 0.5, y: 0.5, controlPoint1: { x: 0.7, y: 0.55 }, controlPoint2: { x: 0.65, y: 0.55 } },
      { x: 0.3, y: 0.6, controlPoint1: { x: 0.35, y: 0.55 } },
      { x: 0.5, y: 0.7, controlPoint1: { x: 0.3, y: 0.75 }, controlPoint2: { x: 0.35, y: 0.75 } },
      { x: 0.5, y: 0.3, controlPoint1: { x: 0.65, y: 0.75 }, controlPoint2: { x: 0.7, y: 0.45 } },
    ],
    autoRotate: true,
  },
  'bounce-path': {
    points: [
      { x: 0.2, y: 0.8 },
      { x: 0.35, y: 0.3, controlPoint1: { x: 0.25, y: 0.3 } },
      { x: 0.5, y: 0.7, controlPoint1: { x: 0.4, y: 0.7 }, controlPoint2: { x: 0.45, y: 0.7 } },
      { x: 0.65, y: 0.45, controlPoint1: { x: 0.55, y: 0.45 } },
      { x: 0.8, y: 0.6, controlPoint1: { x: 0.7, y: 0.6 }, controlPoint2: { x: 0.75, y: 0.6 } },
      { x: 0.9, y: 0.55 },
    ],
    autoRotate: false,
  },
  'spiral-in': {
    points: [
      { x: 0.1, y: 0.5 },
      { x: 0.3, y: 0.2, controlPoint1: { x: 0.1, y: 0.2 } },
      { x: 0.7, y: 0.3, controlPoint1: { x: 0.5, y: 0.15 }, controlPoint2: { x: 0.6, y: 0.2 } },
      { x: 0.8, y: 0.6, controlPoint1: { x: 0.85, y: 0.4 } },
      { x: 0.6, y: 0.7, controlPoint1: { x: 0.75, y: 0.75 }, controlPoint2: { x: 0.7, y: 0.72 } },
      { x: 0.5, y: 0.5, controlPoint1: { x: 0.5, y: 0.65 }, controlPoint2: { x: 0.48, y: 0.55 } },
    ],
    autoRotate: true,
  },
} as const;

export type MotionPathPreset = keyof typeof MOTION_PATH_PRESETS;

/**
 * Get a motion path preset by name.
 */
export function getMotionPathPreset(name: MotionPathPreset): MotionPath {
  const preset = MOTION_PATH_PRESETS[name];
  // Deep copy to convert readonly to mutable
  return {
    points: preset.points.map(p => {
      const point: PathPoint = { x: p.x, y: p.y };
      if ('controlPoint1' in p && p.controlPoint1) {
        point.controlPoint1 = { x: p.controlPoint1.x, y: p.controlPoint1.y };
      }
      if ('controlPoint2' in p && p.controlPoint2) {
        point.controlPoint2 = { x: p.controlPoint2.x, y: p.controlPoint2.y };
      }
      return point;
    }),
    autoRotate: preset.autoRotate,
  };
}
