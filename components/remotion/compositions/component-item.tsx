'use client';

/**
 * Component item renderer for Remotion compositions.
 *
 * Renders discovered components using their pre-generated preview HTML
 * directly via dangerouslySetInnerHTML. Supports device frame sizing
 * (phone, laptop, or full) to give predictable dimensions.
 *
 * Uses CSS zoom (not transform: scale) to keep text and UI crisp
 * at any display size.
 */

import React, { useRef, useLayoutEffect } from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame } from 'remotion';
import type { ComponentItem } from '@/lib/composition/types';
import { useItemAnimation } from '@/components/remotion/animation/use-item-animation';
import { useKeyframeAnimation } from '@/components/remotion/animation/use-keyframe-animation';
import { useCompositionStore } from '@/lib/composition/store';
import type { InteractionState } from '@/components/remotion/animation/use-interaction-state';
import { buildFilterStyle, buildSkewTransform, buildShadowStyle } from '@/components/remotion/animation/build-styles';

// =============================================
// Types
// =============================================

interface ComponentItemRendererProps {
  item: ComponentItem;
  previewHtml?: string; // Pre-generated HTML from discovery
  interactionState?: InteractionState;
}

// Device frame dimensions (CSS pixels)
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
// DOM interaction applier
// =============================================

/** Track original styles so we can restore them when interactions end */
const INTERACTION_ATTR = 'data-interaction-applied';

/** Cursor blink indicator marker */
const TYPING_CURSOR_ID = 'typing-cursor-indicator';

function applyInteractionsToDOM(
  container: HTMLElement | null,
  state?: InteractionState,
  frame?: number,
) {
  if (!container) return;

  // Clear previous interaction styles
  const previouslyStyled = container.querySelectorAll(`[${INTERACTION_ATTR}]`);
  previouslyStyled.forEach((el) => {
    const orig = el.getAttribute(INTERACTION_ATTR);
    if (orig) {
      (el as HTMLElement).style.cssText = orig;
    } else {
      (el as HTMLElement).style.cssText = '';
    }
    el.removeAttribute(INTERACTION_ATTR);
  });

  // Remove any existing typing cursor indicators
  const existingCursors = container.querySelectorAll(`[data-${TYPING_CURSOR_ID}]`);
  existingCursors.forEach((el) => el.remove());

  if (!state || Object.keys(state.elements).length === 0) return;

  for (const [selector, interaction] of Object.entries(state.elements)) {
    let target: Element | null = null;
    try {
      target = container.querySelector(selector);
    } catch {
      // Invalid selector — skip
      continue;
    }
    if (!target) continue;
    const htmlEl = target as HTMLElement;

    // Save original style so we can restore it next frame
    if (!htmlEl.hasAttribute(INTERACTION_ATTR)) {
      htmlEl.setAttribute(INTERACTION_ATTR, htmlEl.style.cssText);
    }

    // Apply style overrides
    for (const [prop, val] of Object.entries(interaction.styles)) {
      htmlEl.style.setProperty(
        prop.replace(/([A-Z])/g, '-$1').toLowerCase(),
        val,
        'important',
      );
    }

    // Apply value for inputs/textareas/selects
    if (interaction.value != null) {
      // Special handling for checkboxes
      if (htmlEl instanceof HTMLInputElement && htmlEl.type === 'checkbox') {
        htmlEl.checked = interaction.value === 'checked';
        htmlEl.setAttribute('checked', '');
      } else if (htmlEl instanceof HTMLInputElement || htmlEl instanceof HTMLTextAreaElement) {
        htmlEl.value = interaction.value;
        htmlEl.setAttribute('value', interaction.value);

        // Add a visual blinking cursor indicator for typing
        if (interaction.showTypingCursor) {
          const blinkVisible = frame !== undefined ? ((frame % 30) < 20) : true;
          if (blinkVisible) {
            // Create a cursor indicator element positioned at the end of the text
            const cursorIndicator = document.createElement('span');
            cursorIndicator.setAttribute(`data-${TYPING_CURSOR_ID}`, 'true');
            cursorIndicator.style.cssText = `
              position: absolute;
              display: inline-block;
              width: 2px;
              height: 1.2em;
              background-color: rgba(59, 130, 246, 1);
              animation: none;
              pointer-events: none;
              z-index: 9999;
              box-shadow: 0 0 4px rgba(59, 130, 246, 0.6);
            `;

            // Position the cursor inside the input by making the input's parent relative
            const parent = htmlEl.parentElement;
            if (parent) {
              const parentPosition = window.getComputedStyle(parent).position;
              if (parentPosition === 'static') {
                parent.style.position = 'relative';
              }

              // Calculate cursor position based on text length (approximate)
              const inputRect = htmlEl.getBoundingClientRect();
              const parentRect = parent.getBoundingClientRect();

              // Estimate character width (approximate)
              const fontSize = parseFloat(window.getComputedStyle(htmlEl).fontSize) || 14;
              const charWidth = fontSize * 0.55; // Approximate character width
              const textWidth = (interaction.value?.length || 0) * charWidth;
              const padding = parseFloat(window.getComputedStyle(htmlEl).paddingLeft) || 8;

              cursorIndicator.style.left = `${inputRect.left - parentRect.left + padding + textWidth + 2}px`;
              cursorIndicator.style.top = `${inputRect.top - parentRect.top + (inputRect.height - fontSize * 1.2) / 2}px`;
              cursorIndicator.style.height = `${fontSize * 1.2}px`;

              parent.appendChild(cursorIndicator);
            }
          }
        }
      } else if (htmlEl instanceof HTMLSelectElement) {
        htmlEl.value = interaction.value;
        // Also try to select the matching option
        const option = htmlEl.querySelector(`option[value="${interaction.value}"]`) as HTMLOptionElement | null;
        if (option) option.selected = true;
      } else {
        // Fallback: set value attribute
        htmlEl.setAttribute('value', interaction.value);
      }
    }
  }
}

