'use client';

import { useEffect, useState, useCallback } from 'react';
import { PropsForm } from '@/components/props-editor';
import { getComponentById } from '@/lib/actions/components';
import type { ComponentItem, CustomHtmlItem } from '@/lib/composition/types';
import {
  Loader2, Smartphone, Monitor, Maximize,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  Check, Move,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';

// Background color presets
const BG_PRESETS = [
  { value: '#ffffff', label: 'White' },
  { value: '#f5f5f5', label: 'Light Gray' },
  { value: '#e5e5e5', label: 'Gray' },
  { value: '#171717', label: 'Dark' },
  { value: '#0a0a0a', label: 'Black' },
  { value: '#fef2f2', label: 'Red Light' },
  { value: '#fef9c3', label: 'Yellow Light' },
  { value: '#dcfce7', label: 'Green Light' },
  { value: '#dbeafe', label: 'Blue Light' },
  { value: '#f3e8ff', label: 'Purple Light' },
  { value: 'transparent', label: 'Transparent' },
] as const;

interface ComponentPropertiesProps {
  item: ComponentItem | CustomHtmlItem;
  onUpdate: (updates: Partial<ComponentItem | CustomHtmlItem>) => void;
}

interface ComponentData {
  id: string;
  name: string;
  filePath: string;
  propsSchema: Record<string, unknown> | null;
  demoProps: Record<string, unknown> | null;
}

export function ComponentProperties({
  item,
  onUpdate,
}: ComponentPropertiesProps) {
  const [componentData, setComponentData] = useState<ComponentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCustomHtml = item.type === 'custom-html';
  const componentId = isCustomHtml ? null : (item as ComponentItem).componentId;

  // Load component data when componentId changes (only for component type)
  useEffect(() => {
    if (isCustomHtml || !componentId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadComponent() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getComponentById(componentId!);
        if (!cancelled) {
          setComponentData(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load component');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadComponent();

    return () => {
      cancelled = true;
    };
  }, [componentId, isCustomHtml]);

  // Handle props change from PropsForm
  const handlePropsChange = useCallback(
    (newProps: Record<string, unknown>) => {
      onUpdate({ props: newProps });
    },
    [onUpdate]
  );

  if (!isCustomHtml) {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      );
    }

    if (!componentData) {
      return (
        <div className="text-sm text-muted-foreground">
          Component not found
        </div>
      );
    }
  }

  const displaySize = item.displaySize ?? 'laptop';
  const hasCustomSize = item.containerWidth != null || item.containerHeight != null;
  const currentBg = item.backgroundColor ?? '#ffffff';

  const handlePresetChange = (value: string) => {
    if (!value) return;
    onUpdate({
      displaySize: value as 'phone' | 'laptop' | 'full',
      containerWidth: undefined,
      containerHeight: undefined,
    });
  };

  const handleBgColorChange = (color: string) => {
    onUpdate({ backgroundColor: color });
  };

  const handlePositionChange = (axis: 'x' | 'y', value: number) => {
    const current = item.position ?? { x: 0.5, y: 0.5 };
    onUpdate({
      position: {
        ...current,
        [axis]: value,
      },
    });
  };

  return (
    <div className="space-y-4">
      {isCustomHtml ? (
        <div>
          <h3 className="text-sm font-semibold">Custom HTML</h3>
          <p className="text-xs text-muted-foreground">Imported HTML component</p>
        </div>
      ) : componentData && (
        <div>
          <h3 className="text-sm font-semibold">{componentData.name}</h3>
          <p className="text-xs text-muted-foreground truncate" title={componentData.filePath}>
            {componentData.filePath}
          </p>
        </div>
      )}

      {/* Display Size */}
      <div className="space-y-2">
        <Label className="text-xs">Display Size</Label>
        <div className="flex gap-1">
          {([
            { value: 'phone', label: 'Phone', icon: Smartphone },
            { value: 'laptop', label: 'Laptop', icon: Monitor },
            { value: 'full', label: 'Full', icon: Maximize },
          ] as const).map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={!hasCustomSize && displaySize === value ? 'secondary' : 'ghost'}
              size="sm"
              className={cn('gap-1 text-xs h-7 px-2', !hasCustomSize && displaySize === value && 'ring-1 ring-ring')}
              onClick={() => handlePresetChange(value)}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          ))}
        </div>

        {/* Custom width/height */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <Label className="text-xs text-muted-foreground">Width (px)</Label>
            <Input
              type="number"
              min={1}
              defaultValue={item.containerWidth ?? (displaySize === 'phone' ? 375 : displaySize === 'laptop' ? 1280 : '')}
              key={`width-${item.id}-${item.containerWidth ?? 'none'}-${displaySize}`}
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v > 0) {
                  onUpdate({ containerWidth: v });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = parseInt(e.currentTarget.value, 10);
                  if (!isNaN(v) && v > 0) {
                    onUpdate({ containerWidth: v });
                  }
                  e.currentTarget.blur();
                }
              }}
              placeholder="auto"
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Height (px)</Label>
            <Input
              type="number"
              min={1}
              defaultValue={item.containerHeight ?? (displaySize === 'phone' ? 812 : displaySize === 'laptop' ? 800 : '')}
              key={`height-${item.id}-${item.containerHeight ?? 'none'}-${displaySize}`}
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v > 0) {
                  onUpdate({ containerHeight: v });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = parseInt(e.currentTarget.value, 10);
                  if (!isNaN(v) && v > 0) {
                    onUpdate({ containerHeight: v });
                  }
                  e.currentTarget.blur();
                }
              }}
              placeholder="auto"
              className="h-7 text-xs"
            />
          </div>
        </div>
        {/* Show actual dimensions when custom size is set */}
        {hasCustomSize && (
          <p className="text-[10px] text-muted-foreground">
            Frame: {item.containerWidth ?? (displaySize === 'phone' ? 375 : 1280)}×
            {item.containerHeight ?? (displaySize === 'phone' ? 812 : 800)}px (scaled to fit)
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/60">
          Sets the component&apos;s viewport size. Preview is auto-scaled to fit.
        </p>

        {/* Alignment */}
        <div className="pt-1 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Alignment</Label>
          <div className="flex gap-3">
            {/* Horizontal */}
            <div className="flex gap-0.5">
              {([
                { value: 'left', icon: AlignStartVertical },
                { value: 'center', icon: AlignCenterVertical },
                { value: 'right', icon: AlignEndVertical },
              ] as const).map(({ value, icon: Icon }) => {
                const current = (item.objectPosition ?? 'center center').split(/\s+/);
                const hPos = current.find(p => ['left', 'center', 'right'].includes(p)) ?? 'center';
                const vPos = current.find(p => ['top', 'center', 'bottom'].includes(p)) ?? 'center';
                const isActive = hPos === value;
                return (
                  <Button
                    key={value}
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn('h-7 w-7 p-0', isActive && 'ring-1 ring-ring')}
                    onClick={() => onUpdate({ objectPosition: `${value} ${vPos}` })}
                    title={`Align ${value}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Button>
                );
              })}
            </div>
            {/* Vertical */}
            <div className="flex gap-0.5">
              {([
                { value: 'top', icon: AlignStartHorizontal },
                { value: 'center', icon: AlignCenterHorizontal },
                { value: 'bottom', icon: AlignEndHorizontal },
              ] as const).map(({ value, icon: Icon }) => {
                const current = (item.objectPosition ?? 'center center').split(/\s+/);
                const hPos = current.find(p => ['left', 'center', 'right'].includes(p)) ?? 'center';
                const vPos = current.find(p => ['top', 'center', 'bottom'].includes(p)) ?? 'center';
                const isActive = vPos === value;
                return (
                  <Button
                    key={value}
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn('h-7 w-7 p-0', isActive && 'ring-1 ring-ring')}
                    onClick={() => onUpdate({ objectPosition: `${hPos} ${value}` })}
                    title={`Align ${value}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Background Color */}
      <div className="space-y-2">
        <Label className="text-xs">Background</Label>
        <div className="flex flex-wrap gap-1.5">
          {BG_PRESETS.map(({ value, label }) => {
            const isSelected = currentBg === value;
            const isTransparent = value === 'transparent';
            return (
              <button
                key={value}
                className={cn(
                  'h-6 w-6 rounded-md border transition-all hover:scale-110',
                  isSelected && 'ring-2 ring-ring ring-offset-1',
                  isTransparent && 'bg-[linear-gradient(45deg,#ccc_25%,transparent_25%,transparent_75%,#ccc_75%,#ccc),linear-gradient(45deg,#ccc_25%,transparent_25%,transparent_75%,#ccc_75%,#ccc)] bg-[length:8px_8px] bg-[position:0_0,4px_4px]'
                )}
                style={isTransparent ? {} : { backgroundColor: value }}
                onClick={() => handleBgColorChange(value)}
                title={label}
              >
                {isSelected && (
                  <Check className={cn(
                    'h-4 w-4 mx-auto',
                    ['#171717', '#0a0a0a'].includes(value) ? 'text-white' : 'text-gray-800'
                  )} />
                )}
              </button>
            );
          })}
        </div>
        {/* Custom color input */}
        <div className="flex gap-2 items-center pt-1">
          <input
            type="color"
            value={currentBg === 'transparent' ? '#ffffff' : currentBg}
            onChange={(e) => handleBgColorChange(e.target.value)}
            className="h-7 w-7 cursor-pointer border rounded-md p-0 bg-transparent"
            style={{ appearance: 'none' }}
          />
          <Input
            type="text"
            value={currentBg}
            onChange={(e) => handleBgColorChange(e.target.value)}
            placeholder="#ffffff"
            className="h-7 text-xs flex-1 font-mono"
          />
        </div>
      </div>

      {/* Position on Canvas */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Move className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs">Position</Label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-muted-foreground">X</Label>
              <span className="text-xs text-muted-foreground font-mono">
                {Math.round((item.position?.x ?? 0.5) * 100)}%
              </span>
            </div>
            <Slider
              value={[(item.position?.x ?? 0.5) * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => handlePositionChange('x', v / 100)}
              className="h-4"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-muted-foreground">Y</Label>
              <span className="text-xs text-muted-foreground font-mono">
                {Math.round((item.position?.y ?? 0.5) * 100)}%
              </span>
            </div>
            <Slider
              value={[(item.position?.y ?? 0.5) * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => handlePositionChange('y', v / 100)}
              className="h-4"
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-6 px-2"
          onClick={() => onUpdate({ position: { x: 0.5, y: 0.5 } })}
        >
          Reset to Center
        </Button>
      </div>

      {!isCustomHtml && componentData && (
        <PropsForm
          propsSchema={componentData.propsSchema}
          currentProps={(item as ComponentItem).props}
          onPropsChange={handlePropsChange}
        />
      )}
    </div>
  );
}
