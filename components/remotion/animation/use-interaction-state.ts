/**
 * Computes active interaction state from cursor keyframes at the current frame.
 *
 * Returns structured data that the component renderer applies to real DOM
 * elements via useRef + useEffect (not string injection).
 */

import { useCurrentFrame } from 'remotion';
import type { Track, CursorItem } from '@/lib/composition/types';

// =============================================
// Types
// =============================================

export interface ElementInteraction {
  /** CSS property overrides applied via element.style */
  styles: Record<string, string>;
  /** Value to set on input/textarea elements */
  value?: string;
  /** Whether typing cursor should be visible */
  showTypingCursor?: boolean;
}

export interface InteractionState {
  /** CSS selector → interaction to apply */
  elements: Record<string, ElementInteraction>;
}

const EMPTY: InteractionState = { elements: {} };

// =============================================
// Hook
// =============================================

/**
 * Computes interaction state for cursor animations.
 *
 * @param tracks All composition tracks
 * @param itemStartFrame The start frame of the item being rendered (for offset calculation).
 *                       Required because useCurrentFrame() returns relative frame inside a Sequence,
 *                       but cursor items use absolute frames.
 */
export function useInteractionState(tracks: Track[], itemStartFrame: number = 0): InteractionState {
  const relativeFrame = useCurrentFrame();
  // Convert to absolute frame by adding the item's start offset
  const absoluteFrame = relativeFrame + itemStartFrame;

  const cursorItems: CursorItem[] = [];
  for (const track of tracks) {
    if (track.type !== 'cursor' || track.visible === false) continue;
    for (const item of track.items) {
      if (item.type !== 'cursor') continue;
      // Compare absolute frames
      if (absoluteFrame >= item.from && absoluteFrame < item.from + item.durationInFrames) {
        cursorItems.push(item);
      }
    }
  }

  if (cursorItems.length === 0) return EMPTY;

  const elements: Record<string, ElementInteraction> = {};

  function getEl(selector: string): ElementInteraction {
    if (!elements[selector]) elements[selector] = { styles: {} };
    return elements[selector];
  }

  for (const cursor of cursorItems) {
    const kfs = cursor.keyframes;
    if (!kfs || kfs.length === 0) continue;

    // relFrame is relative to cursor start (cursor keyframes use relative frames)
    const relFrame = absoluteFrame - cursor.from;

    for (const kf of kfs) {
      const interaction = kf.interaction;
      if (!interaction) continue;

      const { selector, action, value } = interaction;
      const kfRel = kf.frame;

      switch (action) {
        case 'hover': {
          // Configurable hover duration (default: 20 frames after keyframe)
          const hoverDuration = interaction.holdDuration ?? 20;
          if (relFrame >= kfRel - 5 && relFrame <= kfRel + hoverDuration) {
            const el = getEl(selector);
            // Calculate hover intensity (fade in, hold, fade out)
            const hoverProgress = relFrame - kfRel;
            const intensity = hoverProgress < 0
              ? Math.max(0, 1 + hoverProgress / 5) // Fade in
              : hoverProgress > hoverDuration - 5
                ? Math.max(0, (hoverDuration - hoverProgress) / 5) // Fade out
                : 1; // Full intensity

            // Professional hover effect with smooth glow
            el.styles.filter = `brightness(${1 + 0.15 * intensity})`;
            el.styles.boxShadow = `0 0 0 ${3 * intensity}px rgba(59,130,246,${0.6 * intensity}), 0 0 ${20 * intensity}px rgba(59,130,246,${0.35 * intensity}), 0 ${4 * intensity}px ${12 * intensity}px rgba(0,0,0,0.15)`;
            el.styles.transition = 'all 0.1s ease';
            el.styles.position = 'relative';
            el.styles.zIndex = '100';
          }
          break;
        }
        case 'click': {
          // Configurable click hold duration (default: 10 frames)
          const clickHold = interaction.holdDuration ?? 10;
          if (relFrame >= kfRel && relFrame < kfRel + clickHold) {
            const el = getEl(selector);
            // Calculate click animation progress
            const clickProgress = (relFrame - kfRel) / clickHold;
            // Quick scale down then back up
            const scaleValue = clickProgress < 0.3
              ? 1 - (clickProgress / 0.3) * 0.08 // Scale down to 0.92
              : 0.92 + ((clickProgress - 0.3) / 0.7) * 0.08; // Scale back up

            el.styles.transform = `scale(${scaleValue})`;
            el.styles.filter = clickProgress < 0.5 ? 'brightness(0.85)' : 'brightness(1)';
            el.styles.boxShadow = `0 0 0 4px rgba(59,130,246,${0.8 - clickProgress * 0.3}), 0 0 ${25 - clickProgress * 10}px rgba(59,130,246,${0.5 - clickProgress * 0.2})`;
            el.styles.transition = 'none'; // No transition during click animation
          }
          break;
        }
        case 'focus': {
          if (relFrame >= kfRel) {
            const laterDefocus = kfs.find(
              (k) => k.frame > kfRel && k.interaction && k.interaction.selector !== selector
            );
            if (!laterDefocus || relFrame < laterDefocus.frame) {
              const el = getEl(selector);
              // Calculate how long we've been focused for animation
              const focusDuration = relFrame - kfRel;

              // Subtle pulsing glow while focused
              const pulsePhase = Math.sin(focusDuration * 0.15) * 0.5 + 0.5;
              const glowIntensity = 0.25 + pulsePhase * 0.15;

              // Professional focus ring with animated glow
              el.styles.outline = '3px solid rgba(59,130,246,0.9)';
              el.styles.outlineOffset = '2px';
              el.styles.boxShadow = `0 0 ${12 + pulsePhase * 8}px rgba(59,130,246,${glowIntensity}), 0 0 25px rgba(59,130,246,0.15), inset 0 0 2px rgba(59,130,246,0.1)`;
              el.styles.backgroundColor = 'rgba(255,255,255,1)';
            }
          }
          break;
        }
        case 'type': {
          if (value && relFrame >= kfRel) {
            // Configurable speed: frames per character (default 2 = readable pace)
            const framesPerChar = interaction.speed ?? 2;
            const charsTyped = Math.min(
              Math.floor((relFrame - kfRel) / framesPerChar) + 1,
              value.length
            );
            const isStillTyping = charsTyped < value.length;
            const el = getEl(selector);
            el.value = value.slice(0, charsTyped);

            // Strong, prominent focus effect during typing
            el.styles.outline = '3px solid rgba(59,130,246,0.9)';
            el.styles.outlineOffset = '2px';
            el.styles.boxShadow = '0 0 15px rgba(59,130,246,0.4), 0 0 30px rgba(59,130,246,0.2), inset 0 0 3px rgba(59,130,246,0.1)';
            el.styles.backgroundColor = 'rgba(255,255,255,1)';
            el.styles.color = '#000';
            el.styles.fontWeight = '500';

            // Visible typing cursor (blinking simulation via frame-based opacity)
            if (isStillTyping) {
              el.showTypingCursor = true;
              // Simulate blink: visible for ~15 frames, invisible for ~15 frames
              const blinkFrame = (relFrame - kfRel) % 30;
              const cursorVisible = blinkFrame < 20;
              el.styles.caretColor = cursorVisible ? 'rgba(59,130,246,1)' : 'transparent';
            }

            // Subtle pulsing glow while actively typing
            if (isStillTyping) {
              const pulsePhase = Math.sin((relFrame - kfRel) * 0.3) * 0.5 + 0.5;
              const glowIntensity = 0.3 + pulsePhase * 0.2;
              el.styles.boxShadow = `0 0 ${15 + pulsePhase * 10}px rgba(59,130,246,${glowIntensity}), 0 0 30px rgba(59,130,246,0.2), inset 0 0 3px rgba(59,130,246,0.1)`;
            }
          }
          break;
        }
        case 'select': {
          // Select option in dropdown - shows value and highlights select element
          if (relFrame >= kfRel) {
            const el = getEl(selector);
            if (value) el.value = value;

            // Calculate animation progress for select feedback
            const selectDuration = relFrame - kfRel;
            const flashIntensity = selectDuration < 10 ? (10 - selectDuration) / 10 : 0;

            el.styles.outline = '3px solid rgba(59,130,246,0.9)';
            el.styles.outlineOffset = '2px';
            el.styles.backgroundColor = `rgba(59,130,246,${0.05 + flashIntensity * 0.15})`;
            el.styles.boxShadow = `0 0 ${15 + flashIntensity * 10}px rgba(59,130,246,${0.3 + flashIntensity * 0.2})`;
            el.styles.color = '#000';
            el.styles.fontWeight = '500';
          }
          break;
        }
        case 'check': {
          // Toggle checkbox - add checked visual appearance
          if (relFrame >= kfRel) {
            const el = getEl(selector);

            // Calculate animation progress for check feedback
            const checkDuration = relFrame - kfRel;
            const bounceScale = checkDuration < 8
              ? 1 + Math.sin((checkDuration / 8) * Math.PI) * 0.15 // Bounce up
              : 1;
            const flashIntensity = checkDuration < 12 ? (12 - checkDuration) / 12 : 0;

            el.styles.outline = '3px solid rgba(34,197,94,0.9)'; // Green for success
            el.styles.outlineOffset = '3px';
            el.styles.boxShadow = `0 0 ${15 + flashIntensity * 10}px rgba(34,197,94,${0.35 + flashIntensity * 0.25})`;
            el.styles.transform = `scale(${bounceScale})`;
            // Mark as checked via value attribute
            el.value = 'checked';
          }
          break;
        }
      }
    }
  }

  if (Object.keys(elements).length === 0) return EMPTY;

  return { elements };
}
