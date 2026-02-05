'use client';

import { useState, useEffect } from 'react';
import {
  Search, Plus, Loader2, Blocks, ChevronDown, ChevronRight,
  Type, Square, Circle, Minus, Palette, SeparatorHorizontal, Tag, Image,
  RefreshCw,
} from 'lucide-react';
import { regenerateComponentPreview } from '@/lib/actions/components';
import { useCompositionStore } from '@/lib/composition';
import type { ComponentWithId } from '@/lib/actions/components';
import type { ComponentItem } from '@/lib/composition/types';
import { BASE_ELEMENTS, createBaseElement, type BaseElementId } from '@/lib/composition/base-elements';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Type, Square, Circle, Minus, Palette, SeparatorHorizontal, Tag, Image,
};

interface ComponentLibraryPanelProps {
  projectId: string;
}

export function ComponentLibraryPanel({ projectId }: ComponentLibraryPanelProps) {
  const [components, setComponents] = useState<ComponentWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [basicsOpen, setBasicsOpen] = useState(true);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const tracks = useCompositionStore((s) => s.tracks);
  const addTrack = useCompositionStore((s) => s.addTrack);
  const addItem = useCompositionStore((s) => s.addItem);
  const currentFrame = useCompositionStore((s) => s.currentFrame);

  useEffect(() => {
    async function fetchComponents() {
      try {
        const res = await fetch(`/api/projects/${projectId}/components`);
        if (res.ok) {
          const data = await res.json();
          setComponents(data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchComponents();
  }, [projectId]);

  const filtered = search
    ? components.filter(
        (c) =>
          c.componentName.toLowerCase().includes(search.toLowerCase()) ||
          c.description?.toLowerCase().includes(search.toLowerCase()) ||
          c.category?.toLowerCase().includes(search.toLowerCase())
      )
    : components;

  const filteredBaseElements = search
    ? BASE_ELEMENTS.filter(
        (el) =>
          el.label.toLowerCase().includes(search.toLowerCase()) ||
          el.description.toLowerCase().includes(search.toLowerCase()) ||
          el.category.toLowerCase().includes(search.toLowerCase())
      )
    : BASE_ELEMENTS;

  const handleRegeneratePreview = async (e: React.MouseEvent, componentId: string) => {
    e.stopPropagation(); // Don't trigger add component
    setRegeneratingId(componentId);
    try {
      const result = await regenerateComponentPreview(componentId);
      if (result.success && result.previewHtml) {
        // Update local state with new preview
        setComponents(prev => prev.map(c =>
          c.id === componentId ? { ...c, previewHtml: result.previewHtml } : c
        ));
      } else {
        console.error('Regenerate failed:', result.error);
      }
    } catch (err) {
      console.error('Regenerate error:', err);
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleAddComponent = (component: ComponentWithId) => {
    // Create a new track for each component (same as AI behavior)
    addTrack({
      name: component.displayName ?? component.componentName,
      type: 'component',
      locked: false,
      visible: true,
      items: [],
    });
    const newTrack = useCompositionStore.getState().tracks[
      useCompositionStore.getState().tracks.length - 1
    ];
    if (!newTrack) return;

    addItem(newTrack.id, {
      type: 'component',
      componentId: component.id,
      props: component.demoProps ?? {},
      from: currentFrame,
      durationInFrames: 150,
    } as Omit<ComponentItem, 'id'>);
  };

  const handleAddBaseElement = (elementId: BaseElementId) => {
    const result = createBaseElement(elementId, currentFrame);
    addTrack({
      name: result.trackName,
      type: result.trackType,
      locked: false,
      visible: true,
      items: [],
    });
    const newTrack = useCompositionStore.getState().tracks[
      useCompositionStore.getState().tracks.length - 1
    ];
    if (newTrack) {
      addItem(newTrack.id, result.item as Parameters<typeof addItem>[1]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search elements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-background pl-7 pr-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Basics section */}
        {filteredBaseElements.length > 0 && (
          <div>
            <button
              onClick={() => setBasicsOpen(!basicsOpen)}
              className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              {basicsOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Basics
            </button>
            {basicsOpen && (
              <div className="grid grid-cols-4 gap-1 px-2 pb-2">
                {filteredBaseElements.map((el) => {
                  const IconComp = ICON_MAP[el.icon];
                  return (
                    <button
                      key={el.id}
                      onClick={() => handleAddBaseElement(el.id)}
                      className="flex flex-col items-center gap-1 rounded-md p-2 hover:bg-accent/50 transition-colors cursor-pointer group"
                      title={el.description}
                    >
                      {IconComp && (
                        <IconComp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      )}
                      <span className="text-[9px] text-muted-foreground group-hover:text-foreground transition-colors leading-tight">
                        {el.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="border-b" />
          </div>
        )}

        {/* Repo components section */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : components.length > 0 ? (
          <>
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Repository Components
            </div>
            {filtered.map((comp) => (
              <div
                key={comp.id}
                className="group flex items-start gap-3 p-2 hover:bg-accent/50 cursor-pointer border-b border-border/50"
                onClick={() => handleAddComponent(comp)}
              >
                <div className="w-16 h-10 rounded border bg-white flex-shrink-0 overflow-hidden relative">
                  {comp.previewHtml ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: comp.previewHtml }}
                      className="absolute inset-0 origin-top-left"
                      style={{
                        width: '400%',
                        height: '400%',
                        transform: 'scale(0.25)',
                        overflow: 'hidden',
                        pointerEvents: 'none',
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Blocks className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate">
                      {comp.displayName ?? comp.componentName}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => handleRegeneratePreview(e, comp.id)}
                        disabled={regeneratingId === comp.id}
                        className="p-0.5 rounded hover:bg-accent"
                        title="Regenerate preview"
                      >
                        <RefreshCw className={`h-3 w-3 text-muted-foreground ${regeneratingId === comp.id ? 'animate-spin' : ''}`} />
                      </button>
                      <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  {comp.category && (
                    <span className="text-[10px] text-muted-foreground">
                      {comp.category}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <Blocks className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs">Connect a repo to discover components.</p>
          </div>
        )}
      </div>
    </div>
  );
}
