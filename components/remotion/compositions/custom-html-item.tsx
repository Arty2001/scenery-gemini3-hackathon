'use client';

/**
 * Custom HTML item renderer for Remotion compositions.
 *
 * Renders user-imported HTML components with the same capabilities
 * as ComponentItemRenderer - device frames, sizing, positioning, etc.
 */

import React, { useRef, useLayoutEffect } from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame } from 'remotion';
import type { CustomHtmlItem } from '@/lib/composition/types';
import { useItemAnimation } from '@/components/remotion/animation/use-item-animation';
import { useKeyframeAnimation } from '@/components/remotion/animation/use-keyframe-animation';
import { useCompositionStore } from '@/lib/composition/store';
import { buildFilterStyle, buildSkewTransform, buildShadowStyle } from '@/components/remotion/animation/build-styles';

// =============================================
// Types
// =============================================

interface CustomHtmlItemRendererProps {
  item: CustomHtmlItem;
}

// Device frame dimensions (CSS pixels) - same as ComponentItemRenderer
const DEVICE_SIZES = {
  phone: { width: 375, height: 812 },   // iPhone-style
  laptop: { width: 1280, height: 800 },  // Standard laptop
  full: null, // No frame, fill container
} as const;

/**
 * Parse objectPosition into alignment values.
 */
function parseAlignment(objectPosition: string) {
  const parts = objectPosition.toLowerCase().split(/\s+/);
  const h = parts.find(p => ['left', 'center', 'right'].includes(p)) ?? 'center';
  const v = parts.find(p => ['top', 'center', 'bottom'].includes(p)) ?? 'center';
  return { h, v };
}

// =============================================
// Component
// =============================================

export function CustomHtmlItemRenderer({ item }: CustomHtmlItemRendererProps) {
  const animStyle = useItemAnimation(item.enterAnimation, item.exitAnimation, item.durationInFrames);
  const kf = useKeyframeAnimation(item.keyframes);
  const { width: compWidth, height: compHeight } = useVideoConfig();
  const frame = useCurrentFrame();
  const displaySize = item.displaySize ?? 'laptop';
  const isSelected = useCompositionStore((s) => s.selectedItemId) === item.id;
  const kfOpacity = kf.opacity ?? 1;
  const kfScale = kf.scale ?? 1;
  const kfRotation = kf.rotation ?? 0;
  // Always use explicit positioning with default to center (0.5, 0.5)
  const posX = kf.positionX ?? item.position?.x ?? 0.5;
  const posY = kf.positionY ?? item.position?.y ?? 0.5;

  // Build advanced styles from keyframes
  const kfFilterStyle = buildFilterStyle(kf);
  const skewTransform = buildSkewTransform(kf);
  const shadowStyle = buildShadowStyle(kf);

  // Combine keyframe filter with animation filter
  const combinedFilter = [
    kfFilterStyle !== 'none' ? kfFilterStyle : '',
    animStyle.filter ?? '',
  ].filter(Boolean).join(' ') || undefined;

  const containerRef = useRef<HTMLDivElement>(null);

  if (!item.html) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#0001',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: '#888', fontSize: 14 }}>No HTML content</div>
      </AbsoluteFill>
    );
  }

  // Resolve container dimensions: custom overrides > preset > full
  const hasCustomSize = item.containerWidth != null || item.containerHeight != null;
  const preset = DEVICE_SIZES[displaySize];

  if (!hasCustomSize && (displaySize === 'full' || !preset)) {
    return (
      <AbsoluteFill>
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            opacity: animStyle.opacity * kfOpacity,
            transform: [
              animStyle.transform,
              kfScale !== 1 ? `scale(${kfScale})` : '',
              kfRotation !== 0 ? `rotate(${kfRotation}deg)` : '',
              skewTransform,
            ].filter(v => v && v !== 'none').join(' ') || 'none',
            filter: combinedFilter,
            boxShadow: shadowStyle,
          }}
        >
          <div
            ref={containerRef}
            data-custom-html={item.customComponentId}
            style={{
              width: '100%',
              maxWidth: '100%',
              overflow: 'hidden',
            }}
            dangerouslySetInnerHTML={{ __html: item.html }}
          />
        </div>
      </AbsoluteFill>
    );
  }

  // Use composition dimensions as fallback when no preset (e.g., displaySize='full')
  const frameW = hasCustomSize ? (item.containerWidth ?? preset?.width ?? compWidth) : preset!.width;
  const frameH = hasCustomSize ? (item.containerHeight ?? preset?.height ?? compHeight) : preset!.height;
  const isPhoneRatio = frameH > frameW * 1.5;
  const { h, v } = parseAlignment(item.objectPosition ?? 'center center');

  const padding = 60;
  const availW = compWidth - padding * 2;
  const availH = compHeight - padding * 2;
  const zoomLevel = Math.min(availW / frameW, availH / frameH);

  // Position helper for translate centering
  const getTranslatePercent = (v: number) =>
    v <= 0.25 ? '0%' : v >= 0.75 ? '-100%' : '-50%';

  return (
    <AbsoluteFill>
      {/* Outer animation wrapper */}
      <div
        style={{
          position: 'absolute',
          left: `${posX * 100}%`,
          top: `${posY * 100}%`,
          transform: [
            `translate(${getTranslatePercent(posX)}, ${getTranslatePercent(posY)})`,
            kfScale !== 1 ? `scale(${kfScale})` : '',
            kfRotation !== 0 ? `rotate(${kfRotation}deg)` : '',
            skewTransform,
            animStyle.transform !== 'none' ? animStyle.transform : '',
          ].filter(Boolean).join(' ') || 'none',
          opacity: animStyle.opacity * kfOpacity,
          filter: combinedFilter,
        }}
      >
        {/* Device frame */}
        <div
          style={{
            width: frameW,
            height: frameH,
            borderRadius: isPhoneRatio ? 40 : 12,
            overflow: 'hidden',
            boxShadow: shadowStyle ?? (isSelected
              ? '0 0 0 3px rgba(59,130,246,0.7), 0 4px 16px rgba(0,0,0,0.12)'
              : '0 4px 16px rgba(0,0,0,0.12)'),
            backgroundColor: item.backgroundColor === 'transparent' ? undefined : (item.backgroundColor ?? '#fff'),
            zoom: zoomLevel,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              alignItems: h === 'left' ? 'flex-start' : h === 'right' ? 'flex-end' : 'center',
              justifyContent: v === 'top' ? 'flex-start' : v === 'bottom' ? 'flex-end' : 'center',
              padding: isPhoneRatio ? '16px' : '24px',
            }}
          >
            <div
              ref={containerRef}
              data-custom-html={item.customComponentId}
              style={{
                width: '100%',
                maxWidth: '100%',
                height: 'auto',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
              }}
              dangerouslySetInnerHTML={{ __html: item.html }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
