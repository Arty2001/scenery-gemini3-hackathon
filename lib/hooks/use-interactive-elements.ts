'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { InteractiveElement } from '@/lib/component-discovery/types';
import { useCompositionStore } from '@/lib/composition/store';

interface ComponentInteractiveElements {
  componentId: string;
  componentName: string;
  elements: InteractiveElement[];
}

/**
 * Hook to fetch and cache interactive elements for all components in the project.
 * Used by the cursor properties panel to show a dropdown of available selectors.
 */
export function useInteractiveElements() {
  const projectId = useCompositionStore((s) => s.projectId);
  const tracks = useCompositionStore((s) => s.tracks);

  const [components, setComponents] = useState<ComponentInteractiveElements[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedProjectIdRef = useRef<string | null>(null);

  // Fetch components with interactive elements
  const fetchComponents = useCallback(async () => {
    if (!projectId || fetchedProjectIdRef.current === projectId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/components`);
      if (!response.ok) throw new Error('Failed to fetch components');

      const data = await response.json();
      const componentsWithElements: ComponentInteractiveElements[] = data
        .filter((c: { interactiveElements?: InteractiveElement[] }) =>
          c.interactiveElements && c.interactiveElements.length > 0
        )
        .map((c: { id: string; componentName: string; interactiveElements: InteractiveElement[] }) => ({
          componentId: c.id,
          componentName: c.componentName,
          elements: c.interactiveElements,
        }));

      setComponents(componentsWithElements);
      fetchedProjectIdRef.current = projectId;
    } catch (error) {
      console.error('Failed to fetch component interactive elements:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  // Get all unique interactive elements across all components
  const allElements = components.flatMap((c) => c.elements);

  // Get elements for a specific component ID (if the cursor is targeting a specific component)
  const getElementsForComponent = useCallback(
    (componentId: string): InteractiveElement[] => {
      const comp = components.find((c) => c.componentId === componentId);
      return comp?.elements ?? [];
    },
    [components]
  );

  // Get component IDs that are currently in the composition
  const activeComponentIds = tracks
    .flatMap((t) => t.items)
    .filter((item) => item.type === 'component')
    .map((item) => (item as { componentId: string }).componentId);

  // Get elements only from components in the current composition
  const activeElements = components
    .filter((c) => activeComponentIds.includes(c.componentId))
    .flatMap((c) =>
      c.elements.map((el) => ({
        ...el,
        componentId: c.componentId,
        componentName: c.componentName,
      }))
    );

  return {
    components,
    allElements,
    activeElements,
    getElementsForComponent,
    isLoading,
    refresh: fetchComponents,
  };
}
