'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Plus, Trash2, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import type { PropertyKeyframe, EasingType, TimelineItem, SpringPreset, SpringConfig } from '@/lib/composition/types';
import { SPRING_PRESET_INFO, SPRING_PRESETS, DEFAULT_SPRING_CONFIG } from '@/lib/spring-presets';

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
                      defaultValue={kf.frame}
                      key={`frame-${kf.frame}-${index}`}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          updateKeyframe(index, { frame: Math.max(0, Math.min(durationInFrames - 1, val)) });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseInt(e.currentTarget.value);
                          if (!isNaN(val)) {
                            updateKeyframe(index, { frame: Math.max(0, Math.min(durationInFrames - 1, val)) });
                          }
                          e.currentTarget.blur();
                        }
                      }}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Easing</Label>
                    <select
                      value={kf.easing ?? 'ease-out'}
                      onChange={(e) => {
                        const easing = e.target.value as EasingType;
                        // Clear spring config when switching away from spring
                        if (easing !== 'spring') {
                          updateKeyframe(index, { easing, springPreset: undefined, springConfig: undefined });
                        } else {
                          // Default to 'smooth' preset when selecting spring
                          updateKeyframe(index, { easing, springPreset: 'smooth' });
                        }
                      }}
                      className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {EASING_OPTIONS.map((e) => (
                        <option key={e.value} value={e.value}>{e.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Spring Physics Controls (shown when easing is 'spring') */}
                {kf.easing === 'spring' && (
                  <SpringPhysicsControls
                    springPreset={kf.springPreset}
                    springConfig={kf.springConfig}
                    onChange={(preset, config) => updateKeyframe(index, { springPreset: preset, springConfig: config })}
                  />
                )}

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
                        defaultValue={val}
                        key={`${prop}-${val}-${index}`}
                        onBlur={(e) => {
                          const parsed = parseFloat(e.target.value);
                          if (!isNaN(parsed)) {
                            updateValue(index, prop, parsed);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const parsed = parseFloat(e.currentTarget.value);
                            if (!isNaN(parsed)) {
                              updateValue(index, prop, parsed);
                            }
                            e.currentTarget.blur();
                          }
                        }}
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
                {(() => {
                  const availableProps = ANIMATABLE_PROPERTIES.filter((p) => !(p.value in kf.values));
                  // Use first available prop if current selection is not available
                  const effectiveAddProp = availableProps.find((p) => p.value === addProp)
                    ? addProp
                    : availableProps[0]?.value ?? '';
                  return (
                    <div className="flex items-center gap-1 pt-1">
                      <select
                        value={effectiveAddProp}
                        onChange={(e) => setAddProp(e.target.value)}
                        className="h-7 rounded-md border border-input bg-background px-2 text-xs flex-1"
                      >
                        {availableProps.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => {
                          if (effectiveAddProp) {
                            const propDef = ANIMATABLE_PROPERTIES.find((p) => p.value === effectiveAddProp);
                            const getDefaultValue = (prop: string): number => {
                              switch (prop) {
                                case 'positionX':
                                case 'positionY':
                                  return 0.5;
                                case 'scale':
                                case 'opacity':
                                case 'brightness':
                                case 'contrast':
                                case 'saturate':
                                  return 1;
                                case 'shadowOpacity':
                                  return 0.5;
                                case 'shadowBlur':
                                  return 10;
                                case 'shadowOffsetY':
                                  return 4;
                                default:
                                  return 0;
                              }
                            };
                            updateKeyframe(index, { values: { ...kf.values, [effectiveAddProp]: getDefaultValue(effectiveAddProp) } });
                          }
                        }}
                        disabled={availableProps.length === 0}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })()}

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

// =============================================
// Spring Physics Controls
// =============================================

interface SpringPhysicsControlsProps {
  springPreset?: SpringPreset;
  springConfig?: SpringConfig;
  onChange: (preset?: SpringPreset, config?: SpringConfig) => void;
}

function SpringPhysicsControls({ springPreset, springConfig, onChange }: SpringPhysicsControlsProps) {
  const [showCustom, setShowCustom] = useState(!!springConfig);

  // Get current effective config (custom or from preset)
  const currentConfig = springConfig ?? (springPreset ? SPRING_PRESETS[springPreset] : DEFAULT_SPRING_CONFIG);

  const handlePresetChange = (preset: SpringPreset) => {
    if (showCustom) {
      // When in custom mode, update config to match preset
      onChange(undefined, SPRING_PRESETS[preset]);
    } else {
      onChange(preset, undefined);
    }
  };

  const handleCustomToggle = (checked: boolean) => {
    setShowCustom(checked);
    if (checked) {
      // Switch to custom mode with current preset values
      onChange(undefined, currentConfig);
    } else {
      // Switch back to preset mode
      onChange(springPreset ?? 'smooth', undefined);
    }
  };

  const handleConfigChange = (key: keyof SpringConfig, value: number) => {
    const newConfig = { ...currentConfig, [key]: value };
    onChange(undefined, newConfig);
  };

  return (
    <div className="space-y-2 pt-1 border-t border-dashed">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground font-medium">Spring Physics</Label>
        <div className="flex items-center gap-1">
          <Checkbox
            id="custom-spring"
            checked={showCustom}
            onCheckedChange={(checked) => handleCustomToggle(checked === true)}
            className="h-3 w-3"
          />
          <Label htmlFor="custom-spring" className="text-[10px] text-muted-foreground cursor-pointer">
            Custom
          </Label>
        </div>
      </div>

      {/* Preset selector */}
      {!showCustom && (
        <div className="grid grid-cols-3 gap-1">
          {SPRING_PRESET_INFO.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handlePresetChange(preset.name)}
              className={cn(
                "px-2 py-1.5 rounded text-[10px] text-center border transition-colors",
                springPreset === preset.name
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-input"
              )}
              title={preset.description}
            >
              <span className="mr-0.5">{preset.icon}</span>
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Custom spring parameters */}
      {showCustom && (
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Mass</Label>
              <span className="text-[10px] text-muted-foreground">{currentConfig.mass.toFixed(1)}</span>
            </div>
            <Slider
              value={[currentConfig.mass]}
              min={0.1}
              max={10}
              step={0.1}
              onValueChange={([v]) => handleConfigChange('mass', v)}
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Stiffness</Label>
              <span className="text-[10px] text-muted-foreground">{currentConfig.stiffness}</span>
            </div>
            <Slider
              value={[currentConfig.stiffness]}
              min={1}
              max={1000}
              step={1}
              onValueChange={([v]) => handleConfigChange('stiffness', v)}
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Damping</Label>
              <span className="text-[10px] text-muted-foreground">{currentConfig.damping}</span>
            </div>
            <Slider
              value={[currentConfig.damping]}
              min={1}
              max={500}
              step={1}
              onValueChange={([v]) => handleConfigChange('damping', v)}
            />
          </div>

          {/* Quick presets for reference */}
          <div className="flex flex-wrap gap-1 pt-1">
            {SPRING_PRESET_INFO.slice(0, 4).map((preset) => (
              <button
                key={preset.name}
                onClick={() => onChange(undefined, SPRING_PRESETS[preset.name])}
                className="text-[9px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                title={`Apply ${preset.label} values`}
              >
                {preset.icon} {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
