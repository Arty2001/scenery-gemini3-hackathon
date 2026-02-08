'use client';

/**
 * Vignette properties panel for editing vignette effect items.
 * Controls intensity, size, softness, color, and shape of the vignette.
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { VignetteItem, TimelineItem } from '@/lib/composition/types';

// =============================================
// Types
// =============================================

interface VignettePropertiesProps {
  item: VignetteItem;
  onUpdate: (updates: Partial<TimelineItem>) => void;
}

// =============================================
// Constants
// =============================================

const VIGNETTE_SHAPES = [
  { value: 'circular', label: 'Circular', description: 'Round vignette, classic film look' },
  { value: 'rectangular', label: 'Rectangular', description: 'Follows video edges' },
] as const;

// =============================================
// Component
// =============================================

export function VignetteProperties({ item, onUpdate }: VignettePropertiesProps) {
  return (
    <div className="space-y-6">
      {/* Intensity */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Intensity</h3>
        <p className="text-[10px] text-muted-foreground">How dark the edges become</p>
        <div className="space-y-1">
          <Slider
            value={[item.intensity * 100]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => onUpdate({ intensity: v / 100 } as Partial<VignetteItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{(item.intensity * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Size */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Size</h3>
        <p className="text-[10px] text-muted-foreground">Size of the clear center area</p>
        <div className="space-y-1">
          <Slider
            value={[item.size * 100]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => onUpdate({ size: v / 100 } as Partial<VignetteItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{(item.size * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Softness */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Softness</h3>
        <p className="text-[10px] text-muted-foreground">Edge transition smoothness</p>
        <div className="space-y-1">
          <Slider
            value={[item.softness * 100]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => onUpdate({ softness: v / 100 } as Partial<VignetteItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{(item.softness * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Color */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Color</h3>
        <p className="text-[10px] text-muted-foreground">Vignette color (default: black)</p>
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="w-8 h-7 rounded border cursor-pointer"
            value={item.color ?? '#000000'}
            onChange={(e) => onUpdate({ color: e.target.value } as Partial<VignetteItem>)}
          />
          <Input
            type="text"
            className="flex-1 h-7 text-xs"
            value={item.color ?? '#000000'}
            onChange={(e) => onUpdate({ color: e.target.value } as Partial<VignetteItem>)}
          />
        </div>
      </div>

      {/* Shape */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Shape</h3>
        <select
          className="w-full h-8 text-xs rounded-md border bg-background px-2"
          value={item.shape}
          onChange={(e) => onUpdate({ shape: e.target.value } as Partial<VignetteItem>)}
        >
          {VIGNETTE_SHAPES.map((shape) => (
            <option key={shape.value} value={shape.value}>{shape.label}</option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground">
          {VIGNETTE_SHAPES.find(s => s.value === item.shape)?.description}
        </p>
      </div>
    </div>
  );
}
