/**
 * Animation presets library for professional motion graphics.
 * These presets can be applied via AI tools or manually in the editor.
 */

import type { PropertyKeyframe, EasingType } from '@/lib/composition/types';

// =============================================
// Types
// =============================================

export interface AnimationPreset {
  name: string;
  description: string;
  category: 'entrance' | 'exit' | 'emphasis' | 'motion' | 'filter';
  keyframes: PropertyKeyframe[];
  defaultDuration: number; // frames
}

// =============================================
// Helper to scale keyframes to a custom duration
// =============================================

export function scaleKeyframesToDuration(
  keyframes: PropertyKeyframe[],
  originalDuration: number,
  targetDuration: number
): PropertyKeyframe[] {
  const scale = targetDuration / originalDuration;
  return keyframes.map((kf) => ({
    ...kf,
    frame: Math.round(kf.frame * scale),
  }));
}

// =============================================
// Helper to scale intensity of keyframe values
// =============================================

export function scaleKeyframeIntensity(
  keyframes: PropertyKeyframe[],
  intensity: number,
  baseValues: Record<string, number> = {}
): PropertyKeyframe[] {
  return keyframes.map((kf) => ({
    ...kf,
    values: Object.fromEntries(
      Object.entries(kf.values).map(([key, value]) => {
        const base = baseValues[key] ?? (key === 'opacity' ? 1 : key === 'scale' ? 1 : 0);
        const delta = value - base;
        return [key, base + delta * intensity];
      })
    ),
  }));
}

// =============================================
// Animation Presets
// =============================================

