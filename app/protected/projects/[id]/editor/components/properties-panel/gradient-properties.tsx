'use client';

/**
 * Gradient properties panel for editing animated gradient background items.
 * Supports linear, radial, and conic gradients with animation.
 */

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { GradientItem, GradientColorStop, TimelineItem } from '@/lib/composition/types';

// =============================================
// Types
// =============================================

interface GradientPropertiesProps {
  item: GradientItem;
  onUpdate: (updates: Partial<TimelineItem>) => void;
}

// =============================================
// Constants
// =============================================

const GRADIENT_TYPES = [
  { value: 'linear', label: 'Linear' },
  { value: 'radial', label: 'Radial' },
  { value: 'conic', label: 'Conic' },
] as const;

const DEFAULT_COLORS: GradientColorStop[] = [
  { color: '#6366f1', position: 0 },
  { color: '#06b6d4', position: 100 },
];

// =============================================
// Component
// =============================================

export function GradientProperties({ item, onUpdate }: GradientPropertiesProps) {
  const isLinear = item.gradientType === 'linear';
  const isRadialOrConic = item.gradientType === 'radial' || item.gradientType === 'conic';

  const colors = item.colors ?? DEFAULT_COLORS;

  // Update a single color stop
  const updateColorStop = (index: number, updates: Partial<GradientColorStop>) => {
    const newColors = [...colors];
    newColors[index] = { ...newColors[index], ...updates };
    onUpdate({ colors: newColors } as Partial<GradientItem>);
  };

  // Add a new color stop
  const addColorStop = () => {
    const newColors = [...colors];
    const lastColor = newColors[newColors.length - 1];
    newColors.push({
      color: '#ffffff',
      position: Math.min(100, (lastColor?.position ?? 50) + 20),
    });
    // Sort by position
    newColors.sort((a, b) => a.position - b.position);
    onUpdate({ colors: newColors } as Partial<GradientItem>);
  };

  // Remove a color stop
  const removeColorStop = (index: number) => {
    if (colors.length <= 2) return; // Minimum 2 colors
    const newColors = colors.filter((_, i) => i !== index);
    onUpdate({ colors: newColors } as Partial<GradientItem>);
  };

  return (
    <div className="space-y-6">
      {/* Gradient Type */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Gradient Type</h3>
        <select
          className="w-full h-8 text-xs rounded-md border bg-background px-2"
          value={item.gradientType}
          onChange={(e) => onUpdate({ gradientType: e.target.value } as Partial<GradientItem>)}
        >
          {GRADIENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Color Stops */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Color Stops</h3>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs"
            onClick={addColorStop}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        </div>

        {/* Gradient Preview */}
        <div
          className="h-8 rounded-md border"
          style={{
            background: `linear-gradient(90deg, ${colors.map(c => `${c.color} ${c.position}%`).join(', ')})`,
          }}
        />

        {/* Color Stop List */}
        <div className="space-y-2">
          {colors.map((stop, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-7 rounded border cursor-pointer flex-shrink-0"
                value={stop.color}
                onChange={(e) => updateColorStop(index, { color: e.target.value })}
              />
              <Input
                type="text"
                className="w-20 h-7 text-xs flex-shrink-0"
                value={stop.color}
                onChange={(e) => updateColorStop(index, { color: e.target.value })}
              />
              <Slider
                className="flex-1"
                value={[stop.position]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => updateColorStop(index, { position: v })}
              />
              <span className="text-[10px] text-muted-foreground w-8">{stop.position}%</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => removeColorStop(index)}
                disabled={colors.length <= 2}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Angle (for linear and conic) */}
      {(isLinear || item.gradientType === 'conic') && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Angle</h3>
          <div className="space-y-1">
            <Slider
              value={[item.angle ?? 135]}
              min={0}
              max={360}
              step={1}
              onValueChange={([v]) => onUpdate({ angle: v } as Partial<GradientItem>)}
            />
            <span className="text-[10px] text-muted-foreground">{item.angle ?? 135}°</span>
          </div>
        </div>
      )}

      {/* Center Position (for radial and conic) */}
      {isRadialOrConic && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Center Position</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Center X</Label>
              <Slider
                value={[(item.centerX ?? 0.5) * 100]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => onUpdate({ centerX: v / 100 } as Partial<GradientItem>)}
              />
              <span className="text-[10px] text-muted-foreground">{Math.round((item.centerX ?? 0.5) * 100)}%</span>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Center Y</Label>
              <Slider
                value={[(item.centerY ?? 0.5) * 100]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => onUpdate({ centerY: v / 100 } as Partial<GradientItem>)}
              />
              <span className="text-[10px] text-muted-foreground">{Math.round((item.centerY ?? 0.5) * 100)}%</span>
            </div>
          </div>
        </div>
      )}

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
              onValueChange={([v]) => onUpdate({ position: { ...item.position, x: v / 100, y: item.position?.y ?? 0.5 } } as Partial<GradientItem>)}
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
              onValueChange={([v]) => onUpdate({ position: { ...item.position, x: item.position?.x ?? 0.5, y: v / 100 } } as Partial<GradientItem>)}
            />
            <span className="text-[10px] text-muted-foreground">{Math.round((item.position?.y ?? 0.5) * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Size */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Size</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Width</Label>
            <Slider
              value={[(item.width ?? 1) * 100]}
              min={10}
              max={200}
              step={1}
              onValueChange={([v]) => onUpdate({ width: v / 100 } as Partial<GradientItem>)}
            />
            <span className="text-[10px] text-muted-foreground">{Math.round((item.width ?? 1) * 100)}%</span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Height</Label>
            <Slider
              value={[(item.height ?? 1) * 100]}
              min={10}
              max={200}
              step={1}
              onValueChange={([v]) => onUpdate({ height: v / 100 } as Partial<GradientItem>)}
            />
            <span className="text-[10px] text-muted-foreground">{Math.round((item.height ?? 1) * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Animation */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Animation</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="animate-gradient"
              checked={item.animate ?? false}
              onCheckedChange={(checked) => onUpdate({ animate: checked === true } as Partial<GradientItem>)}
            />
            <Label htmlFor="animate-gradient" className="text-xs">Enable Animation</Label>
          </div>

          {item.animate && (
            <>
              <div className="flex items-center gap-2 pl-6">
                <Checkbox
                  id="animate-angle"
                  checked={item.animateAngle ?? false}
                  onCheckedChange={(checked) => onUpdate({ animateAngle: checked === true } as Partial<GradientItem>)}
                />
                <Label htmlFor="animate-angle" className="text-xs">Rotate Gradient</Label>
              </div>

              <div className="flex items-center gap-2 pl-6">
                <Checkbox
                  id="animate-colors"
                  checked={item.animateColors ?? false}
                  onCheckedChange={(checked) => onUpdate({ animateColors: checked === true } as Partial<GradientItem>)}
                />
                <Label htmlFor="animate-colors" className="text-xs">Shift Colors</Label>
              </div>

              <div className="space-y-1 pl-6">
                <Label className="text-xs text-muted-foreground">Speed</Label>
                <Slider
                  value={[item.speed ?? 1]}
                  min={0.1}
                  max={5}
                  step={0.1}
                  onValueChange={([v]) => onUpdate({ speed: v } as Partial<GradientItem>)}
                />
                <span className="text-[10px] text-muted-foreground">{(item.speed ?? 1).toFixed(1)}x</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
