'use client';

/**
 * Text properties panel for editing text item content, styling, position, and animation.
 */

import { useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { FontPicker } from './font-picker';
import { Sparkles, Palette, Sun, GlassWater, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompositionStore } from '@/lib/composition/store';
import type { TextItem, TimelineItem, AnimationType, SlideDirection, PropertyKeyframe, LetterAnimationType, LetterAnimation, TextGradient, GlowEffect, GlassEffect, GradientColorStop, TextAnimationMode } from '@/lib/composition/types';

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

const LETTER_ANIMATION_TYPES: { value: LetterAnimationType; label: string }[] = [
  { value: 'fade', label: 'Fade' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'scale', label: 'Scale Up' },
  { value: 'scale-down', label: 'Scale Down' },
  { value: 'blur', label: 'Blur' },
  { value: 'rotate', label: 'Rotate' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'typewriter', label: 'Typewriter' },
];

const LETTER_DIRECTIONS: { value: NonNullable<LetterAnimation['direction']>; label: string }[] = [
  { value: 'forward', label: 'Forward' },
  { value: 'backward', label: 'Backward' },
  { value: 'center', label: 'Center Out' },
  { value: 'random', label: 'Random' },
];

const LETTER_EASINGS: { value: NonNullable<LetterAnimation['easing']>; label: string }[] = [
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
  { value: 'linear', label: 'Linear' },
  { value: 'spring', label: 'Spring' },
];

const ANIMATION_MODES: { value: TextAnimationMode; label: string; description: string }[] = [
  { value: 'letter', label: 'Per Letter', description: 'Animate each character individually' },
  { value: 'word', label: 'Per Word', description: 'Animate each word as a unit' },
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
            defaultValue={item.fontSize}
            key={`fontSize-${item.id}-${item.fontSize}`}
            onBlur={(e) => onUpdate({ fontSize: Number(e.target.value) } as Partial<TextItem>)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onUpdate({ fontSize: Number(e.currentTarget.value) } as Partial<TextItem>);
                e.currentTarget.blur();
              }
            }}
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
            defaultValue={item.padding ?? 0}
            key={`padding-${item.id}-${item.padding}`}
            onBlur={(e) => onUpdate({ padding: Number(e.target.value) } as Partial<TextItem>)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onUpdate({ padding: Number(e.currentTarget.value) } as Partial<TextItem>);
                e.currentTarget.blur();
              }
            }}
          />
        </div>

        {/* Max Width */}
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Max Width</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              className="w-20 h-7 text-xs"
              min={50}
              max={2000}
              step={10}
              placeholder="auto"
              defaultValue={item.maxWidth ?? ''}
              key={`maxWidth-${item.id}-${item.maxWidth}`}
              onBlur={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                onUpdate({ maxWidth: val } as Partial<TextItem>);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = e.currentTarget.value ? Number(e.currentTarget.value) : undefined;
                  onUpdate({ maxWidth: val } as Partial<TextItem>);
                  e.currentTarget.blur();
                }
              }}
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>
        </div>

        {/* No Wrap */}
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">No Wrap</Label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={item.noWrap ?? false}
              onChange={(e) => onUpdate({ noWrap: e.target.checked } as Partial<TextItem>)}
            />
            Keep on one line
          </label>
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
            defaultValue={effectivePosX}
            key={`posX-${item.id}-${effectivePosX}`}
            onBlur={(e) => handlePositionChange('x', Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handlePositionChange('x', Number(e.currentTarget.value));
                e.currentTarget.blur();
              }
            }}
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
            defaultValue={effectivePosY}
            key={`posY-${item.id}-${effectivePosY}`}
            onBlur={(e) => handlePositionChange('y', Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handlePositionChange('y', Number(e.currentTarget.value));
                e.currentTarget.blur();
              }
            }}
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
              defaultValue={animDuration}
              key={`animDuration-${item.id}-${animDuration}`}
              onBlur={(e) =>
                onUpdate({
                  enterAnimation: {
                    type: animType,
                    direction: animType === 'slide' ? animDirection : undefined,
                    durationInFrames: Number(e.target.value),
                  },
                } as Partial<TextItem>)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onUpdate({
                    enterAnimation: {
                      type: animType,
                      direction: animType === 'slide' ? animDirection : undefined,
                      durationInFrames: Number(e.currentTarget.value),
                    },
                  } as Partial<TextItem>);
                  e.currentTarget.blur();
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Letter Animation Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Letter Animation</h3>
          </div>
          <Checkbox
            checked={item.letterAnimation?.enabled ?? false}
            onCheckedChange={(checked) => {
              const enabled = checked === true;
              onUpdate({
                letterAnimation: enabled
                  ? {
                      enabled: true,
                      type: item.letterAnimation?.type ?? 'fade',
                      staggerFrames: item.letterAnimation?.staggerFrames ?? 2,
                      durationPerLetter: item.letterAnimation?.durationPerLetter ?? 10,
                      direction: item.letterAnimation?.direction ?? 'forward',
                      easing: item.letterAnimation?.easing ?? 'ease-out',
                    }
                  : { ...item.letterAnimation, enabled: false },
              } as Partial<TextItem>);
            }}
          />
        </div>

        {item.letterAnimation?.enabled && (
          <>
            {/* Animation Mode (Letter vs Word) */}
            <div className="flex items-center gap-1">
              {ANIMATION_MODES.map((mode) => (
                <button
                  key={mode.value}
                  className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                    (item.letterAnimation?.mode ?? 'letter') === mode.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-input'
                  }`}
                  onClick={() =>
                    onUpdate({
                      letterAnimation: {
                        ...item.letterAnimation,
                        mode: mode.value,
                      },
                    } as Partial<TextItem>)
                  }
                  title={mode.description}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Animation Type */}
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Effect</Label>
              <select
                className="w-28 h-7 text-xs rounded-md border bg-background px-2"
                value={item.letterAnimation.type}
                onChange={(e) =>
                  onUpdate({
                    letterAnimation: {
                      ...item.letterAnimation,
                      type: e.target.value as LetterAnimationType,
                    },
                  } as Partial<TextItem>)
                }
              >
                {LETTER_ANIMATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Direction */}
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Direction</Label>
              <select
                className="w-28 h-7 text-xs rounded-md border bg-background px-2"
                value={item.letterAnimation.direction ?? 'forward'}
                onChange={(e) =>
                  onUpdate({
                    letterAnimation: {
                      ...item.letterAnimation,
                      direction: e.target.value as LetterAnimation['direction'],
                    },
                  } as Partial<TextItem>)
                }
              >
                {LETTER_DIRECTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Stagger Frames */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Stagger</Label>
                <span className="text-xs text-muted-foreground">
                  {item.letterAnimation.staggerFrames} frames
                </span>
              </div>
              <Slider
                value={[item.letterAnimation.staggerFrames]}
                min={1}
                max={10}
                step={1}
                onValueChange={([value]) =>
                  onUpdate({
                    letterAnimation: {
                      ...item.letterAnimation,
                      staggerFrames: value,
                    },
                  } as Partial<TextItem>)
                }
              />
            </div>

            {/* Duration Per Unit */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Duration</Label>
                <span className="text-xs text-muted-foreground">
                  {item.letterAnimation.durationPerLetter} frames/{item.letterAnimation.mode === 'word' ? 'word' : 'letter'}
                </span>
              </div>
              <Slider
                value={[item.letterAnimation.durationPerLetter]}
                min={5}
                max={30}
                step={1}
                onValueChange={([value]) =>
                  onUpdate({
                    letterAnimation: {
                      ...item.letterAnimation,
                      durationPerLetter: value,
                    },
                  } as Partial<TextItem>)
                }
              />
            </div>

            {/* Easing */}
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Easing</Label>
              <select
                className="w-28 h-7 text-xs rounded-md border bg-background px-2"
                value={item.letterAnimation.easing ?? 'ease-out'}
                onChange={(e) =>
                  onUpdate({
                    letterAnimation: {
                      ...item.letterAnimation,
                      easing: e.target.value as LetterAnimation['easing'],
                    },
                  } as Partial<TextItem>)
                }
              >
                {LETTER_EASINGS.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Gradient Text Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Gradient Fill</h3>
          </div>
          <Checkbox
            checked={item.gradient?.enabled ?? false}
            onCheckedChange={(checked) => {
              const enabled = checked === true;
              onUpdate({
                gradient: enabled
                  ? {
                      enabled: true,
                      colors: item.gradient?.colors ?? [
                        { color: '#6366f1', position: 0 },
                        { color: '#06b6d4', position: 100 },
                      ],
                      angle: item.gradient?.angle ?? 90,
                      animate: item.gradient?.animate ?? false,
                      speed: item.gradient?.speed ?? 1,
                    }
                  : { ...item.gradient, enabled: false },
              } as Partial<TextItem>);
            }}
          />
        </div>

        {item.gradient?.enabled && (
          <>
            {/* Gradient Preview */}
            <div
              className="h-6 rounded-md border"
              style={{
                background: `linear-gradient(${item.gradient.angle ?? 90}deg, ${(item.gradient.colors ?? []).map(c => `${c.color} ${c.position}%`).join(', ')})`,
              }}
            />

            {/* Color Stops */}
            <div className="space-y-2">
              {(item.gradient.colors ?? []).map((stop, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-7 h-6 rounded border cursor-pointer flex-shrink-0"
                    value={stop.color}
                    onChange={(e) => {
                      const newColors = [...(item.gradient?.colors ?? [])];
                      newColors[index] = { ...newColors[index], color: e.target.value };
                      onUpdate({
                        gradient: { ...item.gradient, colors: newColors },
                      } as Partial<TextItem>);
                    }}
                  />
                  <Slider
                    className="flex-1"
                    value={[stop.position]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([v]) => {
                      const newColors = [...(item.gradient?.colors ?? [])];
                      newColors[index] = { ...newColors[index], position: v };
                      newColors.sort((a, b) => a.position - b.position);
                      onUpdate({
                        gradient: { ...item.gradient, colors: newColors },
                      } as Partial<TextItem>);
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground w-6">{stop.position}%</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      if ((item.gradient?.colors?.length ?? 0) <= 2) return;
                      const newColors = (item.gradient?.colors ?? []).filter((_, i) => i !== index);
                      onUpdate({
                        gradient: { ...item.gradient, colors: newColors },
                      } as Partial<TextItem>);
                    }}
                    disabled={(item.gradient?.colors?.length ?? 0) <= 2}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs w-full"
                onClick={() => {
                  const colors = item.gradient?.colors ?? [];
                  const newColors = [...colors, { color: '#ffffff', position: 50 }];
                  newColors.sort((a, b) => a.position - b.position);
                  onUpdate({
                    gradient: { ...item.gradient, colors: newColors },
                  } as Partial<TextItem>);
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Color
              </Button>
            </div>

            {/* Angle */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Angle</Label>
                <span className="text-xs text-muted-foreground">{item.gradient.angle ?? 90}°</span>
              </div>
              <Slider
                value={[item.gradient.angle ?? 90]}
                min={0}
                max={360}
                step={1}
                onValueChange={([value]) =>
                  onUpdate({
                    gradient: { ...item.gradient, angle: value },
                  } as Partial<TextItem>)
                }
              />
            </div>

            {/* Animate */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="gradient-animate"
                checked={item.gradient.animate ?? false}
                onCheckedChange={(checked) =>
                  onUpdate({
                    gradient: { ...item.gradient, animate: checked === true },
                  } as Partial<TextItem>)
                }
              />
              <Label htmlFor="gradient-animate" className="text-xs">Animate Rotation</Label>
            </div>

            {item.gradient.animate && (
              <div className="space-y-1 pl-6">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Speed</Label>
                  <span className="text-xs text-muted-foreground">{(item.gradient.speed ?? 1).toFixed(1)}x</span>
                </div>
                <Slider
                  value={[item.gradient.speed ?? 1]}
                  min={0.1}
                  max={5}
                  step={0.1}
                  onValueChange={([value]) =>
                    onUpdate({
                      gradient: { ...item.gradient, speed: value },
                    } as Partial<TextItem>)
                  }
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Glow Effect Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Glow Effect</h3>
          </div>
          <Checkbox
            checked={item.glow?.enabled ?? false}
            onCheckedChange={(checked) => {
              const enabled = checked === true;
              onUpdate({
                glow: enabled
                  ? {
                      enabled: true,
                      color: item.glow?.color ?? '#ffffff',
                      intensity: item.glow?.intensity ?? 0.5,
                      size: item.glow?.size ?? 20,
                      animate: item.glow?.animate ?? false,
                      pulseSpeed: item.glow?.pulseSpeed ?? 1,
                    }
                  : { ...item.glow, enabled: false },
              } as Partial<TextItem>);
            }}
          />
        </div>

        {item.glow?.enabled && (
          <>
            {/* Glow Color */}
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-7 rounded border cursor-pointer"
                  value={item.glow.color ?? '#ffffff'}
                  onChange={(e) =>
                    onUpdate({
                      glow: { ...item.glow, color: e.target.value },
                    } as Partial<TextItem>)
                  }
                />
                <Input
                  type="text"
                  className="w-20 h-7 text-xs"
                  value={item.glow.color ?? '#ffffff'}
                  onChange={(e) =>
                    onUpdate({
                      glow: { ...item.glow, color: e.target.value },
                    } as Partial<TextItem>)
                  }
                />
              </div>
            </div>

            {/* Intensity */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Intensity</Label>
                <span className="text-xs text-muted-foreground">{Math.round((item.glow.intensity ?? 0.5) * 100)}%</span>
              </div>
              <Slider
                value={[(item.glow.intensity ?? 0.5) * 100]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  onUpdate({
                    glow: { ...item.glow, intensity: value / 100 },
                  } as Partial<TextItem>)
                }
              />
            </div>

            {/* Size */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Size</Label>
                <span className="text-xs text-muted-foreground">{item.glow.size ?? 20}px</span>
              </div>
              <Slider
                value={[item.glow.size ?? 20]}
                min={5}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  onUpdate({
                    glow: { ...item.glow, size: value },
                  } as Partial<TextItem>)
                }
              />
            </div>

            {/* Animate Pulse */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="glow-animate"
                checked={item.glow.animate ?? false}
                onCheckedChange={(checked) =>
                  onUpdate({
                    glow: { ...item.glow, animate: checked === true },
                  } as Partial<TextItem>)
                }
              />
              <Label htmlFor="glow-animate" className="text-xs">Pulse Animation</Label>
            </div>

            {item.glow.animate && (
              <div className="space-y-1 pl-6">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Pulse Speed</Label>
                  <span className="text-xs text-muted-foreground">{(item.glow.pulseSpeed ?? 1).toFixed(1)}x</span>
                </div>
                <Slider
                  value={[item.glow.pulseSpeed ?? 1]}
                  min={0.1}
                  max={3}
                  step={0.1}
                  onValueChange={([value]) =>
                    onUpdate({
                      glow: { ...item.glow, pulseSpeed: value },
                    } as Partial<TextItem>)
                  }
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Glass Effect Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GlassWater className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Glass Effect</h3>
          </div>
          <Checkbox
            checked={item.glass?.enabled ?? false}
            onCheckedChange={(checked) => {
              const enabled = checked === true;
              onUpdate({
                glass: enabled
                  ? {
                      enabled: true,
                      blur: item.glass?.blur ?? 10,
                      opacity: item.glass?.opacity ?? 0.2,
                      tint: item.glass?.tint ?? 'rgba(255,255,255,0.1)',
                      saturation: item.glass?.saturation ?? 1.2,
                    }
                  : { ...item.glass, enabled: false },
              } as Partial<TextItem>);
            }}
          />
        </div>

        {item.glass?.enabled && (
          <>
            {/* Blur Amount */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Blur</Label>
                <span className="text-xs text-muted-foreground">{item.glass.blur ?? 10}px</span>
              </div>
              <Slider
                value={[item.glass.blur ?? 10]}
                min={2}
                max={30}
                step={1}
                onValueChange={([value]) =>
                  onUpdate({
                    glass: { ...item.glass, blur: value },
                  } as Partial<TextItem>)
                }
              />
            </div>

            {/* Opacity */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Background Opacity</Label>
                <span className="text-xs text-muted-foreground">{Math.round((item.glass.opacity ?? 0.2) * 100)}%</span>
              </div>
              <Slider
                value={[(item.glass.opacity ?? 0.2) * 100]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  onUpdate({
                    glass: { ...item.glass, opacity: value / 100 },
                  } as Partial<TextItem>)
                }
              />
            </div>

            {/* Tint Color */}
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Tint Color</Label>
              <input
                type="color"
                className="w-8 h-7 rounded border cursor-pointer"
                value={item.glass.tint?.replace(/rgba?\([^)]+\)/, '#ffffff') ?? '#ffffff'}
                onChange={(e) => {
                  const hex = e.target.value;
                  const opacity = item.glass?.opacity ?? 0.2;
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  onUpdate({
                    glass: { ...item.glass, tint: `rgba(${r},${g},${b},${opacity})` },
                  } as Partial<TextItem>);
                }}
              />
            </div>

            {/* Saturation */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Saturation</Label>
                <span className="text-xs text-muted-foreground">{(item.glass.saturation ?? 1.2).toFixed(1)}x</span>
              </div>
              <Slider
                value={[(item.glass.saturation ?? 1.2) * 10]}
                min={0}
                max={30}
                step={1}
                onValueChange={([value]) =>
                  onUpdate({
                    glass: { ...item.glass, saturation: value / 10 },
                  } as Partial<TextItem>)
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
