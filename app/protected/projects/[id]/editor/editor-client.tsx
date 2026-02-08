'use client';

/**
 * Editor client component.
 *
 * Orchestrates:
 * - Loading composition into Zustand store
 * - RemotionPreview for video preview
 * - PlaybackControls for play/pause/scrub
 * - Timeline for visual clip editing
 * - PropertiesPanel for selected item properties
 * - Auto-save with status indicator
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useCompositionStore } from '@/lib/composition';
import { useAutoSave, type SaveStatus } from '@/lib/composition/use-auto-save';
import type { Track, Scene } from '@/lib/composition/types';
import type { RemotionPreviewHandle } from '@/components/remotion/remotion-preview';
import { PlaybackControls } from '@/components/remotion/playback-controls';
import { Timeline } from './components/timeline';
import { PropertiesPanel } from './components/properties-panel';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import { Cloud, CloudOff, Loader2, Film, Blocks, SlidersHorizontal, Save } from 'lucide-react';
import type { PlayerRef } from '@remotion/player';
import { AssetImport } from './components/asset-panel/asset-import';
import { ComponentLibraryPanel } from './components/component-library-panel';
import { AiChatPanel } from './components/ai-chat-panel';
import { ExportDialog, type ExportQuality } from './components/export-dialog';
import { ExportProgress } from './components/export-progress';
import { startExport } from '@/lib/actions/export';

// Dynamic import with ssr:false for Remotion (requires browser APIs)
const RemotionPreview = dynamic(
  () =>
    import('@/components/remotion/remotion-preview').then(
      (mod) => mod.RemotionPreview
    ),
  { ssr: false, loading: () => <div className="flex-1 bg-black" /> }
);

// =============================================
// Types
// =============================================

interface EditorClientProps {
  composition: {
    id: string;
    projectId: string;
    name: string;
    tracks: Track[];
    scenes: Scene[];
    durationInFrames: number;
    fps: number;
    width: number;
    height: number;
  };
}

// =============================================
// Save Status Indicator
// =============================================

function SaveStatusIndicator({
  status,
  lastSaved,
  hasUnsavedChanges,
  onSave,
}: {
  status: SaveStatus;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Manual Save Button */}
      <button
        onClick={onSave}
        disabled={status === 'saving'}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors ${
          hasUnsavedChanges
            ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/30'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        } disabled:opacity-50`}
        title={hasUnsavedChanges ? 'Save changes (Ctrl+S)' : 'All changes saved'}
      >
        <Save className="h-3.5 w-3.5" />
        Save
      </button>

      {/* Status indicator */}
      {status === 'saving' && (
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Saving...</span>
        </div>
      )}

      {status === 'saved' && lastSaved && !hasUnsavedChanges && (
        <div className="flex items-center gap-1.5 text-green-600 text-sm">
          <Cloud className="h-3.5 w-3.5" />
          <span>Saved</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-1.5 text-destructive text-sm">
          <CloudOff className="h-3.5 w-3.5" />
          <span>Failed</span>
        </div>
      )}
    </div>
  );
}

// =============================================
// Component
// =============================================

