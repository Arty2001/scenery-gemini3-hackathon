'use client';

import { useEffect, useState, useCallback } from 'react';
import { PropsForm } from '@/components/props-editor';
import { getComponentById } from '@/lib/actions/components';
import type { ComponentItem } from '@/lib/composition/types';
import {
  Loader2, Smartphone, Monitor, Maximize,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ComponentPropertiesProps {
  item: ComponentItem;
  onUpdate: (updates: Partial<ComponentItem>) => void;
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

  // Load component data when componentId changes
  useEffect(() => {
    let cancelled = false;

    async function loadComponent() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getComponentById(item.componentId);
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
  }, [item.componentId]);

  // Handle props change from PropsForm
  const handlePropsChange = useCallback(
    (newProps: Record<string, unknown>) => {
      onUpdate({ props: newProps });
    },
    [onUpdate]
  );

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

  const displaySize = item.displaySize ?? 'laptop';
  const hasCustomSize = item.containerWidth != null || item.containerHeight != null;

  const handlePresetChange = (value: string) => {
    if (!value) return;
    onUpdate({
      displaySize: value as 'phone' | 'laptop' | 'full',
      containerWidth: undefined,
      containerHeight: undefined,
    });
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v > 0) onUpdate({ containerWidth: v });
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v > 0) onUpdate({ containerHeight: v });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{componentData.name}</h3>
        <p className="text-xs text-muted-foreground truncate" title={componentData.filePath}>
          {componentData.filePath}
        </p>
      </div>

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
            <Label className="text-xs text-muted-foreground">Width</Label>
            <Input
              type="number"
              min={1}
              value={item.containerWidth ?? (displaySize === 'phone' ? 375 : displaySize === 'laptop' ? 1280 : '')}
              onChange={handleWidthChange}
              placeholder="auto"
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Height</Label>
            <Input
              type="number"
              min={1}
              value={item.containerHeight ?? (displaySize === 'phone' ? 812 : displaySize === 'laptop' ? 800 : '')}
              onChange={handleHeightChange}
              placeholder="auto"
              className="h-7 text-xs"
            />
          </div>
        </div>

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

      <PropsForm
        propsSchema={componentData.propsSchema}
        currentProps={item.props}
        onPropsChange={handlePropsChange}
      />
    </div>
  );
}
