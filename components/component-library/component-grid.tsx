'use client';

import { ComponentCard } from './component-card';
import type { ComponentInfo } from '@/lib/component-discovery/types';
import { PackageOpen } from 'lucide-react';

interface ComponentGridProps {
  components: ComponentInfo[];
  selectedId?: string;
  onSelect: (component: ComponentInfo) => void;
  onPreviewUpdate?: (componentId: string, newHtml: string) => void;
}

/**
 * ComponentGrid - Responsive grid layout for component cards
 *
 * Displays a grid of ComponentCard items with responsive columns.
 * Shows empty state when no components match filters.
 */
export function ComponentGrid({ components, selectedId, onSelect, onPreviewUpdate }: ComponentGridProps) {
  // Empty state
  if (components.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
        <PackageOpen className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-lg font-medium text-muted-foreground">
          No components found
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      {components.map((component) => {
        // Use database ID if available, otherwise generate from path+name
        const componentId = component.id ?? `${component.filePath}:${component.componentName}`;

        return (
          <ComponentCard
            key={componentId}
            component={{
              id: componentId,
              componentName: component.componentName,
              category: component.category,
              description: component.description,
              previewHtml: component.previewHtml,
            }}
            isSelected={componentId === selectedId}
            onSelect={() => onSelect(component)}
            onPreviewUpdate={onPreviewUpdate}
          />
        );
      })}
    </div>
  );
}
