/**
 * Spring physics presets inspired by Remotion Lambda trailer.
 *
 * The trailer consistently uses damping: 200 for controlled, professional motion.
 * These presets provide consistent, reusable spring configurations.
 */

import type { SpringPreset } from '@/lib/composition/types';

export interface SpringConfig {
  damping: number;
  mass: number;
  stiffness?: number;
}

/**
 * Spring configuration presets.
 * Based on analysis of https://github.com/remotion-dev/trailer-lambda
 */
export const SPRING_PRESETS: Record<SpringPreset, SpringConfig> = {
  // The standard - used throughout the trailer for most animations
  // High damping = controlled motion without bounce
  smooth: { damping: 200, mass: 1 },

  // Quick, responsive motion - good for UI elements
  // Lower mass = faster response to changes
  snappy: { damping: 200, mass: 0.5 },

  // Slow, deliberate motion - used for dramatic zoom outs
  // High mass = slower, more weighty feel
  heavy: { damping: 200, mass: 5 },

  // Playful motion with overshoot - good for celebrations, emphasis
  // Lower damping = more oscillation
  bouncy: { damping: 100, mass: 1 },

  // Soft, subtle motion - good for background elements
  // High damping + high mass = very smooth, minimal overshoot
  gentle: { damping: 300, mass: 2 },

  // Lots of wobble and overshoot - for attention-grabbing effects
  // Low damping + moderate stiffness = visible wobble
  wobbly: { damping: 80, mass: 1, stiffness: 180 },
};

/**
 * Get spring config for a preset name.
 * Falls back to 'smooth' if preset not found.
 */
export function getSpringConfig(preset?: SpringPreset): SpringConfig {
  return SPRING_PRESETS[preset ?? 'smooth'] ?? SPRING_PRESETS.smooth;
}

/**
 * Animation preset descriptions for UI.
 */
export const ANIMATION_PRESETS = {
  // Basic animations
  none: {
    label: 'None',
    description: 'No animation',
    category: 'basic',
  },
  fade: {
    label: 'Fade',
    description: 'Simple opacity fade',
    category: 'basic',
  },
  slide: {
    label: 'Slide',
    description: 'Slide in from edge',
    category: 'basic',
  },
  scale: {
    label: 'Scale',
    description: 'Scale up from small',
    category: 'basic',
  },

  // Spring-based animations (the good stuff)
  'spring-scale': {
    label: 'Spring Scale',
    description: 'Pop in with spring physics (recommended)',
    category: 'spring',
    recommended: true,
  },
  'spring-slide': {
    label: 'Spring Slide',
    description: 'Slide with spring overshoot',
    category: 'spring',
  },
  'spring-bounce': {
    label: 'Bounce',
    description: 'Bouncy scale with playful feel',
    category: 'spring',
  },

  // Advanced animations
  flip: {
    label: '3D Flip',
    description: 'Card flip effect',
    category: 'advanced',
  },
  'zoom-blur': {
    label: 'Zoom Blur',
    description: 'Zoom with blur effect',
    category: 'advanced',
  },
} as const;

/**
 * Spring preset descriptions for UI.
 */
export const SPRING_PRESET_OPTIONS = [
  { value: 'smooth' as const, label: 'Smooth', description: 'Controlled, professional motion' },
  { value: 'snappy' as const, label: 'Snappy', description: 'Quick, responsive' },
  { value: 'heavy' as const, label: 'Heavy', description: 'Slow, deliberate' },
  { value: 'bouncy' as const, label: 'Bouncy', description: 'Playful with overshoot' },
  { value: 'gentle' as const, label: 'Gentle', description: 'Soft, subtle' },
  { value: 'wobbly' as const, label: 'Wobbly', description: 'Lots of wobble and overshoot' },
];

/**
 * Scene transition descriptions for UI.
 */
export const SCENE_TRANSITIONS = {
  fade: {
    label: 'Fade',
    description: 'Cross-fade between scenes',
  },
  slide: {
    label: 'Slide',
    description: 'Slide transition',
  },
  curtain: {
    label: 'Curtain',
    description: 'Two panels slide apart to reveal',
  },
  wheel: {
    label: 'Wheel',
    description: 'Rotational swing effect',
  },
  flip: {
    label: 'Flip',
    description: '3D card flip between scenes',
  },
} as const;
