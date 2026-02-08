'use client';

/**
 * Particle properties panel for editing particle effect items.
 * Supports confetti, sparks, snow, bubbles, stars, and dust effects.
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { ParticleItem, TimelineItem } from '@/lib/composition/types';

// =============================================
// Types
// =============================================

interface ParticlePropertiesProps {
  item: ParticleItem;
  onUpdate: (updates: Partial<TimelineItem>) => void;
}

// =============================================
// Constants
// =============================================

const PARTICLE_TYPES = [
  { value: 'confetti', label: 'Confetti', description: 'Celebration effect' },
  { value: 'sparks', label: 'Sparks', description: 'Energy/fire effect' },
  { value: 'snow', label: 'Snow', description: 'Gentle falling snow' },
  { value: 'bubbles', label: 'Bubbles', description: 'Floating bubbles' },
  { value: 'stars', label: 'Stars', description: 'Twinkling stars' },
  { value: 'dust', label: 'Dust', description: 'Ethereal particles' },
] as const;

// =============================================
// Component
// =============================================

export function ParticleProperties({ item, onUpdate }: ParticlePropertiesProps) {
  // Handle color array updates
  const handleColorChange = (index: number, color: string) => {
    const newColors = [...item.colors];
    newColors[index] = color;
    onUpdate({ colors: newColors } as Partial<ParticleItem>);
  };

  const handleAddColor = () => {
    const newColors = [...item.colors, '#ffffff'];
    onUpdate({ colors: newColors } as Partial<ParticleItem>);
  };

  const handleRemoveColor = (index: number) => {
    if (item.colors.length <= 1) return;
    const newColors = item.colors.filter((_, i) => i !== index);
    onUpdate({ colors: newColors } as Partial<ParticleItem>);
  };

  return (
    <div className="space-y-6">
      {/* Particle Type */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Particle Type</h3>
        <select
          className="w-full h-8 text-xs rounded-md border bg-background px-2"
          value={item.particleType}
          onChange={(e) => onUpdate({ particleType: e.target.value } as Partial<ParticleItem>)}
        >
          {PARTICLE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground">
          {PARTICLE_TYPES.find(t => t.value === item.particleType)?.description}
        </p>
      </div>

      {/* Emitter Position */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Emitter Position</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">X Position</Label>
            <Slider
              value={[(item.emitterPosition?.x ?? 0.5) * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => onUpdate({
                emitterPosition: {
                  x: v / 100,
                  y: item.emitterPosition?.y ?? 0.5
                }
              } as Partial<ParticleItem>)}
            />
            <span className="text-[10px] text-muted-foreground">{Math.round((item.emitterPosition?.x ?? 0.5) * 100)}%</span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Y Position</Label>
            <Slider
              value={[(item.emitterPosition?.y ?? 0.5) * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => onUpdate({
                emitterPosition: {
                  x: item.emitterPosition?.x ?? 0.5,
                  y: v / 100
                }
              } as Partial<ParticleItem>)}
            />
            <span className="text-[10px] text-muted-foreground">{Math.round((item.emitterPosition?.y ?? 0.5) * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Emitter Size */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Emitter Size</h3>
        <p className="text-[10px] text-muted-foreground">Area from which particles spawn (0 = point source)</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Width</Label>
            <Slider
              value={[(item.emitterSize?.width ?? 0) * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => onUpdate({
                emitterSize: {
                  width: v / 100,
                  height: item.emitterSize?.height ?? 0
                }
              } as Partial<ParticleItem>)}
            />
            <span className="text-[10px] text-muted-foreground">{Math.round((item.emitterSize?.width ?? 0) * 100)}%</span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Height</Label>
            <Slider
              value={[(item.emitterSize?.height ?? 0) * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => onUpdate({
                emitterSize: {
                  width: item.emitterSize?.width ?? 0,
                  height: v / 100
                }
              } as Partial<ParticleItem>)}
            />
            <span className="text-[10px] text-muted-foreground">{Math.round((item.emitterSize?.height ?? 0) * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Particle Count */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Particle Count</h3>
        <div className="flex items-center gap-3">
          <Slider
            value={[item.particleCount]}
            min={10}
            max={200}
            step={5}
            className="flex-1"
            onValueChange={([v]) => onUpdate({ particleCount: v } as Partial<ParticleItem>)}
          />
          <Input
            type="number"
            className="w-16 h-7 text-xs"
            min={1}
            max={500}
            defaultValue={item.particleCount}
            key={`particleCount-${item.id}-${item.particleCount}`}
            onBlur={(e) => onUpdate({ particleCount: Number(e.target.value) } as Partial<ParticleItem>)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onUpdate({ particleCount: Number(e.currentTarget.value) } as Partial<ParticleItem>);
                e.currentTarget.blur();
              }
            }}
          />
        </div>
      </div>

      {/* Speed */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Speed</h3>
        <div className="space-y-1">
          <Slider
            value={[item.speed * 100]}
            min={10}
            max={300}
            step={10}
            onValueChange={([v]) => onUpdate({ speed: v / 100 } as Partial<ParticleItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{(item.speed * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Gravity */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Gravity</h3>
        <p className="text-[10px] text-muted-foreground">Negative values make particles float up</p>
        <div className="space-y-1">
          <Slider
            value={[item.gravity * 100]}
            min={-100}
            max={200}
            step={10}
            onValueChange={([v]) => onUpdate({ gravity: v / 100 } as Partial<ParticleItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{(item.gravity * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Spread */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Spread Angle</h3>
        <p className="text-[10px] text-muted-foreground">180° = semicircle up, 360° = all directions</p>
        <div className="space-y-1">
          <Slider
            value={[item.spread]}
            min={10}
            max={360}
            step={10}
            onValueChange={([v]) => onUpdate({ spread: v } as Partial<ParticleItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{item.spread}°</span>
        </div>
      </div>

      {/* Particle Size */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Particle Size</h3>
        <div className="space-y-1">
          <Slider
            value={[(item.particleSize ?? 1) * 100]}
            min={25}
            max={300}
            step={25}
            onValueChange={([v]) => onUpdate({ particleSize: v / 100 } as Partial<ParticleItem>)}
          />
          <span className="text-[10px] text-muted-foreground">{((item.particleSize ?? 1) * 100).toFixed(0)}%</span>
        </div>
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

      {/* Fade Out Toggle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Fade Out</h3>
          <input
            type="checkbox"
            className="w-4 h-4 rounded border"
            checked={item.fadeOut !== false}
            onChange={(e) => onUpdate({ fadeOut: e.target.checked } as Partial<ParticleItem>)}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">Particles fade as they age</p>
      </div>
    </div>
  );
}
