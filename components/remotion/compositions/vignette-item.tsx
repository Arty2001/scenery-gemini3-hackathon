'use client';

/**
 * Vignette Effect Renderer
 *
 * Creates a darkened edge effect for cinematic framing and focus.
 * Supports circular and rectangular vignettes with customizable softness.
 */

import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { VignetteItem } from '@/lib/composition/types';

interface VignetteItemRendererProps {
  item: VignetteItem;
}

export const VignetteItemRenderer: React.FC<VignetteItemRendererProps> = ({
  item,
}) => {
  const {
    intensity = 0.5,
    size = 0.5,
    softness = 0.5,
    color = '#000000',
    shape = 'circular',
  } = item;

  // Calculate gradient parameters
  // Size controls how far the vignette extends (smaller = larger dark area)
  // Softness controls the gradient spread (higher = smoother transition)
  const innerRadius = Math.max(0, 100 - (1 - size) * 80);
  const outerRadius = innerRadius + softness * 60 + 20;

  // Convert hex color to rgba for gradient
  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const transparentColor = hexToRgba(color, 0);
  const solidColor = hexToRgba(color, intensity);

  // Build gradient based on shape
  const gradient = shape === 'circular'
    ? `radial-gradient(ellipse at center, ${transparentColor} ${innerRadius}%, ${solidColor} ${outerRadius}%)`
    : `
        linear-gradient(to right, ${solidColor} 0%, ${transparentColor} ${softness * 30}%, ${transparentColor} ${100 - softness * 30}%, ${solidColor} 100%),
        linear-gradient(to bottom, ${solidColor} 0%, ${transparentColor} ${softness * 30}%, ${transparentColor} ${100 - softness * 30}%, ${solidColor} 100%)
      `;

  return (
    <AbsoluteFill
      style={{
        background: gradient,
        backgroundBlendMode: shape === 'rectangular' ? 'multiply' : undefined,
        pointerEvents: 'none',
      }}
    />
  );
};
