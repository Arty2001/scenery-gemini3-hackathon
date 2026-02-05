'use client';

/**
 * CursorOverlay - Remotion component for animated cursor with click effects.
 *
 * Supports two positioning modes:
 * 1. Coordinate-based: Manual x/y pixel positions
 * 2. Target-based: CSS selector that auto-resolves to element position
 *
 * Interpolates cursor position between keyframes and renders click
 * effects (ripple, highlight) at frames marked with click: true.
 */

import { useCurrentFrame, interpolate, useVideoConfig } from 'remotion';
import { useRef, useEffect, useState, useCallback } from 'react';
import type { CursorItem, CursorKeyframe } from '@/lib/composition/types';

// =============================================
// SVG Cursor Paths
// =============================================

const CURSOR_PATHS: Record<string, string> = {
  default:
    'M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36Z',
  pointer:
    'M10 2v8.5L7.5 9 5 13h3l-1 5 8-9h-3.5L14 2h-4Z',
  hand:
    'M14 2a1 1 0 0 0-1 1v7h-2V4a1 1 0 1 0-2 0v6H7V6a1 1 0 1 0-2 0v9c0 .3 0 .6.04.9L3.7 14.6a1.1 1.1 0 0 0-1.5 0 1.1 1.1 0 0 0 0 1.5l4.3 4.3A5 5 0 0 0 10 22h2a5 5 0 0 0 5-5V5a1 1 0 1 0-2 0v5h-2V3a1 1 0 0 0-1-1h1Z',
};

// =============================================
// Target Position Resolution
// =============================================

interface ResolvedKeyframe {
  frame: number;
  x: number;
  y: number;
  click?: boolean;
}

/**
 * Try to find an element matching the selector in the document.
 * Returns its center position in composition coordinates, or null if not found.
 */
function findTargetPosition(
  selector: string,
  compositionWidth: number,
  compositionHeight: number,
  offset?: { x: number; y: number }
): { x: number; y: number } | null {
  try {
    // Look for the element in any component preview container
    const containers = document.querySelectorAll('[data-component-preview]');

    for (const container of containers) {
      const target = container.querySelector(selector);
      if (!target) continue;

      const targetRect = target.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Get the remotion player container for accurate scaling
      const playerContainer = container.closest('[data-remotion-player]') || container.parentElement;
      if (!playerContainer) continue;

      const playerRect = playerContainer.getBoundingClientRect();

      // Calculate center relative to player
      const centerX = targetRect.left + targetRect.width / 2 - playerRect.left;
      const centerY = targetRect.top + targetRect.height / 2 - playerRect.top;

      // Scale to composition coordinates
      const scaleX = compositionWidth / playerRect.width;
      const scaleY = compositionHeight / playerRect.height;

      let x = centerX * scaleX;
      let y = centerY * scaleY;

      // Apply offset
      if (offset) {
        x += offset.x;
        y += offset.y;
      }

      console.log(`[CursorOverlay] Resolved target "${selector}" to (${x.toFixed(0)}, ${y.toFixed(0)})`);
      return { x, y };
    }
  } catch (err) {
    console.warn(`[CursorOverlay] Error resolving target "${selector}":`, err);
  }

  return null;
}

// =============================================
// Click Ripple Effect
// =============================================

