'use client';

/**
 * Shape properties panel for editing shape items.
 * Supports rectangle, circle, line, gradient, divider, badge, and SVG shapes.
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { ShapeItem, TimelineItem } from '@/lib/composition/types';

// =============================================
// Types
// =============================================

interface ShapePropertiesProps {
  item: ShapeItem;
  onUpdate: (updates: Partial<TimelineItem>) => void;
}

// =============================================
// Constants
// =============================================

const SHAPE_TYPES = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'line', label: 'Line' },
  { value: 'divider', label: 'Divider' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'badge', label: 'Badge' },
  { value: 'svg', label: 'SVG' },
] as const;

// =============================================
// Component
// =============================================

export function ShapeProperties({ item, onUpdate }: ShapePropertiesProps) {
  const isGradient = item.shapeType === 'gradient';
  const isBadge = item.shapeType === 'badge';
  const isSvg = item.shapeType === 'svg';
  const isCircle = item.shapeType === 'circle';

  return (
    <div className="space-y-6">
      {/* Shape Type */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Shape Type</h3>
        <select
          className="w-full h-8 text-xs rounded-md border bg-background px-2"
          value={item.shapeType}
          onChange={(e) => onUpdate({ shapeType: e.target.value } as Partial<ShapeItem>)}
        >
          {SHAPE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
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
              onValueChange={([v]) => onUpdate({ position: { ...item.position, x: v / 100, y: item.position?.y ?? 0.5 } } as Partial<ShapeItem>)}
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
              onValueChange={([v]) => onUpdate({ position: { ...item.position, x: item.position?.x ?? 0.5, y: v / 100 } } as Partial<ShapeItem>)}
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
              value={[item.width * 100]}
              min={1}
              max={100}
              step={1}
              onValueChange={([v]) => onUpdate({ width: v / 100 } as Partial<ShapeItem>)}
            />
            <span className="text-[10px] text-muted-foreground">{Math.round(item.width * 100)}%</span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Height</Label>
            <Slider
              value={[item.height * 100]}
              min={1}
              max={100}
              step={1}
              onValueChange={([v]) => onUpdate({ height: v / 100 } as Partial<ShapeItem>)}
            />
            <span className="text-[10px] text-muted-foreground">{Math.round(item.height * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Fill & Stroke (not for gradient) */}
      {!isGradient && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Fill & Stroke</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Fill Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-7 rounded border cursor-pointer"
                  value={item.fill ?? '#ffffff'}
                  onChange={(e) => onUpdate({ fill: e.target.value } as Partial<ShapeItem>)}
                />
                <Input
                  type="text"
                  className="w-20 h-7 text-xs"
                  value={item.fill ?? '#ffffff'}
                  onChange={(e) => onUpdate({ fill: e.target.value } as Partial<ShapeItem>)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Stroke Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-7 rounded border cursor-pointer"
                  value={item.stroke ?? '#000000'}
                  onChange={(e) => onUpdate({ stroke: e.target.value } as Partial<ShapeItem>)}
                />
                <Input
                  type="text"
                  className="w-20 h-7 text-xs"
                  value={item.stroke ?? ''}
                  placeholder="none"
                  onChange={(e) => onUpdate({ stroke: e.target.value || undefined } as Partial<ShapeItem>)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Stroke Width</Label>
              <Input
                type="number"
                className="w-20 h-7 text-xs"
                min={0}
                max={20}
                step={0.5}
                value={item.strokeWidth ?? 2}
                onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) } as Partial<ShapeItem>)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Border Radius (for rectangle, line, gradient) */}
      {!isCircle && !isSvg && !isBadge && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Border Radius</h3>
          <div className="space-y-1">
            <Slider
              value={[item.borderRadius ?? 0]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => onUpdate({ borderRadius: v } as Partial<ShapeItem>)}
            />
            <span className="text-[10px] text-muted-foreground">{item.borderRadius ?? 0}px</span>
          </div>
        </div>
      )}

      {/* Opacity */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Opacity</h3>
        <div className="space-y-1">
          <Slider
            value={[(item.opacity ?? 1) * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => onUpdate({ opacity: v / 100 } as Partial<ShapeItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{Math.round((item.opacity ?? 1) * 100)}%</span>
        </div>
      </div>

      {/* Gradient Controls */}
      {isGradient && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Gradient</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">From Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-7 rounded border cursor-pointer"
                  value={item.gradientFrom ?? '#6366f1'}
                  onChange={(e) => onUpdate({ gradientFrom: e.target.value } as Partial<ShapeItem>)}
                />
                <Input
                  type="text"
                  className="w-20 h-7 text-xs"
                  value={item.gradientFrom ?? '#6366f1'}
                  onChange={(e) => onUpdate({ gradientFrom: e.target.value } as Partial<ShapeItem>)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">To Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-7 rounded border cursor-pointer"
                  value={item.gradientTo ?? '#06b6d4'}
                  onChange={(e) => onUpdate({ gradientTo: e.target.value } as Partial<ShapeItem>)}
                />
                <Input
                  type="text"
                  className="w-20 h-7 text-xs"
                  value={item.gradientTo ?? '#06b6d4'}
                  onChange={(e) => onUpdate({ gradientTo: e.target.value } as Partial<ShapeItem>)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Angle</Label>
              <Input
                type="number"
                className="w-20 h-7 text-xs"
                min={0}
                max={360}
                step={5}
                value={item.gradientDirection ?? 135}
                onChange={(e) => onUpdate({ gradientDirection: Number(e.target.value) } as Partial<ShapeItem>)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Badge Controls */}
      {isBadge && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Badge Text</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Text</Label>
              <Input
                type="text"
                className="flex-1 h-7 text-xs"
                value={item.text ?? ''}
                onChange={(e) => onUpdate({ text: e.target.value } as Partial<ShapeItem>)}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Font Size</Label>
              <Input
                type="number"
                className="w-20 h-7 text-xs"
                min={8}
                max={48}
                value={item.fontSize ?? 13}
                onChange={(e) => onUpdate({ fontSize: Number(e.target.value) } as Partial<ShapeItem>)}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Text Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-7 rounded border cursor-pointer"
                  value={item.color ?? '#ffffff'}
                  onChange={(e) => onUpdate({ color: e.target.value } as Partial<ShapeItem>)}
                />
                <Input
                  type="text"
                  className="w-20 h-7 text-xs"
                  value={item.color ?? '#ffffff'}
                  onChange={(e) => onUpdate({ color: e.target.value } as Partial<ShapeItem>)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SVG Controls */}
      {isSvg && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">SVG Content</h3>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">SVG Markup</Label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono resize-y min-h-[100px]"
                value={item.svgContent ?? ''}
                placeholder="<path d=&quot;M10,80 Q52,10 95,80&quot; stroke=&quot;#6366f1&quot; fill=&quot;none&quot;/>"
                onChange={(e) => onUpdate({ svgContent: e.target.value } as Partial<ShapeItem>)}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">ViewBox</Label>
              <Input
                type="text"
                className="flex-1 h-7 text-xs font-mono"
                value={item.viewBox ?? ''}
                placeholder="0 0 400 300"
                onChange={(e) => onUpdate({ viewBox: e.target.value } as Partial<ShapeItem>)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