export const ANIMATION_PRESETS: Record<string, AnimationPreset> = {
  // =============================================
  // ENTRANCE ANIMATIONS
  // =============================================

  'fade-in': {
    name: 'Fade In',
    description: 'Simple opacity fade from transparent to visible',
    category: 'entrance',
    defaultDuration: 20,
    keyframes: [
      { frame: 0, values: { opacity: 0 }, easing: 'ease-out' },
      { frame: 20, values: { opacity: 1 }, easing: 'ease-out' },
    ],
  },

  'slide-in-left': {
    name: 'Slide In Left',
    description: 'Slide in from the left side with fade',
    category: 'entrance',
    defaultDuration: 25,
    keyframes: [
      { frame: 0, values: { positionX: 0.3, opacity: 0 }, easing: 'ease-out' },
      { frame: 25, values: { positionX: 0.5, opacity: 1 }, easing: 'ease-out' },
    ],
  },

  'slide-in-right': {
    name: 'Slide In Right',
    description: 'Slide in from the right side with fade',
    category: 'entrance',
    defaultDuration: 25,
    keyframes: [
      { frame: 0, values: { positionX: 0.7, opacity: 0 }, easing: 'ease-out' },
      { frame: 25, values: { positionX: 0.5, opacity: 1 }, easing: 'ease-out' },
    ],
  },

  'slide-in-up': {
    name: 'Slide In Up',
    description: 'Slide in from the bottom with fade',
    category: 'entrance',
    defaultDuration: 25,
    keyframes: [
      { frame: 0, values: { positionY: 0.6, opacity: 0 }, easing: 'ease-out' },
      { frame: 25, values: { positionY: 0.5, opacity: 1 }, easing: 'ease-out' },
    ],
  },

  'slide-in-down': {
    name: 'Slide In Down',
    description: 'Slide in from the top with fade',
    category: 'entrance',
    defaultDuration: 25,
    keyframes: [
      { frame: 0, values: { positionY: 0.4, opacity: 0 }, easing: 'ease-out' },
      { frame: 25, values: { positionY: 0.5, opacity: 1 }, easing: 'ease-out' },
    ],
  },

  'zoom-in': {
    name: 'Zoom In',
    description: 'Scale up from small with fade',
    category: 'entrance',
    defaultDuration: 25,
    keyframes: [
      { frame: 0, values: { scale: 0.8, opacity: 0 }, easing: 'ease-out' },
      { frame: 25, values: { scale: 1, opacity: 1 }, easing: 'ease-out' },
    ],
  },

  'bounce': {
    name: 'Bounce',
    description: 'Playful bounce entrance with overshoot',
    category: 'entrance',
    defaultDuration: 35,
    keyframes: [
      { frame: 0, values: { scale: 0, opacity: 0 }, easing: 'ease-out' },
      { frame: 15, values: { scale: 1.15, opacity: 1 }, easing: 'ease-out' },
      { frame: 25, values: { scale: 0.95 }, easing: 'ease-in-out' },
      { frame: 35, values: { scale: 1 }, easing: 'ease-out' },
    ],
  },

  'elastic': {
    name: 'Elastic',
    description: 'Springy elastic entrance with multiple bounces',
    category: 'entrance',
    defaultDuration: 50,
    keyframes: [
      { frame: 0, values: { scale: 0, opacity: 0 }, easing: 'ease-out' },
      { frame: 18, values: { scale: 1.2, opacity: 1 }, easing: 'ease-out' },
      { frame: 28, values: { scale: 0.9 }, easing: 'ease-in-out' },
      { frame: 38, values: { scale: 1.05 }, easing: 'ease-in-out' },
      { frame: 50, values: { scale: 1 }, easing: 'ease-out' },
    ],
  },

  'spring-pop': {
    name: 'Spring Pop',
    description: 'Quick spring pop entrance',
    category: 'entrance',
    defaultDuration: 20,
    keyframes: [
      { frame: 0, values: { scale: 0.5, opacity: 0 }, easing: 'spring' },
      { frame: 20, values: { scale: 1, opacity: 1 }, easing: 'spring' },
    ],
  },

  'blur-in': {
    name: 'Blur In',
    description: 'Dramatic blur-to-focus reveal',
    category: 'entrance',
    defaultDuration: 30,
    keyframes: [
      { frame: 0, values: { opacity: 0, blur: 20 }, easing: 'ease-out' },
      { frame: 30, values: { opacity: 1, blur: 0 }, easing: 'ease-out' },
    ],
  },

  'flip-in': {
    name: 'Flip In',
    description: 'Rotation entrance with skew effect',
    category: 'entrance',
    defaultDuration: 30,
    keyframes: [
      { frame: 0, values: { rotation: -90, opacity: 0, skewY: 10 }, easing: 'ease-out' },
      { frame: 30, values: { rotation: 0, opacity: 1, skewY: 0 }, easing: 'ease-out' },
    ],
  },

  'rotate-in': {
    name: 'Rotate In',
    description: 'Spinning entrance',
    category: 'entrance',
    defaultDuration: 30,
    keyframes: [
      { frame: 0, values: { rotation: -180, scale: 0.5, opacity: 0 }, easing: 'ease-out' },
      { frame: 30, values: { rotation: 0, scale: 1, opacity: 1 }, easing: 'ease-out' },
    ],
  },

  // =============================================
  // EXIT ANIMATIONS
  // =============================================

  'fade-out': {
    name: 'Fade Out',
    description: 'Simple opacity fade to transparent',
    category: 'exit',
    defaultDuration: 20,
    keyframes: [
      { frame: 0, values: { opacity: 1 }, easing: 'ease-in' },
      { frame: 20, values: { opacity: 0 }, easing: 'ease-in' },
    ],
  },

  'zoom-out': {
    name: 'Zoom Out',
    description: 'Scale down with fade out',
    category: 'exit',
    defaultDuration: 25,
    keyframes: [
      { frame: 0, values: { scale: 1, opacity: 1 }, easing: 'ease-in' },
      { frame: 25, values: { scale: 0.8, opacity: 0 }, easing: 'ease-in' },
    ],
  },

  'blur-out': {
    name: 'Blur Out',
    description: 'Blur and fade out',
    category: 'exit',
    defaultDuration: 25,
    keyframes: [
      { frame: 0, values: { opacity: 1, blur: 0 }, easing: 'ease-in' },
      { frame: 25, values: { opacity: 0, blur: 15 }, easing: 'ease-in' },
    ],
  },

  'slide-out-left': {
    name: 'Slide Out Left',
    description: 'Slide out to the left',
    category: 'exit',
    defaultDuration: 25,
    keyframes: [
      { frame: 0, values: { positionX: 0.5, opacity: 1 }, easing: 'ease-in' },
      { frame: 25, values: { positionX: 0.3, opacity: 0 }, easing: 'ease-in' },
    ],
  },

  'slide-out-right': {
    name: 'Slide Out Right',
    description: 'Slide out to the right',
    category: 'exit',
    defaultDuration: 25,
    keyframes: [
      { frame: 0, values: { positionX: 0.5, opacity: 1 }, easing: 'ease-in' },
      { frame: 25, values: { positionX: 0.7, opacity: 0 }, easing: 'ease-in' },
    ],
  },

  // =============================================
  // EMPHASIS ANIMATIONS
  // =============================================

  'pulse': {
    name: 'Pulse',
    description: 'Breathing scale animation for emphasis',
    category: 'emphasis',
    defaultDuration: 60,
    keyframes: [
      { frame: 0, values: { scale: 1 }, easing: 'ease-in-out' },
      { frame: 30, values: { scale: 1.05 }, easing: 'ease-in-out' },
      { frame: 60, values: { scale: 1 }, easing: 'ease-in-out' },
    ],
  },

  'shake': {
    name: 'Shake',
    description: 'Attention-grabbing horizontal shake',
    category: 'emphasis',
    defaultDuration: 20,
    keyframes: [
      { frame: 0, values: { positionX: 0.5 }, easing: 'linear' },
      { frame: 4, values: { positionX: 0.48 }, easing: 'linear' },
      { frame: 8, values: { positionX: 0.52 }, easing: 'linear' },
      { frame: 12, values: { positionX: 0.49 }, easing: 'linear' },
      { frame: 16, values: { positionX: 0.51 }, easing: 'linear' },
      { frame: 20, values: { positionX: 0.5 }, easing: 'ease-out' },
    ],
  },

  'wiggle': {
    name: 'Wiggle',
    description: 'Playful rotation wiggle',
    category: 'emphasis',
    defaultDuration: 30,
    keyframes: [
      { frame: 0, values: { rotation: 0 }, easing: 'ease-in-out' },
      { frame: 6, values: { rotation: -5 }, easing: 'ease-in-out' },
      { frame: 12, values: { rotation: 5 }, easing: 'ease-in-out' },
      { frame: 18, values: { rotation: -3 }, easing: 'ease-in-out' },
      { frame: 24, values: { rotation: 2 }, easing: 'ease-in-out' },
      { frame: 30, values: { rotation: 0 }, easing: 'ease-out' },
    ],
  },

  'heartbeat': {
    name: 'Heartbeat',
    description: 'Double-pulse heartbeat effect',
    category: 'emphasis',
    defaultDuration: 40,
    keyframes: [
      { frame: 0, values: { scale: 1 }, easing: 'ease-out' },
      { frame: 8, values: { scale: 1.1 }, easing: 'ease-out' },
      { frame: 16, values: { scale: 1 }, easing: 'ease-out' },
      { frame: 24, values: { scale: 1.15 }, easing: 'ease-out' },
      { frame: 40, values: { scale: 1 }, easing: 'ease-out' },
    ],
  },

  'jello': {
    name: 'Jello',
    description: 'Squishy jello effect with skew',
    category: 'emphasis',
    defaultDuration: 40,
    keyframes: [
      { frame: 0, values: { skewX: 0, skewY: 0 }, easing: 'ease-in-out' },
      { frame: 8, values: { skewX: -8, skewY: -4 }, easing: 'ease-in-out' },
      { frame: 16, values: { skewX: 6, skewY: 3 }, easing: 'ease-in-out' },
      { frame: 24, values: { skewX: -4, skewY: -2 }, easing: 'ease-in-out' },
      { frame: 32, values: { skewX: 2, skewY: 1 }, easing: 'ease-in-out' },
      { frame: 40, values: { skewX: 0, skewY: 0 }, easing: 'ease-out' },
    ],
  },

  'glow': {
    name: 'Glow',
    description: 'Pulsing brightness glow effect',
    category: 'emphasis',
    defaultDuration: 45,
    keyframes: [
      { frame: 0, values: { brightness: 1 }, easing: 'ease-in-out' },
      { frame: 15, values: { brightness: 1.3 }, easing: 'ease-in-out' },
      { frame: 30, values: { brightness: 1 }, easing: 'ease-in-out' },
      { frame: 45, values: { brightness: 1 }, easing: 'ease-in-out' },
    ],
  },

  // =============================================
  // MOTION / CAMERA ANIMATIONS
  // =============================================

  'float': {
    name: 'Float',
    description: 'Gentle floating up and down',
    category: 'motion',
    defaultDuration: 90,
    keyframes: [
      { frame: 0, values: { positionY: 0.5 }, easing: 'ease-in-out' },
      { frame: 45, values: { positionY: 0.48 }, easing: 'ease-in-out' },
      { frame: 90, values: { positionY: 0.5 }, easing: 'ease-in-out' },
    ],
  },

  'drift-right': {
    name: 'Drift Right',
    description: 'Slow drift to the right',
    category: 'motion',
    defaultDuration: 90,
    keyframes: [
      { frame: 0, values: { positionX: 0.48 }, easing: 'linear' },
      { frame: 90, values: { positionX: 0.52 }, easing: 'linear' },
    ],
  },

  'ken-burns-zoom': {
    name: 'Ken Burns Zoom',
    description: 'Slow cinematic zoom with subtle drift',
    category: 'motion',
    defaultDuration: 120,
    keyframes: [
      { frame: 0, values: { scale: 1, positionX: 0.48 }, easing: 'linear' },
      { frame: 120, values: { scale: 1.1, positionX: 0.52 }, easing: 'linear' },
    ],
  },

  // =============================================
  // FILTER ANIMATIONS
  // =============================================

  'color-pop': {
    name: 'Color Pop',
    description: 'Desaturated to vibrant color reveal',
    category: 'filter',
    defaultDuration: 30,
    keyframes: [
      { frame: 0, values: { saturate: 0.3 }, easing: 'ease-out' },
      { frame: 30, values: { saturate: 1.2 }, easing: 'ease-out' },
    ],
  },

  'flash': {
    name: 'Flash',
    description: 'Quick brightness flash',
    category: 'filter',
    defaultDuration: 15,
    keyframes: [
      { frame: 0, values: { brightness: 1 }, easing: 'ease-out' },
      { frame: 5, values: { brightness: 2 }, easing: 'ease-out' },
      { frame: 15, values: { brightness: 1 }, easing: 'ease-out' },
    ],
  },

  'hue-shift': {
    name: 'Hue Shift',
    description: 'Animate through color spectrum',
    category: 'filter',
    defaultDuration: 60,
    keyframes: [
      { frame: 0, values: { hueRotate: 0 }, easing: 'linear' },
      { frame: 60, values: { hueRotate: 360 }, easing: 'linear' },
    ],
  },

  'cinematic-focus': {
    name: 'Cinematic Focus',
    description: 'Blur to sharp focus with contrast boost',
    category: 'filter',
    defaultDuration: 40,
    keyframes: [
      { frame: 0, values: { blur: 8, contrast: 0.9 }, easing: 'ease-out' },
      { frame: 40, values: { blur: 0, contrast: 1.1 }, easing: 'ease-out' },
    ],
  },
};

