/**
 * Timeline utility functions for frame/pixel conversion and time display.
 */

/**
 * Convert frame count to pixel position.
 */
export function framesToPixels(frames: number, pixelsPerFrame: number): number {
  return frames * pixelsPerFrame;
}

/**
 * Convert pixel position to frame count (rounded to nearest frame).
 */
export function pixelsToFrames(pixels: number, pixelsPerFrame: number): number {
  return Math.round(pixels / pixelsPerFrame);
}

/**
 * Convert frame count to time string (MM:SS.ff format).
 * @param frame Current frame number
 * @param fps Frames per second
 * @returns Formatted time string
 */
export function formatTime(frame: number, fps: number): string {
  const totalSeconds = frame / fps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frames = Math.floor(frame % fps);

  return `${minutes}:${seconds.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`;
}

/**
 * Format duration in seconds for display.
 */
export function formatDuration(durationInFrames: number, fps: number): string {
  const seconds = durationInFrames / fps;
  return `${seconds.toFixed(1)}s`;
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate the total timeline width in pixels.
 */
export function calculateTimelineWidth(
  durationInFrames: number,
  pixelsPerFrame: number
): number {
  return durationInFrames * pixelsPerFrame;
}