export function EditorClient({ composition }: EditorClientProps) {
  useKeyboardShortcuts();
  const previewRef = useRef<RemotionPreviewHandle>(null);
  const loadComposition = useCompositionStore((s) => s.loadComposition);

  // Selection state - in store so preview renderers can read it
  const selectedItemId = useCompositionStore((s) => s.selectedItemId);
  const setSelectedItemId = useCompositionStore((s) => s.setSelectedItemId);

  // Sidebar tab state
  const [sidebarTab, setSidebarTab] = useState<'properties' | 'components'>('properties');

  // Export state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Check if composition has component items (for warning)
  const tracks = useCompositionStore((s) => s.tracks);
  const hasComponentItems = tracks.some((track) =>
    track.items.some((item) => item.type === 'component')
  );

  // Handle export start
  const handleExport = useCallback(
    async (quality: ExportQuality) => {
      setIsExporting(true);
      setShowExportDialog(false);

      const result = await startExport(composition.id, quality);

      if (result.error) {
        setIsExporting(false);
        setActiveJobId(null);
        // Show error in progress component by setting a temporary error job
        console.error('Export failed:', result.error);
        return;
      }

      if (result.jobId) {
        setActiveJobId(result.jobId);
      }
    },
    [composition.id]
  );

  // Handle export progress close
  const handleProgressClose = useCallback(() => {
    setActiveJobId(null);
    setIsExporting(false);
  }, []);

  // Track the actual PlayerRef separately to handle the dynamic import timing
  const [playerRef, setPlayerRef] = useState<React.RefObject<PlayerRef | null>>({
    current: null,
  });

  // Load composition into store on mount
  useEffect(() => {
    loadComposition({
      id: composition.id,
      projectId: composition.projectId,
      name: composition.name,
      tracks: composition.tracks,
      scenes: composition.scenes,
      durationInFrames: composition.durationInFrames,
      fps: composition.fps,
      width: composition.width,
      height: composition.height,
    });
  }, [composition, loadComposition]);

  // Auto-save disabled - use Ctrl+S for manual save
  const saveState = useAutoSave(composition.id, false);

  // Ctrl+S keyboard shortcut for manual save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveState.saveNow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveState.saveNow]);

  // Update playerRef when previewRef becomes available
  useEffect(() => {
    const checkPlayerRef = () => {
      if (previewRef.current?.playerRef) {
        setPlayerRef(previewRef.current.playerRef);
      }
    };

    // Check immediately
    checkPlayerRef();

    // Also check on a small delay for dynamic import timing
    const timeoutId = setTimeout(checkPlayerRef, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  // Use interval to check for playerRef availability after dynamic import
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (previewRef.current?.playerRef && playerRef.current === null) {
        setPlayerRef(previewRef.current.playerRef);
      }
    }, 50);

    // Clean up once we have the ref
    if (playerRef.current !== null) {
      clearInterval(intervalId);
    }

    return () => clearInterval(intervalId);
  }, [playerRef]);

  // Handle item selection
  const handleSelectItem = useCallback((itemId: string | null) => {
    setSelectedItemId(itemId);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header with save status */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background shrink-0">
        <h2 className="text-sm font-medium">Editor</h2>
        <div className="flex items-center gap-4">
          <AssetImport projectId={composition.projectId} />
          <button
            onClick={() => setShowExportDialog(true)}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Film className="h-4 w-4" />
            Export
          </button>
          <SaveStatusIndicator
            status={saveState.status}
            lastSaved={saveState.lastSaved}
            hasUnsavedChanges={saveState.hasUnsavedChanges}
            onSave={saveState.saveNow}
          />
        </div>
      </div>

      {/* Main content area - Preview + Properties */}
      <div className="flex-1 flex min-h-0">
        {/* Preview area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex items-center justify-center bg-neutral-900 p-4 min-h-0 overflow-hidden">
            <RemotionPreview ref={previewRef} />
          </div>

          {/* Playback controls */}
          <PlaybackControls playerRef={playerRef} />
        </div>

        {/* Right sidebar with tabs */}
        <div className="w-72 border-l bg-background shrink-0 overflow-hidden flex flex-col">
          {/* Tab buttons */}
          <div className="flex border-b shrink-0">
            <button
              onClick={() => setSidebarTab('properties')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                sidebarTab === 'properties'
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Properties
            </button>
            <button
              onClick={() => setSidebarTab('components')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                sidebarTab === 'components'
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Blocks className="h-3.5 w-3.5" />
              Components
            </button>
          </div>
          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {sidebarTab === 'properties' ? (
              <PropertiesPanel selectedItemId={selectedItemId} projectId={composition.projectId} />
            ) : (
              <ComponentLibraryPanel projectId={composition.projectId} />
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="shrink-0" style={{ height: '350px' }}>
        <Timeline
          selectedItemId={selectedItemId}
          onSelectItem={handleSelectItem}
        />
      </div>

      {/* AI Chat Panel */}
      <AiChatPanel />

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        onExport={handleExport}
        isExporting={isExporting}
        hasComponentItems={hasComponentItems}
      />

      {/* Export Progress */}
      <ExportProgress
        jobId={activeJobId}
        onClose={handleProgressClose}
        onRetry={() => setShowExportDialog(true)}
      />
    </div>
  );
}
