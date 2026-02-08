'use client';

/**
 * Blob properties panel for editing animated blob effect items.
 * Controls colors, animation style, complexity, and positioning.
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { BlobItem, BlobAnimationStyle, TimelineItem } from '@/lib/composition/types';

// =============================================
// Types
// =============================================

interface BlobPropertiesProps {
  item: BlobItem;
  onUpdate: (updates: Partial<TimelineItem>) => void;
}

// =============================================
// Constants
// =============================================

const ANIMATION_STYLES: { value: BlobAnimationStyle; label: string; description: string }[] = [
  { value: 'morph', label: 'Morph', description: 'Smooth shape-shifting' },
  { value: 'float', label: 'Float', description: 'Gentle floating movement' },
  { value: 'pulse', label: 'Pulse', description: 'Breathing in and out' },
  { value: 'wave', label: 'Wave', description: 'Wave-like deformation' },
];

const BLEND_MODES = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
] as const;

// =============================================
// Component
// =============================================

export function BlobProperties({ item, onUpdate }: BlobPropertiesProps) {
  // Handle color array updates
  const handleColorChange = (index: number, color: string) => {
    const newColors = [...item.colors];
    newColors[index] = color;
    onUpdate({ colors: newColors } as Partial<BlobItem>);
  };

  const handleAddColor = () => {
    const newColors = [...item.colors, '#ec4899'];
    onUpdate({ colors: newColors } as Partial<BlobItem>);
  };

  const handleRemoveColor = (index: number) => {
    if (item.colors.length <= 1) return;
    const newColors = item.colors.filter((_, i) => i !== index);
    onUpdate({ colors: newColors } as Partial<BlobItem>);
  };

  return (
    <div className="space-y-6">
      {/* Animation Style */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Animation Style</h3>
        <select
          className="w-full h-8 text-xs rounded-md border bg-background px-2"
          value={item.animationStyle}
          onChange={(e) => onUpdate({ animationStyle: e.target.value as BlobAnimationStyle } as Partial<BlobItem>)}
        >
          {ANIMATION_STYLES.map((style) => (
            <option key={style.value} value={style.value}>{style.label}</option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground">
          {ANIMATION_STYLES.find(s => s.value === item.animationStyle)?.description}
        </p>
      </div>

      {/* Blob Count */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Blob Count</h3>
        <p className="text-[10px] text-muted-foreground">Number of overlapping blob layers</p>
        <div className="flex items-center gap-3">
          <Slider
            value={[item.blobCount]}
            min={1}
            max={6}
            step={1}
            className="flex-1"
            onValueChange={([v]) => onUpdate({ blobCount: v } as Partial<BlobItem>)}
          />
          <span className="text-xs w-6 text-center">{item.blobCount}</span>
        </div>
      </div>

      {/* Complexity */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Complexity</h3>
        <p className="text-[10px] text-muted-foreground">Shape irregularity (higher = more organic)</p>
        <div className="space-y-1">
          <Slider
            value={[item.complexity * 100]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => onUpdate({ complexity: v / 100 } as Partial<BlobItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{(item.complexity * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Speed */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Animation Speed</h3>
        <div className="space-y-1">
          <Slider
            value={[item.speed * 100]}
            min={10}
            max={300}
            step={10}
            onValueChange={([v]) => onUpdate({ speed: v / 100 } as Partial<BlobItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{(item.speed * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Position */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Position</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">X Position</Label>
            <Slider
              value={[(item.position?.x ?? 0.5) * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => onUpdate({
                position: {
                  x: v / 100,
                  y: item.position?.y ?? 0.5
                }
              } as Partial<BlobItem>)}
            />
            <span className="text-[10px] text-muted-foreground">{Math.round((item.position?.x ?? 0.5) * 100)}%</span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Y Position</Label>
            <Slider
              value={[(item.position?.y ?? 0.5) * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => onUpdate({
                position: {
                  x: item.position?.x ?? 0.5,
                  y: v / 100
                }
              } as Partial<BlobItem>)}
            />
            <span className="text-[10px] text-muted-foreground">{Math.round((item.position?.y ?? 0.5) * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Scale */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Scale</h3>
        <div className="space-y-1">
          <Slider
            value={[(item.scale ?? 1) * 100]}
            min={25}
            max={300}
            step={25}
            onValueChange={([v]) => onUpdate({ scale: v / 100 } as Partial<BlobItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{((item.scale ?? 1) * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Opacity */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Opacity</h3>
        <div className="space-y-1">
          <Slider
            value={[item.opacity * 100]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => onUpdate({ opacity: v / 100 } as Partial<BlobItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{(item.opacity * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Blend Mode */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Blend Mode</h3>
        <select
          className="w-full h-8 text-xs rounded-md border bg-background px-2"
          value={item.blendMode}
          onChange={(e) => onUpdate({ blendMode: e.target.value } as Partial<BlobItem>)}
        >
          {BLEND_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>{mode.label}</option>
          ))}
        </select>
      </div>

      {/* Colors */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Colors</h3>
          <button
            className="text-xs text-primary hover:underline"
            onClick={handleAddColor}
          >
            + Add Color
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">Each blob layer uses one color</p>
        <div className="space-y-2">
          {item.colors.map((color, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-7 rounded border cursor-pointer"
                value={color}
                onChange={(e) => handleColorChange(index, e.target.value)}
              />
              <Input
                type="text"
                className="flex-1 h-7 text-xs"
                value={color}
                onChange={(e) => handleColorChange(index, e.target.value)}
              />
              {item.colors.length > 1 && (
                <button
                  className="text-xs text-destructive hover:underline"
                  onClick={() => handleRemoveColor(index)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
