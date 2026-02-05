'use client';

/**
 * Text properties panel for editing text item content, styling, position, and animation.
 */

import { useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FontPicker } from './font-picker';
import { useCompositionStore } from '@/lib/composition/store';
import type { TextItem, TimelineItem, AnimationType, SlideDirection, PropertyKeyframe } from '@/lib/composition/types';

// =============================================
// Types
// =============================================

interface TextPropertiesProps {
  item: TextItem;
  onUpdate: (updates: Partial<TimelineItem>) => void;
}

// =============================================
// Constants
// =============================================

const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const ANIMATION_TYPES: { value: AnimationType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide' },
  { value: 'scale', label: 'Scale' },
];
const SLIDE_DIRECTIONS: { value: SlideDirection; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];

// =============================================
// Component
// =============================================

export function TextProperties({ item, onUpdate }: TextPropertiesProps) {
  const animType = item.enterAnimation?.type ?? 'none';
  const animDirection = item.enterAnimation?.direction ?? 'left';
  const animDuration = item.enterAnimation?.durationInFrames ?? 15;
  const hasBg = (item.backgroundColor ?? 'transparent') !== 'transparent';

  // Get current frame from store to know where we are in the timeline
  const currentFrame = useCompositionStore((s) => s.currentFrame);
  // Calculate relative frame within this item (0 = start of item)
  const relativeFrame = Math.max(0, Math.min(currentFrame - item.from, item.durationInFrames));

  // Get effective position at current frame - interpolate if between keyframes
  const { effectivePosX, effectivePosY, hasPositionKeyframes } = useMemo(() => {
    const keyframes = item.keyframes ?? [];

    // Find keyframes with positionX/positionY
    const xKeyframes = keyframes.filter(kf => 'positionX' in kf.values).sort((a, b) => a.frame - b.frame);
    const yKeyframes = keyframes.filter(kf => 'positionY' in kf.values).sort((a, b) => a.frame - b.frame);

    // Get interpolated value at current frame
    const getValueAtFrame = (kfs: PropertyKeyframe[], prop: string, defaultVal: number): number => {
      if (kfs.length === 0) return defaultVal;
      if (kfs.length === 1) return kfs[0].values[prop];

      // Find surrounding keyframes
      let prev = kfs[0];
      let next = kfs[kfs.length - 1];

      for (let i = 0; i < kfs.length - 1; i++) {
        if (relativeFrame >= kfs[i].frame && relativeFrame <= kfs[i + 1].frame) {
          prev = kfs[i];
          next = kfs[i + 1];
          break;
        }
      }

      // Before first keyframe
      if (relativeFrame <= prev.frame) return prev.values[prop];
      // After last keyframe
      if (relativeFrame >= next.frame) return next.values[prop];

      // Interpolate
      const progress = (relativeFrame - prev.frame) / (next.frame - prev.frame);
      return prev.values[prop] + (next.values[prop] - prev.values[prop]) * progress;
    };

    return {
      effectivePosX: xKeyframes.length > 0
        ? getValueAtFrame(xKeyframes, 'positionX', item.position?.x ?? 0.5)
        : item.position?.x ?? 0.5,
      effectivePosY: yKeyframes.length > 0
        ? getValueAtFrame(yKeyframes, 'positionY', item.position?.y ?? 0.5)
        : item.position?.y ?? 0.5,
      hasPositionKeyframes: xKeyframes.length > 0 || yKeyframes.length > 0,
    };
  }, [item.keyframes, item.position, relativeFrame]);

  // Update position - create/update keyframe at current frame
  const handlePositionChange = useCallback((axis: 'x' | 'y', newValue: number) => {
    const keyframes = item.keyframes ?? [];
    const prop = axis === 'x' ? 'positionX' : 'positionY';

    // Check if there are any keyframes for this axis
    const hasAxisKeyframes = keyframes.some(kf => prop in kf.values);

    if (hasAxisKeyframes) {
      // Find if there's a keyframe at the current relative frame (within 1 frame tolerance)
      const existingIdx = keyframes.findIndex(
        kf => prop in kf.values && Math.abs(kf.frame - relativeFrame) <= 1
      );

      let updatedKeyframes: PropertyKeyframe[];

      if (existingIdx >= 0) {
        // Update existing keyframe at this frame
        updatedKeyframes = keyframes.map((kf, idx) => {
          if (idx === existingIdx) {
            return {
              ...kf,
              values: {
                ...kf.values,
                [prop]: newValue,
              },
            };
          }
          return kf;
        });
      } else {
        // Add new keyframe at current frame
        const newKeyframe: PropertyKeyframe = {
          frame: relativeFrame,
          values: { [prop]: newValue },
          easing: 'ease-out',
        };
        updatedKeyframes = [...keyframes, newKeyframe].sort((a, b) => a.frame - b.frame);
      }

      // Update keyframes and base position
      const newPos = {
        x: axis === 'x' ? newValue : (item.position?.x ?? 0.5),
        y: axis === 'y' ? newValue : (item.position?.y ?? 0.5),
      };
      onUpdate({ keyframes: updatedKeyframes, position: newPos } as Partial<TextItem>);
    } else {
      // No keyframes, just update position normally
      const newPos = {
        x: axis === 'x' ? newValue : (item.position?.x ?? 0.5),
        y: axis === 'y' ? newValue : (item.position?.y ?? 0.5),
      };
      onUpdate({ position: newPos } as Partial<TextItem>);
    }
  }, [item.keyframes, item.position, item.from, relativeFrame, onUpdate]);

  return (
    <div className="space-y-6">
      {/* Content Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Content</h3>
        <div className="space-y-2">
          <Label className="text-xs">Text</Label>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-y min-h-[60px]"
            value={item.text}
            onChange={(e) => onUpdate({ text: e.target.value } as Partial<TextItem>)}
          />
        </div>
      </div>

      {/* Styling Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Styling</h3>

        {/* Font Family */}
        <FontPicker
          value={item.fontFamily}
          onChange={(f) => onUpdate({ fontFamily: f } as Partial<TextItem>)}
        />

        {/* Font Size */}
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Font Size</Label>
          <Input
            type="number"
            className="w-20 h-7 text-xs"
            min={8}
            max={200}
            step={1}
            value={item.fontSize}
            onChange={(e) => onUpdate({ fontSize: Number(e.target.value) } as Partial<TextItem>)}
          />
        </div>

        {/* Font Weight */}
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Font Weight</Label>
          <select
            className="w-20 h-7 text-xs rounded-md border bg-background px-2"
            value={item.fontWeight ?? 400}
            onChange={(e) => onUpdate({ fontWeight: Number(e.target.value) } as Partial<TextItem>)}
          >
            {FONT_WEIGHTS.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>

        {/* Color */}
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Color</Label>
          <input
            type="color"
            className="w-8 h-7 rounded border cursor-pointer"
            value={item.color}
            onChange={(e) => onUpdate({ color: e.target.value } as Partial<TextItem>)}
          />
        </div>

        {/* Text Align */}
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Align</Label>
          <div className="flex gap-1">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                className={`px-2 py-1 text-xs rounded border ${
                  (item.textAlign ?? 'left') === align
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                }`}
                onClick={() => onUpdate({ textAlign: align } as Partial<TextItem>)}
              >
                {align.charAt(0).toUpperCase() + align.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Background Color */}
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Background</Label>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={hasBg}
                onChange={(e) =>
                  onUpdate({
                    backgroundColor: e.target.checked ? '#000000' : 'transparent',
                  } as Partial<TextItem>)
                }
              />
              On
            </label>
            {hasBg && (
              <input
                type="color"
                className="w-8 h-7 rounded border cursor-pointer"
                value={item.backgroundColor ?? '#000000'}
                onChange={(e) => onUpdate({ backgroundColor: e.target.value } as Partial<TextItem>)}
              />
            )}
          </div>
        </div>

        {/* Padding */}
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Padding</Label>
          <Input
            type="number"
            className="w-20 h-7 text-xs"
            min={0}
            max={100}
            step={4}
            value={item.padding ?? 0}
            onChange={(e) => onUpdate({ padding: Number(e.target.value) } as Partial<TextItem>)}
          />
        </div>
      </div>

      {/* Position Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">
          Position
          {hasPositionKeyframes && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">(keyframed)</span>
          )}
        </h3>

        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">X</Label>
          <Input
            type="number"
            className="w-20 h-7 text-xs"
            min={0}
            max={1}
            step={0.01}
            value={effectivePosX}
            onChange={(e) => handlePositionChange('x', Number(e.target.value))}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Y</Label>
          <Input
            type="number"
            className="w-20 h-7 text-xs"
            min={0}
            max={1}
            step={0.01}
            value={effectivePosY}
            onChange={(e) => handlePositionChange('y', Number(e.target.value))}
          />
        </div>
      </div>

      {/* Animation Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Animation</h3>

        {/* Animation Type */}
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Enter</Label>
          <select
            className="w-24 h-7 text-xs rounded-md border bg-background px-2"
            value={animType}
            onChange={(e) => {
              const type = e.target.value as AnimationType;
              onUpdate({
                enterAnimation: type === 'none'
                  ? { type: 'none' }
                  : { type, direction: animDirection, durationInFrames: animDuration },
              } as Partial<TextItem>);
            }}
          >
            {ANIMATION_TYPES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {/* Direction - only for slide */}
        {animType === 'slide' && (
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Direction</Label>
            <select
              className="w-24 h-7 text-xs rounded-md border bg-background px-2"
              value={animDirection}
              onChange={(e) =>
                onUpdate({
                  enterAnimation: {
                    type: 'slide',
                    direction: e.target.value as SlideDirection,
                    durationInFrames: animDuration,
                  },
                } as Partial<TextItem>)
              }
            >
              {SLIDE_DIRECTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Duration - when animation is not none */}
        {animType !== 'none' && (
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Duration (frames)</Label>
            <Input
              type="number"
              className="w-20 h-7 text-xs"
              min={5}
              max={60}
              value={animDuration}
              onChange={(e) =>
                onUpdate({
                  enterAnimation: {
                    type: animType,
                    direction: animType === 'slide' ? animDirection : undefined,
                    durationInFrames: Number(e.target.value),
                  },
                } as Partial<TextItem>)
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
