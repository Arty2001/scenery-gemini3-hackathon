'use client';

/**
 * Color Grading Effect Renderer
 *
 * Applies LUT-style color adjustments using SVG filters.
 * Includes popular presets and custom adjustment controls.
 */

import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { ColorGradeItem, ColorGradePreset } from '@/lib/composition/types';

interface ColorGradeItemRendererProps {
  item: ColorGradeItem;
}

// Color grading preset configurations
const PRESET_CONFIGS: Record<ColorGradePreset, {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  shadows?: string;
  highlights?: string;
}> = {
  'cinematic-teal-orange': {
    brightness: 0,
    contrast: 0.15,
    saturation: 0.1,
    temperature: 0.1,
    tint: 0,
    shadows: '#1a4a5c',      // Teal shadows
    highlights: '#ffa366',   // Orange highlights
  },
  'vintage-warm': {
    brightness: 0.05,
    contrast: -0.1,
    saturation: -0.2,
    temperature: 0.3,
    tint: 0.05,
    shadows: '#3d2817',
    highlights: '#fff4e6',
  },
  'vintage-cool': {
    brightness: 0,
    contrast: -0.05,
    saturation: -0.3,
    temperature: -0.2,
    tint: -0.1,
    shadows: '#1a2a3a',
    highlights: '#e6f0ff',
  },
  'noir': {
    brightness: 0,
    contrast: 0.3,
    saturation: -1,  // Full desaturation
    temperature: 0,
    tint: 0,
  },
  'cyberpunk': {
    brightness: 0.05,
    contrast: 0.2,
    saturation: 0.3,
    temperature: -0.1,
    tint: 0.2,
    shadows: '#1a0033',      // Deep purple
    highlights: '#ff00ff',   // Magenta
  },
  'sunset': {
    brightness: 0.1,
    contrast: 0.1,
    saturation: 0.2,
    temperature: 0.4,
    tint: 0.1,
    shadows: '#331a00',
    highlights: '#ffcc66',
  },
  'moonlight': {
    brightness: -0.1,
    contrast: 0.1,
    saturation: -0.2,
    temperature: -0.3,
    tint: 0,
    shadows: '#0a1a2a',
    highlights: '#b3d9ff',
  },
  'sepia': {
    brightness: 0.05,
    contrast: 0,
    saturation: -0.5,
    temperature: 0.4,
    tint: 0.1,
    shadows: '#3d2817',
    highlights: '#f5e6d3',
  },
  'custom': {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
  },
};

export const ColorGradeItemRenderer: React.FC<ColorGradeItemRendererProps> = ({
  item,
}) => {
  const {
    preset = 'cinematic-teal-orange',
    intensity = 1,
    brightness: customBrightness,
    contrast: customContrast,
    saturation: customSaturation,
    temperature: customTemperature,
    tint: customTint,
    shadows: customShadows,
    highlights: customHighlights,
  } = item;

  // Get preset configuration and merge with custom values
  const presetConfig = PRESET_CONFIGS[preset];
  const config = useMemo(() => ({
    brightness: customBrightness ?? presetConfig.brightness,
    contrast: customContrast ?? presetConfig.contrast,
    saturation: customSaturation ?? presetConfig.saturation,
    temperature: customTemperature ?? presetConfig.temperature,
    tint: customTint ?? presetConfig.tint,
    shadows: customShadows ?? presetConfig.shadows,
    highlights: customHighlights ?? presetConfig.highlights,
  }), [presetConfig, customBrightness, customContrast, customSaturation, customTemperature, customTint, customShadows, customHighlights]);

  // Build CSS filter string
  const filterParts: string[] = [];

  // Brightness: 1 = normal, > 1 = brighter, < 1 = darker
  const brightnessValue = 1 + config.brightness * intensity;
  filterParts.push(`brightness(${brightnessValue})`);

  // Contrast: 1 = normal
  const contrastValue = 1 + config.contrast * intensity;
  filterParts.push(`contrast(${contrastValue})`);

  // Saturation: 1 = normal, 0 = grayscale, > 1 = vibrant
  const saturationValue = 1 + config.saturation * intensity;
  filterParts.push(`saturate(${saturationValue})`);

  // Temperature via hue-rotate and sepia
  if (config.temperature !== 0) {
    // Warm = add yellow/orange, Cool = add blue
    const sepiaAmount = Math.max(0, config.temperature * intensity * 0.3);
    if (sepiaAmount > 0) filterParts.push(`sepia(${sepiaAmount})`);

    // Subtle hue shift for temperature
    const hueShift = config.temperature * intensity * 15;
    if (hueShift !== 0) filterParts.push(`hue-rotate(${hueShift}deg)`);
  }

  const filterString = filterParts.join(' ');

  // For shadow/highlight color grading, we use a gradient overlay
  const hasColorSplit = config.shadows || config.highlights;

  // Convert hex to rgba with specified alpha
  const hexToRgba = (hex: string | undefined, alpha: number): string => {
    if (!hex) return 'transparent';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const filterId = `color-grade-${item.id}`;

  return (
    <>
      {/* Main filter overlay */}
      <AbsoluteFill
        style={{
          backdropFilter: filterString,
          WebkitBackdropFilter: filterString,
          pointerEvents: 'none',
        }}
      />

      {/* Shadow/Highlight color split overlay */}
      {hasColorSplit && (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
          }}
        >
          <svg width="100%" height="100%" style={{ position: 'absolute' }}>
            <defs>
              <linearGradient id={`${filterId}-shadow`} x1="0%" y1="100%" x2="0%" y2="0%">
                <stop
                  offset="0%"
                  stopColor={config.shadows || 'transparent'}
                  stopOpacity={0.3 * intensity}
                />
                <stop offset="50%" stopColor="transparent" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`${filterId}-highlight`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop
                  offset="0%"
                  stopColor={config.highlights || 'transparent'}
                  stopOpacity={0.2 * intensity}
                />
                <stop offset="50%" stopColor="transparent" stopOpacity="0" />
              </linearGradient>
            </defs>
            {config.shadows && (
              <rect
                width="100%"
                height="100%"
                fill={`url(#${filterId}-shadow)`}
                style={{ mixBlendMode: 'multiply' }}
              />
            )}
            {config.highlights && (
              <rect
                width="100%"
                height="100%"
                fill={`url(#${filterId}-highlight)`}
                style={{ mixBlendMode: 'screen' }}
              />
            )}
          </svg>
        </AbsoluteFill>
      )}
    </>
  );
};
