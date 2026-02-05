'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { PropertyKeyframe, EasingType, TimelineItem } from '@/lib/composition/types';

// =============================================
// Types
// =============================================

interface AnimationControlsProps {
  keyframes?: PropertyKeyframe[];
  durationInFrames: number;
  onUpdate: (updates: Partial<TimelineItem>) => void;
}

const ANIMATABLE_PROPERTIES = [
  // Transform properties
  { value: 'positionX', label: 'Position X', min: 0, max: 1, step: 0.01, category: 'transform' },
  { value: 'positionY', label: 'Position Y', min: 0, max: 1, step: 0.01, category: 'transform' },
  { value: 'scale', label: 'Scale', min: 0.1, max: 3, step: 0.05, category: 'transform' },
  { value: 'rotation', label: 'Rotation', min: -360, max: 360, step: 1, category: 'transform' },
  { value: 'skewX', label: 'Skew X', min: -45, max: 45, step: 1, category: 'transform' },
  { value: 'skewY', label: 'Skew Y', min: -45, max: 45, step: 1, category: 'transform' },

  // Size properties
  { value: 'width', label: 'Width', min: 0.05, max: 2, step: 0.01, category: 'size' },
  { value: 'height', label: 'Height', min: 0.05, max: 2, step: 0.01, category: 'size' },

  // Opacity & visibility
  { value: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.05, category: 'appearance' },

  // Filter effects
  { value: 'blur', label: 'Blur', min: 0, max: 50, step: 1, category: 'filter' },
  { value: 'brightness', label: 'Brightness', min: 0, max: 3, step: 0.1, category: 'filter' },
  { value: 'contrast', label: 'Contrast', min: 0, max: 3, step: 0.1, category: 'filter' },
  { value: 'saturate', label: 'Saturation', min: 0, max: 3, step: 0.1, category: 'filter' },
  { value: 'hueRotate', label: 'Hue Rotate', min: 0, max: 360, step: 5, category: 'filter' },

  // Shadow effects
  { value: 'shadowBlur', label: 'Shadow Blur', min: 0, max: 100, step: 1, category: 'shadow' },
  { value: 'shadowOffsetX', label: 'Shadow X', min: -100, max: 100, step: 1, category: 'shadow' },
  { value: 'shadowOffsetY', label: 'Shadow Y', min: -100, max: 100, step: 1, category: 'shadow' },
  { value: 'shadowOpacity', label: 'Shadow Opacity', min: 0, max: 1, step: 0.05, category: 'shadow' },

  // Text-specific
  { value: 'letterSpacing', label: 'Letter Spacing', min: -10, max: 50, step: 1, category: 'text' },
  { value: 'wordSpacing', label: 'Word Spacing', min: -20, max: 100, step: 1, category: 'text' },

  // SVG/Shape specific
  { value: 'progress', label: 'Progress', min: 0, max: 1, step: 0.01, category: 'svg' },
  { value: 'strokeWidth', label: 'Stroke Width', min: 0, max: 20, step: 0.5, category: 'stroke' },
  { value: 'borderRadius', label: 'Border Radius', min: 0, max: 100, step: 1, category: 'shape' },
] as const;

const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
  { value: 'spring', label: 'Spring' },
];

// =============================================
// Component
// =============================================

