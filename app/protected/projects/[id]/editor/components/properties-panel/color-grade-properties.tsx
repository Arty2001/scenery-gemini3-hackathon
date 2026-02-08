'use client';

/**
 * Color grade properties panel for editing color grading effect items.
 * Controls preset, intensity, and individual color adjustments.
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { ColorGradeItem, ColorGradePreset, TimelineItem } from '@/lib/composition/types';

// =============================================
// Types
// =============================================

interface ColorGradePropertiesProps {
  item: ColorGradeItem;
  onUpdate: (updates: Partial<TimelineItem>) => void;
}

// =============================================
// Constants
// =============================================

const COLOR_GRADE_PRESETS: { value: ColorGradePreset; label: string; description: string }[] = [
  { value: 'cinematic-teal-orange', label: 'Cinematic Teal/Orange', description: 'Blockbuster film look' },
  { value: 'vintage-warm', label: 'Vintage Warm', description: 'Nostalgic warm tones' },
  { value: 'vintage-cool', label: 'Vintage Cool', description: 'Faded cool tones' },
  { value: 'noir', label: 'Noir', description: 'Black & white with contrast' },
  { value: 'cyberpunk', label: 'Cyberpunk', description: 'Neon pink and cyan' },
  { value: 'sunset', label: 'Sunset', description: 'Warm golden hour' },
  { value: 'moonlight', label: 'Moonlight', description: 'Cool night tones' },
  { value: 'sepia', label: 'Sepia', description: 'Classic sepia tone' },
  { value: 'custom', label: 'Custom', description: 'Define your own adjustments' },
];

// =============================================
// Component
// =============================================

export function ColorGradeProperties({ item, onUpdate }: ColorGradePropertiesProps) {
  const isCustom = item.preset === 'custom';

  return (
    <div className="space-y-6">
      {/* Preset */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Preset</h3>
        <select
          className="w-full h-8 text-xs rounded-md border bg-background px-2"
          value={item.preset}
          onChange={(e) => onUpdate({ preset: e.target.value as ColorGradePreset } as Partial<ColorGradeItem>)}
        >
          {COLOR_GRADE_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>{preset.label}</option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground">
          {COLOR_GRADE_PRESETS.find(p => p.value === item.preset)?.description}
        </p>
      </div>

      {/* Intensity */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Intensity</h3>
        <p className="text-[10px] text-muted-foreground">Strength of the color grade effect</p>
        <div className="space-y-1">
          <Slider
            value={[item.intensity * 100]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => onUpdate({ intensity: v / 100 } as Partial<ColorGradeItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{(item.intensity * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Show custom controls when custom preset is selected */}
      {isCustom && (
        <>
          {/* Brightness */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Brightness</h3>
            <div className="space-y-1">
              <Slider
                value={[(item.brightness ?? 0) * 100]}
                min={-100}
                max={100}
                step={5}
                onValueChange={([v]) => onUpdate({ brightness: v / 100 } as Partial<ColorGradeItem>)}
              />
              <span className="text-[10px] text-muted-foreground">{((item.brightness ?? 0) * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Contrast */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Contrast</h3>
            <div className="space-y-1">
              <Slider
                value={[(item.contrast ?? 0) * 100]}
                min={-100}
                max={100}
                step={5}
                onValueChange={([v]) => onUpdate({ contrast: v / 100 } as Partial<ColorGradeItem>)}
              />
              <span className="text-[10px] text-muted-foreground">{((item.contrast ?? 0) * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Saturation */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Saturation</h3>
            <p className="text-[10px] text-muted-foreground">-100% = grayscale</p>
            <div className="space-y-1">
              <Slider
                value={[(item.saturation ?? 0) * 100]}
                min={-100}
                max={100}
                step={5}
                onValueChange={([v]) => onUpdate({ saturation: v / 100 } as Partial<ColorGradeItem>)}
              />
              <span className="text-[10px] text-muted-foreground">{((item.saturation ?? 0) * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Temperature */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Temperature</h3>
            <p className="text-[10px] text-muted-foreground">Cool (blue) ↔ Warm (yellow)</p>
            <div className="space-y-1">
              <Slider
                value={[(item.temperature ?? 0) * 100]}
                min={-100}
                max={100}
                step={5}
                onValueChange={([v]) => onUpdate({ temperature: v / 100 } as Partial<ColorGradeItem>)}
              />
              <span className="text-[10px] text-muted-foreground">{((item.temperature ?? 0) * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Tint */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Tint</h3>
            <p className="text-[10px] text-muted-foreground">Green ↔ Magenta</p>
            <div className="space-y-1">
              <Slider
                value={[(item.tint ?? 0) * 100]}
                min={-100}
                max={100}
                step={5}
                onValueChange={([v]) => onUpdate({ tint: v / 100 } as Partial<ColorGradeItem>)}
              />
              <span className="text-[10px] text-muted-foreground">{((item.tint ?? 0) * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Split Toning - Shadows */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Shadow Color</h3>
            <p className="text-[10px] text-muted-foreground">Tint for dark areas</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-7 rounded border cursor-pointer"
                value={item.shadows ?? '#000000'}
                onChange={(e) => onUpdate({ shadows: e.target.value } as Partial<ColorGradeItem>)}
              />
              <Input
                type="text"
                className="flex-1 h-7 text-xs"
                value={item.shadows ?? ''}
                placeholder="Optional"
                onChange={(e) => onUpdate({ shadows: e.target.value || undefined } as Partial<ColorGradeItem>)}
              />
            </div>
          </div>

          {/* Split Toning - Highlights */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Highlight Color</h3>
            <p className="text-[10px] text-muted-foreground">Tint for bright areas</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-7 rounded border cursor-pointer"
                value={item.highlights ?? '#ffffff'}
                onChange={(e) => onUpdate({ highlights: e.target.value } as Partial<ColorGradeItem>)}
              />
              <Input
                type="text"
                className="flex-1 h-7 text-xs"
                value={item.highlights ?? ''}
                placeholder="Optional"
                onChange={(e) => onUpdate({ highlights: e.target.value || undefined } as Partial<ColorGradeItem>)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
