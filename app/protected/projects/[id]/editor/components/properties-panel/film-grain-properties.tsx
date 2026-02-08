'use client';

/**
 * Film grain properties panel for editing film grain effect items.
 * Controls intensity, speed, size, and blend mode of the grain effect.
 */

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { FilmGrainItem, TimelineItem } from '@/lib/composition/types';

// =============================================
// Types
// =============================================

interface FilmGrainPropertiesProps {
  item: FilmGrainItem;
  onUpdate: (updates: Partial<TimelineItem>) => void;
}

// =============================================
// Constants
// =============================================

const BLEND_MODES = [
  { value: 'overlay', label: 'Overlay', description: 'Natural film look' },
  { value: 'soft-light', label: 'Soft Light', description: 'Subtle, gentle effect' },
  { value: 'multiply', label: 'Multiply', description: 'Darker, grittier look' },
  { value: 'screen', label: 'Screen', description: 'Lighter, faded look' },
] as const;

// =============================================
// Component
// =============================================

export function FilmGrainProperties({ item, onUpdate }: FilmGrainPropertiesProps) {
  return (
    <div className="space-y-6">
      {/* Intensity */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Intensity</h3>
        <p className="text-[10px] text-muted-foreground">Amount of visible grain</p>
        <div className="space-y-1">
          <Slider
            value={[item.intensity * 100]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => onUpdate({ intensity: v / 100 } as Partial<FilmGrainItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{(item.intensity * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Speed */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Animation Speed</h3>
        <p className="text-[10px] text-muted-foreground">How fast the grain animates</p>
        <div className="space-y-1">
          <Slider
            value={[item.speed * 100]}
            min={10}
            max={300}
            step={10}
            onValueChange={([v]) => onUpdate({ speed: v / 100 } as Partial<FilmGrainItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{(item.speed * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Size */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Grain Size</h3>
        <p className="text-[10px] text-muted-foreground">Size of grain particles</p>
        <div className="space-y-1">
          <Slider
            value={[item.size * 100]}
            min={10}
            max={100}
            step={5}
            onValueChange={([v]) => onUpdate({ size: v / 100 } as Partial<FilmGrainItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{(item.size * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Colored Toggle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Colored Grain</h3>
            <p className="text-[10px] text-muted-foreground">Use colored noise instead of monochrome</p>
          </div>
          <input
            type="checkbox"
            className="w-4 h-4 rounded border"
            checked={item.colored}
            onChange={(e) => onUpdate({ colored: e.target.checked } as Partial<FilmGrainItem>)}
          />
        </div>
      </div>

      {/* Blend Mode */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Blend Mode</h3>
        <select
          className="w-full h-8 text-xs rounded-md border bg-background px-2"
          value={item.blendMode}
          onChange={(e) => onUpdate({ blendMode: e.target.value } as Partial<FilmGrainItem>)}
        >
          {BLEND_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>{mode.label}</option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground">
          {BLEND_MODES.find(m => m.value === item.blendMode)?.description}
        </p>
      </div>
    </div>
  );
}