export function AnimationControls({
  keyframes = [],
  durationInFrames,
  onUpdate,
}: AnimationControlsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [addProp, setAddProp] = useState<string>('opacity');

  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);

  const updateKeyframes = (newKeyframes: PropertyKeyframe[]) => {
    onUpdate({ keyframes: newKeyframes } as Partial<TimelineItem>);
  };

  const addKeyframe = () => {
    // Default: add at frame 0 if empty, or at end
    const frame = sorted.length === 0 ? 0 : Math.min(sorted[sorted.length - 1].frame + 15, durationInFrames - 1);
    const newKf: PropertyKeyframe = {
      frame,
      values: { opacity: 1 },
      easing: 'ease-out',
    };
    const updated = [...sorted, newKf].sort((a, b) => a.frame - b.frame);
    updateKeyframes(updated);
    setExpandedIndex(updated.findIndex((k) => k === newKf));
  };

  const removeKeyframe = (index: number) => {
    const updated = sorted.filter((_, i) => i !== index);
    updateKeyframes(updated);
    if (expandedIndex === index) setExpandedIndex(null);
    else if (expandedIndex !== null && expandedIndex > index) setExpandedIndex(expandedIndex - 1);
  };

  const updateKeyframe = (index: number, patch: Partial<PropertyKeyframe>) => {
    const updated = sorted.map((kf, i) => (i === index ? { ...kf, ...patch } : kf));
    if (patch.frame !== undefined) updated.sort((a, b) => a.frame - b.frame);
    updateKeyframes(updated);
  };

  const updateValue = (index: number, prop: string, val: number) => {
    const kf = sorted[index];
    updateKeyframe(index, { values: { ...kf.values, [prop]: val } });
  };

  const removeValue = (index: number, prop: string) => {
    const kf = sorted[index];
    const newValues = { ...kf.values };
    delete newValues[prop];
    if (Object.keys(newValues).length === 0) {
      removeKeyframe(index);
    } else {
      updateKeyframe(index, { values: newValues });
    }
  };

  const addPropertyToKeyframe = (index: number) => {
    const kf = sorted[index];
    if (addProp in kf.values) return;
    const propDef = ANIMATABLE_PROPERTIES.find((p) => p.value === addProp);
    // Smart defaults based on property type
    const getDefaultValue = (prop: string): number => {
      switch (prop) {
        // Position defaults to center
        case 'positionX':
        case 'positionY':
          return 0.5;
        // Scale/opacity default to 1 (no change)
        case 'scale':
        case 'opacity':
        case 'brightness':
        case 'contrast':
        case 'saturate':
          return 1;
        // Shadow opacity default
        case 'shadowOpacity':
          return 0.5;
        // Shadow blur default
        case 'shadowBlur':
          return 10;
        // Shadow offset Y default (slight drop shadow)
        case 'shadowOffsetY':
          return 4;
        // All others default to 0
        default:
          return 0;
      }
    };
    updateKeyframe(index, { values: { ...kf.values, [addProp]: getDefaultValue(addProp) } });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Keyframes</h3>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={addKeyframe}>
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {sorted.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No keyframes. Add one to animate properties over time.
        </p>
      )}

      {sorted.map((kf, index) => {
        const isExpanded = expandedIndex === index;
        const propEntries = Object.entries(kf.values ?? {});

        return (
          <div key={index} className="border rounded-md overflow-hidden">
            {/* Header */}
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50"
              onClick={() => setExpandedIndex(isExpanded ? null : index)}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span className="font-medium">Frame {kf.frame}</span>
              <span className="text-muted-foreground ml-auto">
                {propEntries.map(([k]) => k).join(', ')}
              </span>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-3 border-t">
                {/* Frame & Easing */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Frame</Label>
                    <Input
                      type="number"
                      min={0}
                      max={durationInFrames - 1}
                      value={kf.frame}
                      onChange={(e) => updateKeyframe(index, { frame: Math.max(0, Math.min(durationInFrames - 1, parseInt(e.target.value) || 0)) })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Easing</Label>
                    <select
                      value={kf.easing ?? 'ease-out'}
                      onChange={(e) => updateKeyframe(index, { easing: e.target.value as EasingType })}
                      className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {EASING_OPTIONS.map((e) => (
                        <option key={e.value} value={e.value}>{e.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Property values */}
                {propEntries.map(([prop, val]) => {
                  const def = ANIMATABLE_PROPERTIES.find((p) => p.value === prop);
                  return (
                    <div key={prop} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-16 shrink-0">{def?.label ?? prop}</span>
                      <Input
                        type="number"
                        min={def?.min}
                        max={def?.max}
                        step={def?.step ?? 0.01}
                        value={val}
                        onChange={(e) => updateValue(index, prop, parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeValue(index, prop)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}

                {/* Add property */}
                <div className="flex items-center gap-1 pt-1">
                  <select
                    value={addProp}
                    onChange={(e) => setAddProp(e.target.value)}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs flex-1"
                  >
                    {ANIMATABLE_PROPERTIES.filter((p) => !(p.value in kf.values)).map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => addPropertyToKeyframe(index)}
                    disabled={ANIMATABLE_PROPERTIES.filter((p) => !(p.value in kf.values)).length === 0}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {/* Delete keyframe */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-destructive hover:text-destructive w-full"
                  onClick={() => removeKeyframe(index)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete Keyframe
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
