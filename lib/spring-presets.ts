/**
 * Spring physics presets for professional motion design.
 *
 * These presets are inspired by the Remotion Lambda trailer and professional
 * motion graphics. Spring physics create natural, organic motion that feels
 * more alive than traditional easing curves.
 */

import type { SpringPreset, SpringConfig } from '@/lib/composition/types';

// =============================================
// Spring Preset Configurations
// =============================================

/**
 * Map of preset names to their spring configurations.
 */
export const SPRING_PRESETS: Record<SpringPreset, SpringConfig> = {
  smooth: {
    mass: 1,
    stiffness: 100,
    damping: 200,
    velocity: 0,
  },
  snappy: {
    mass: 0.5,
    stiffness: 300,
    damping: 200,
    velocity: 0,
  },
  heavy: {
    mass: 5,
    stiffness: 150,
    damping: 200,
    velocity: 0,
  },
  bouncy: {
    mass: 1,
    stiffness: 200,
    damping: 100,
    velocity: 0,
  },
  gentle: {
    mass: 2,
    stiffness: 100,
    damping: 300,
    velocity: 0,
  },
  wobbly: {
    mass: 1,
    stiffness: 180,
    damping: 80,
    velocity: 0,
  },
};

/**
 * Get spring configuration for a preset name.
 */
export function getSpringConfig(preset: SpringPreset): SpringConfig {
  return SPRING_PRESETS[preset];
}

/**
 * Get spring configuration, preferring custom config over preset.
 */
export function resolveSpringConfig(
  springConfig?: SpringConfig,
  springPreset?: SpringPreset
): SpringConfig | null {
  if (springConfig) {
    return springConfig;
  }
  if (springPreset) {
    return SPRING_PRESETS[springPreset];
  }
  return null;
}

// =============================================
// Spring Preset Metadata (for UI)
// =============================================

export interface SpringPresetInfo {
  name: SpringPreset;
  label: string;
  description: string;
  icon: string; // Emoji for quick recognition
}

export const SPRING_PRESET_INFO: SpringPresetInfo[] = [
  {
    name: 'smooth',
    label: 'Smooth',
    description: 'Standard controlled motion, no overshoot',
    icon: '🌊',
  },
  {
    name: 'snappy',
    label: 'Snappy',
    description: 'Quick and responsive, slight overshoot',
    icon: '⚡',
  },
  {
    name: 'heavy',
    label: 'Heavy',
    description: 'Slow and deliberate, cinematic feel',
    icon: '🏔️',
  },
  {
    name: 'bouncy',
    label: 'Bouncy',
    description: 'Playful with visible bounce',
    icon: '🎾',
  },
  {
    name: 'gentle',
    label: 'Gentle',
    description: 'Soft and subtle, elegant motion',
    icon: '🍃',
  },
  {
    name: 'wobbly',
    label: 'Wobbly',
    description: 'Lots of wobble and overshoot',
    icon: '🌀',
  },
];

// =============================================
// Default Spring Configuration
// =============================================

export const DEFAULT_SPRING_CONFIG: SpringConfig = {
  mass: 1,
  stiffness: 100,
  damping: 10,
  velocity: 0,
};

// =============================================
// Spring Validation
// =============================================

/**
 * Clamp spring config values to safe ranges.
 */
export function clampSpringConfig(config: SpringConfig): SpringConfig {
  return {
    mass: Math.max(0.1, Math.min(10, config.mass)),
    stiffness: Math.max(1, Math.min(1000, config.stiffness)),
    damping: Math.max(1, Math.min(500, config.damping)),
    velocity: config.velocity ?? 0,
  };
}

/**
 * Check if a spring config will produce stable animation.
 * Unstable springs can cause infinite oscillation or very slow settling.
 */
export function isSpringStable(config: SpringConfig): boolean {
  // Critical damping ratio: damping / (2 * sqrt(stiffness * mass))
  // Ratio >= 1 means no overshoot, < 1 means some bounce
  // Very low ratios (< 0.1) can cause issues
  const criticalDamping = 2 * Math.sqrt(config.stiffness * config.mass);
  const dampingRatio = config.damping / criticalDamping;
  return dampingRatio >= 0.05; // Allow some bounce but not infinite oscillation
}