// =============================================
// Component
// =============================================

export function ComponentItemRenderer({
  item,
  previewHtml,
  interactionState,
}: ComponentItemRendererProps) {
  const animStyle = useItemAnimation(item.enterAnimation, item.exitAnimation, item.durationInFrames);
  const kf = useKeyframeAnimation(item.keyframes);
  const { width: compWidth, height: compHeight } = useVideoConfig();
  const frame = useCurrentFrame();
  const displaySize = item.displaySize ?? 'laptop';
  const isSelected = useCompositionStore((s) => s.selectedItemId) === item.id;
  const kfOpacity = kf.opacity ?? 1;
  const kfScale = kf.scale ?? 1;
  const kfRotation = kf.rotation ?? 0;
  const posX = kf.positionX ?? item.position?.x;
  const posY = kf.positionY ?? item.position?.y;
  const hasPosition = posX != null || posY != null;

  // Build advanced styles from keyframes
  const filterStyle = buildFilterStyle(kf);
  const skewTransform = buildSkewTransform(kf);
  const shadowStyle = buildShadowStyle(kf);

  const containerRef = useRef<HTMLDivElement>(null);

  // Apply interactions to real DOM every frame BEFORE paint (prevents flicker)
  useLayoutEffect(() => {
    applyInteractionsToDOM(containerRef.current, interactionState, frame);
  });

  if (!previewHtml) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#0001',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: '#888', fontSize: 14 }}>No preview available</div>
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
            filter: filterStyle !== 'none' ? filterStyle : undefined,
            boxShadow: shadowStyle,
          }}
        >
          <div
            ref={containerRef}
            data-component-preview={item.componentId}
            style={{
              width: '100%',
              maxWidth: '100%',
              overflow: 'hidden',
            }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </AbsoluteFill>
    );
  }

  const frameW = hasCustomSize ? (item.containerWidth ?? preset?.width ?? 1280) : preset!.width;
  const frameH = hasCustomSize ? (item.containerHeight ?? preset?.height ?? 800) : preset!.height;
  const isPhoneRatio = frameH > frameW * 1.5;
  const { h, v } = parseAlignment(item.objectPosition ?? 'center center');

  const padding = 60;
  const availW = compWidth - padding * 2;
  const availH = compHeight - padding * 2;
  const zoomLevel = Math.min(availW / frameW, availH / frameH);

  // Combine animation transform (enter/exit) with keyframe scale
  const transforms = [animStyle.transform, kfScale !== 1 ? `scale(${kfScale})` : '']
    .filter(t => t && t !== 'none')
    .join(' ') || 'none';

  // Position helper for translate centering
  const getTranslatePercent = (v: number) =>
    v <= 0.25 ? '0%' : v >= 0.75 ? '-100%' : '-50%';

  return (
    <AbsoluteFill
      style={hasPosition ? {} : {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Outer animation wrapper — handles opacity, enter/exit/keyframe transforms */}
      <div
        style={{
          opacity: animStyle.opacity * kfOpacity,
          transform: transforms,
          filter: filterStyle !== 'none' ? filterStyle : undefined,
          ...(hasPosition ? {
            position: 'absolute' as const,
            left: `${(posX ?? 0.5) * 100}%`,
            top: `${(posY ?? 0.5) * 100}%`,
            transform: [
              `translate(${getTranslatePercent(posX ?? 0.5)}, ${getTranslatePercent(posY ?? 0.5)})`,
              kfScale !== 1 ? `scale(${kfScale})` : '',
              kfRotation !== 0 ? `rotate(${kfRotation}deg)` : '',
              skewTransform,
              animStyle.transform !== 'none' ? animStyle.transform : '',
            ].filter(Boolean).join(' ') || 'none',
          } : {}),
        }}
      >
        {/* Device frame — uses CSS zoom for crisp rendering (no bitmap scaling) */}
        <div
          style={{
            width: frameW,
            height: frameH,
            borderRadius: isPhoneRatio ? 40 : 12,
            overflow: 'hidden',
            boxShadow: shadowStyle ?? (isSelected
              ? '0 0 0 3px rgba(59,130,246,0.7), 0 4px 16px rgba(0,0,0,0.12)'
              : '0 4px 16px rgba(0,0,0,0.12)'),
            backgroundColor: '#fff',
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
              data-component-preview={item.componentId}
              style={{
                width: '100%',
                maxWidth: '100%',
                height: 'auto',
                overflow: 'hidden',
                // Make content scale down if larger than container
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
              }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
