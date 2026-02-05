'use client';

import { useState, useMemo, useCallback } from 'react';
import type { ComponentWithId } from '@/lib/actions/components';
import type { ComponentInfo } from '@/lib/component-discovery/types';
import {
  ComponentGrid,
  ComponentFilters,
  ComponentDetailPanel,
} from '@/components/component-library';

interface ComponentsClientProps {
  components: ComponentWithId[];
  projectId: string;
}

type PreviewUpdates = Record<string, string>;

/**
 * ComponentsClient - Main client component orchestrating the component library
 *
 * Manages state for:
 * - Search and category filtering
 * - Component selection
 * - Props editing
 * - Visual preview rendering
 */
export function ComponentsClient({ components, projectId }: ComponentsClientProps) {
  // Filter state
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  // Selection state
  const [selectedComponent, setSelectedComponent] = useState<ComponentWithId | null>(null);

  // Props state - initialized from selected component's demoProps
  const [currentProps, setCurrentProps] = useState<Record<string, unknown>>({});

  // Track preview updates (componentId -> updated previewHtml)
  const [previewUpdates, setPreviewUpdates] = useState<PreviewUpdates>({});

  // Extract unique categories from components
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const comp of components) {
      if (comp.category) {
        cats.add(comp.category);
      }
    }
    return Array.from(cats).sort();
  }, [components]);

  // Filter components based on search and category, apply preview updates
  const filteredComponents = useMemo(() => {
    return components
      .filter((comp) => {
        // Search filter (case-insensitive match on name and description)
        if (search) {
          const searchLower = search.toLowerCase();
          const matchesName = comp.componentName.toLowerCase().includes(searchLower);
          const matchesDisplay = comp.displayName?.toLowerCase().includes(searchLower);
          const matchesDescription = comp.description?.toLowerCase().includes(searchLower);
          if (!matchesName && !matchesDisplay && !matchesDescription) {
            return false;
          }
        }

        // Category filter
        if (category !== 'all' && comp.category !== category) {
          return false;
        }

        return true;
      })
      .map((comp) => {
        // Apply preview updates if available
        const updatedPreview = previewUpdates[comp.id];
        if (updatedPreview) {
          return { ...comp, previewHtml: updatedPreview };
        }
        return comp;
      });
  }, [components, search, category, previewUpdates]);

  // Handle component selection
  const handleSelect = useCallback(
    (component: ComponentInfo) => {
      // Find by ID if available, otherwise by path+name
      const fullComponent = components.find((c) =>
        component.id ? c.id === component.id : c.filePath === component.filePath && c.componentName === component.componentName
      );
      if (!fullComponent) return;

      // Apply any preview updates
      const updated = previewUpdates[fullComponent.id]
        ? { ...fullComponent, previewHtml: previewUpdates[fullComponent.id] }
        : fullComponent;

      setSelectedComponent(updated);
      const initialProps = fullComponent.demoProps ?? {};
      setCurrentProps(initialProps);
    },
    [components, previewUpdates]
  );

  // Handle closing the detail panel
  const handleClose = useCallback(() => {
    setSelectedComponent(null);
    setCurrentProps({});
  }, []);

  // Handle props changes from the form
  const handlePropsChange = useCallback((newProps: Record<string, unknown>) => {
    setCurrentProps(newProps);
  }, []);

  // Handle preview regeneration
  const handlePreviewUpdate = useCallback((componentId: string, newHtml: string) => {
    setPreviewUpdates((prev) => ({ ...prev, [componentId]: newHtml }));
  }, []);

  // Generate selected component ID for grid highlighting (use database ID)
  const selectedId = selectedComponent?.id;

  return (
    <div className="flex h-full">
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filters */}
        <div className="border-b px-6 py-4">
          <ComponentFilters
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
            categories={categories}
            totalCount={components.length}
            filteredCount={filteredComponents.length}
          />
        </div>

        {/* Component Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <ComponentGrid
            components={filteredComponents}
            selectedId={selectedId}
            onSelect={handleSelect}
            onPreviewUpdate={handlePreviewUpdate}
          />
        </div>
      </div>

      {/* Detail Panel (sidebar) */}
      {selectedComponent && (
        <aside className="w-96 border-l bg-card flex flex-col overflow-hidden">
          <ComponentDetailPanel
            component={selectedComponent}
            currentProps={currentProps}
            onPropsChange={handlePropsChange}
            onClose={handleClose}
          />
        </aside>
      )}
    </div>
  );
}