// =============================================
// Get preset by name
// =============================================

export function getPreset(name: string): AnimationPreset | undefined {
  return ANIMATION_PRESETS[name];
}

// =============================================
// Get presets by category
// =============================================

export function getPresetsByCategory(category: AnimationPreset['category']): AnimationPreset[] {
  return Object.values(ANIMATION_PRESETS).filter((p) => p.category === category);
}

// =============================================
// Apply preset to an item
// =============================================

export function applyPreset(
  presetName: string,
  options?: {
    durationInFrames?: number;
    intensity?: number;
  }
): PropertyKeyframe[] {
  const preset = getPreset(presetName);
  if (!preset) {
    throw new Error(`Unknown animation preset: ${presetName}`);
  }

  let keyframes = [...preset.keyframes];

  // Scale to custom duration if provided
  if (options?.durationInFrames && options.durationInFrames !== preset.defaultDuration) {
    keyframes = scaleKeyframesToDuration(keyframes, preset.defaultDuration, options.durationInFrames);
  }

  // Scale intensity if provided
  if (options?.intensity && options.intensity !== 1) {
    keyframes = scaleKeyframeIntensity(keyframes, options.intensity);
  }

  return keyframes;
}

// =============================================
// List all preset names
// =============================================

export function getAllPresetNames(): string[] {
  return Object.keys(ANIMATION_PRESETS);
}