function ClickRipple({
  frame,
  clickFrame,
  x,
  y,
}: {
  frame: number;
  clickFrame: number;
  x: number;
  y: number;
}) {
  // Safety check for valid numbers
  if (!isFinite(frame) || !isFinite(clickFrame) || !isFinite(x) || !isFinite(y)) {
    return null;
  }

  const relativeFrame = frame - clickFrame;

  if (relativeFrame < 0 || relativeFrame > 17) return null;

  // Enhanced ripple with multiple rings
  const radius1 = interpolate(relativeFrame, [0, 15], [0, 50], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const radius2 = interpolate(relativeFrame, [2, 17], [0, 40], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity1 = interpolate(relativeFrame, [0, 15], [0.8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity2 = interpolate(relativeFrame, [2, 17], [0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* Primary ring */}
      <div
        style={{
          position: 'absolute',
          left: x - radius1,
          top: y - radius1,
          width: radius1 * 2,
          height: radius1 * 2,
          borderRadius: '50%',
          border: '3px solid rgba(59, 130, 246, 0.9)',
          boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
          opacity: opacity1,
          pointerEvents: 'none',
        }}
      />
      {/* Secondary ring (delayed) */}
      {relativeFrame >= 2 && (
        <div
          style={{
            position: 'absolute',
            left: x - radius2,
            top: y - radius2,
            width: radius2 * 2,
            height: radius2 * 2,
            borderRadius: '50%',
            border: '2px solid rgba(147, 197, 253, 0.7)',
            opacity: opacity2,
            pointerEvents: 'none',
          }}
        />
      )}
      {/* Center dot pulse */}
      {relativeFrame < 8 && (
        <div
          style={{
            position: 'absolute',
            left: x - 6,
            top: y - 6,
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            opacity: interpolate(relativeFrame, [0, 8], [1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
}

// =============================================
// Click Highlight Effect
// =============================================

function ClickHighlight({
  frame,
  clickFrame,
  x,
  y,
}: {
  frame: number;
  clickFrame: number;
  x: number;
  y: number;
}) {
  // Safety check for valid numbers
  if (!isFinite(frame) || !isFinite(clickFrame) || !isFinite(x) || !isFinite(y)) {
    return null;
  }

  const relativeFrame = frame - clickFrame;

  if (relativeFrame < 0 || relativeFrame > 12) return null;

  // Burst effect with glow
  const scale = interpolate(relativeFrame, [0, 12], [0.3, 2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(relativeFrame, [0, 12], [0.9, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* Main highlight burst */}
      <div
        style={{
          position: 'absolute',
          left: x - 20 * scale,
          top: y - 20 * scale,
          width: 40 * scale,
          height: 40 * scale,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(250, 204, 21, 0.8) 0%, rgba(251, 146, 60, 0.4) 50%, transparent 70%)',
          boxShadow: '0 0 20px rgba(250, 204, 21, 0.6)',
          opacity,
          pointerEvents: 'none',
        }}
      />
      {/* Inner glow */}
      {relativeFrame < 6 && (
        <div
          style={{
            position: 'absolute',
            left: x - 8,
            top: y - 8,
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            boxShadow: '0 0 15px rgba(250, 204, 21, 0.8)',
            opacity: interpolate(relativeFrame, [0, 6], [1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
}

// =============================================
// CursorOverlay Component
// =============================================

interface CursorOverlayProps {
  item: CursorItem;
}

export function CursorOverlay({ item }: CursorOverlayProps) {
  const frame = useCurrentFrame();
  const { width: compWidth, height: compHeight } = useVideoConfig();
  const { keyframes, cursorStyle = 'default', clickEffect = 'ripple', scale = 1 } = item;

  // Track resolved positions for target-based keyframes
  const [resolvedPositions, setResolvedPositions] = useState<Map<number, { x: number; y: number }>>(new Map());
  const lastResolveRef = useRef<number>(0);

  // Track unresolved selectors for debugging
  const [unresolvedSelectors, setUnresolvedSelectors] = useState<string[]>([]);

  // Resolve target-based positions periodically (not every frame for performance)
  const resolveTargets = useCallback(() => {
    if (!keyframes || keyframes.length === 0) return;

    const newResolved = new Map<number, { x: number; y: number }>();
    const unresolved: string[] = [];
    let hasTargets = false;

    for (const kf of keyframes) {
      // Use interaction selector as target if no explicit target
      const target = kf.target || kf.interaction?.selector;

      if (target) {
        hasTargets = true;
        const pos = findTargetPosition(target, compWidth, compHeight, kf.targetOffset);
        if (pos) {
          newResolved.set(kf.frame, pos);
        } else if (!unresolved.includes(target)) {
          unresolved.push(target);
        }
      }
    }

    // Log warning for unresolved selectors
    if (unresolved.length > 0) {
      console.warn(
        `[CursorOverlay] Could not find elements for selectors:`,
        unresolved,
        '\nTip: Check that component has loaded and selector matches an element in [data-component-preview]'
      );
      setUnresolvedSelectors(unresolved);
    } else {
      setUnresolvedSelectors([]);
    }

    if (hasTargets && newResolved.size > 0) {
      setResolvedPositions(newResolved);
    }
  }, [keyframes, compWidth, compHeight]);

  // Resolve targets on mount and when keyframes change
  useEffect(() => {
    resolveTargets();

    // Re-resolve periodically during playback (elements might move/load)
    const interval = setInterval(resolveTargets, 500);
    return () => clearInterval(interval);
  }, [resolveTargets]);

  // Also resolve if we haven't resolved recently and frame changed significantly
  useEffect(() => {
    const now = Date.now();
    if (now - lastResolveRef.current > 200) {
      lastResolveRef.current = now;
      resolveTargets();
    }
  }, [frame, resolveTargets]);

  // Empty keyframes - render nothing
  if (!keyframes || keyframes.length === 0) return null;

  // Build resolved keyframes with positions
  const resolvedKeyframes: ResolvedKeyframe[] = keyframes.map((kf, index) => {
    const resolved = resolvedPositions.get(kf.frame);
    const target = kf.target || kf.interaction?.selector;

    // Priority: 1) Resolved target position, 2) Manual x/y, 3) Center fallback
    let x: number;
    let y: number;

    if (resolved) {
      x = resolved.x;
      y = resolved.y;
    } else if (kf.x != null && kf.y != null && !isNaN(kf.x) && !isNaN(kf.y)) {
      x = kf.x;
      y = kf.y;
    } else if (target) {
      // Target specified but not resolved yet - use center as placeholder
      x = compWidth / 2;
      y = compHeight / 2;
    } else {
      // No target, no coordinates - default to center
      x = compWidth / 2;
      y = compHeight / 2;
    }

    // Final safety check - ensure we always have valid numbers
    if (isNaN(x) || !isFinite(x)) x = compWidth / 2;
    if (isNaN(y) || !isFinite(y)) y = compHeight / 2;

    // Ensure frame is a valid number (critical for interpolation!)
    let frameNum = typeof kf.frame === 'number' && isFinite(kf.frame) ? kf.frame : index * 30;

    return { frame: frameNum, x, y, click: kf.click };
  });

  // Filter out any keyframes with invalid values and ensure we have at least one
  const validKeyframes = resolvedKeyframes.filter(
    (k) => typeof k.frame === 'number' && isFinite(k.frame) &&
           typeof k.x === 'number' && isFinite(k.x) &&
           typeof k.y === 'number' && isFinite(k.y)
  );

  // Fallback if no valid keyframes
  if (validKeyframes.length === 0) {
    return null;
  }

  // Build input/output ranges from valid keyframes only
  const inputRange = validKeyframes.map((k) => k.frame);
  const xOutputRange = validKeyframes.map((k) => k.x);
  const yOutputRange = validKeyframes.map((k) => k.y);

  // For single keyframe, just use that position
  const x =
    validKeyframes.length === 1
      ? validKeyframes[0].x
      : interpolate(frame, inputRange, xOutputRange, {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
  const y =
    validKeyframes.length === 1
      ? validKeyframes[0].y
      : interpolate(frame, inputRange, yOutputRange, {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  // Detect active clicks (within 5 frames for visual effect, 3 frames for press animation)
  const activeClicks = validKeyframes.filter(
    (k) => k.click && typeof k.frame === 'number' && Math.abs(frame - k.frame) < 5
  );

  // Check if cursor should show "pressed" state (during click)
  const isPressing = activeClicks.length > 0 && validKeyframes.some(
    (k) => k.click && typeof k.frame === 'number' && frame >= k.frame && frame < k.frame + 4
  );

  // Cursor press animation scale - with safety checks
  let cursorPressScale = 1;
  if (isPressing && activeClicks.length > 0 && typeof activeClicks[0].frame === 'number') {
    const pressFrame = frame - activeClicks[0].frame;
    if (isFinite(pressFrame)) {
      cursorPressScale = interpolate(
        pressFrame,
        [0, 2, 4],
        [1, 0.85, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
    }
  }

  const path = CURSOR_PATHS[cursorStyle] ?? CURSOR_PATHS.default;

  // Check if we're in preview mode (not rendering)
  const isPreview = typeof window !== 'undefined' && !window.location.pathname.includes('/render');

  return (
    <>
      {/* Warning indicator for unresolved selectors (preview only) */}
      {isPreview && unresolvedSelectors.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(239, 68, 68, 0.9)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 10,
            fontFamily: 'monospace',
            maxWidth: 200,
            zIndex: 1000,
          }}
        >
          ⚠️ Cursor: {unresolvedSelectors.length} selector{unresolvedSelectors.length > 1 ? 's' : ''} not found
        </div>
      )}

      {/* Click effects */}
      {clickEffect !== 'none' &&
        activeClicks.map((k) =>
          clickEffect === 'highlight' ? (
            <ClickHighlight
              key={`highlight-${k.frame}`}
              frame={frame}
              clickFrame={k.frame}
              x={x}
              y={y}
            />
          ) : (
            <ClickRipple
              key={`ripple-${k.frame}`}
              frame={frame}
              clickFrame={k.frame}
              x={x}
              y={y}
            />
          )
        )}

      {/* Cursor SVG with enhanced styling */}
      <svg
        width={24 * scale * cursorPressScale}
        height={24 * scale * cursorPressScale}
        viewBox="0 0 24 24"
        style={{
          position: 'absolute',
          left: x,
          top: y,
          pointerEvents: 'none',
          filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.4)) drop-shadow(0 1px 2px rgba(0,0,0,0.2))`,
          transition: 'filter 0.05s ease',
        }}
      >
        {/* Cursor outline for better visibility */}
        <path
          d={path}
          fill="none"
          stroke="rgba(0,0,0,0.6)"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {/* Main cursor fill */}
        <path
          d={path}
          fill="white"
          stroke="black"
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
}
