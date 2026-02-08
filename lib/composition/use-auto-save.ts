'use client';

/**
 * Auto-save hook for composition state.
 *
 * Features:
 * - 1 second debounce with 5 second maxWait
 * - Tracks previous state to skip no-op saves
 * - Flushes on unmount
 * - Returns status for UI feedback
 */

import { useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useCompositionStore } from './store';
import { saveComposition } from '@/lib/actions/compositions';

// =============================================
// Types
// =============================================

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AutoSaveResult {
  status: SaveStatus;
  lastSaved: Date | null;
  error?: string;
  /** Manually trigger an immediate save */
  saveNow: () => Promise<void>;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
}

// =============================================
// Hook
// =============================================

export function useAutoSave(compositionId: string, enabled: boolean = true): AutoSaveResult {
  const [saveState, setSaveState] = useState<{
    status: SaveStatus;
    lastSaved: Date | null;
    error?: string;
  }>({
    status: 'idle',
    lastSaved: null,
  });

  // Track if there are unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track previous serialized state to detect actual changes
  const previousStateRef = useRef<string>('');
  const compositionIdRef = useRef(compositionId);
  compositionIdRef.current = compositionId;

  // Subscribe to relevant state slices
  const tracks = useCompositionStore((s) => s.tracks);
  const scenes = useCompositionStore((s) => s.scenes);
  const name = useCompositionStore((s) => s.name);
  const durationInFrames = useCompositionStore((s) => s.durationInFrames);
  const fps = useCompositionStore((s) => s.fps);
  const width = useCompositionStore((s) => s.width);
  const height = useCompositionStore((s) => s.height);

  // Track if composition has been loaded from database
  const hasLoadedRef = useRef(false);
  const storeId = useCompositionStore((s) => s.id);

  // Mark as loaded once we have a valid composition ID in store
  useEffect(() => {
    if (storeId && storeId === compositionId) {
      hasLoadedRef.current = true;
    }
  }, [storeId, compositionId]);

  // Debounced save function with 1s debounce, 5s maxWait
  const debouncedSave = useDebouncedCallback(
    async () => {
      // SAFETY: Don't save empty tracks if we had content before
      // This prevents hot reload from wiping saved data
      const hadContent = previousStateRef.current &&
        JSON.parse(previousStateRef.current).tracks?.length > 0;
      const hasNoContent = !tracks || tracks.length === 0 ||
        tracks.every(t => t.items.length === 0);

      if (hadContent && hasNoContent) {
        console.warn('[AutoSave] Blocked save of empty tracks - likely hot reload reset');
        return;
      }

      // Also block if composition hasn't been loaded yet
      if (!hasLoadedRef.current) {
        console.warn('[AutoSave] Blocked save before composition loaded');
        return;
      }

      const currentState = JSON.stringify({
        name,
        tracks,
        scenes,
        durationInFrames,
        fps,
        width,
        height,
      });

      // Skip if no changes
      if (currentState === previousStateRef.current) {
        return;
      }

      previousStateRef.current = currentState;
      setSaveState((s) => ({ ...s, status: 'saving' }));

      try {
        const result = await saveComposition(compositionIdRef.current, {
          name,
          tracks,
          scenes,
          durationInFrames,
          fps,
          width,
          height,
        });

        if (result.success) {
          setSaveState({
            status: 'saved',
            lastSaved: new Date(),
          });
          setHasUnsavedChanges(false);
        } else {
          setSaveState({
            status: 'error',
            lastSaved: null,
            error: result.error ?? 'Save failed',
          });
        }
      } catch (error) {
        setSaveState({
          status: 'error',
          lastSaved: null,
          error: error instanceof Error ? error.message : 'Save failed',
        });
      }
    },
    1000, // 1 second debounce
    { maxWait: 5000 } // Force save after 5 seconds of continuous changes
  );

  // Trigger save when relevant state changes
  useEffect(() => {
    // Mark as having unsaved changes when state differs from last saved
    const currentState = JSON.stringify({
      name,
      tracks,
      scenes,
      durationInFrames,
      fps,
      width,
      height,
    });
    if (previousStateRef.current && currentState !== previousStateRef.current) {
      setHasUnsavedChanges(true);
    }
    // Only auto-save if enabled
    if (enabled) {
      debouncedSave();
    }
  }, [tracks, scenes, name, durationInFrames, fps, width, height, debouncedSave, enabled]);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      debouncedSave.flush();
    };
  }, [debouncedSave]);

  // Manual save function - immediately saves without debounce
  const saveNow = async () => {
    // Cancel any pending debounced save
    debouncedSave.cancel();

    // Block if not loaded
    if (!hasLoadedRef.current) {
      console.warn('[ManualSave] Blocked - composition not loaded');
      return;
    }

    const currentState = JSON.stringify({
      name,
      tracks,
      scenes,
      durationInFrames,
      fps,
      width,
      height,
    });

    // Skip if no changes
    if (currentState === previousStateRef.current) {
      setSaveState((s) => ({ ...s, status: 'saved' }));
      return;
    }

    previousStateRef.current = currentState;
    setSaveState((s) => ({ ...s, status: 'saving' }));

    try {
      const result = await saveComposition(compositionIdRef.current, {
        name,
        tracks,
        scenes,
        durationInFrames,
        fps,
        width,
        height,
      });

      if (result.success) {
        setSaveState({
          status: 'saved',
          lastSaved: new Date(),
        });
        setHasUnsavedChanges(false);
      } else {
        setSaveState({
          status: 'error',
          lastSaved: saveState.lastSaved,
          error: result.error ?? 'Save failed',
        });
      }
    } catch (error) {
      setSaveState({
        status: 'error',
        lastSaved: saveState.lastSaved,
        error: error instanceof Error ? error.message : 'Save failed',
      });
    }
  };

  return {
    status: saveState.status,
    lastSaved: saveState.lastSaved,
    error: saveState.error,
    saveNow,
    hasUnsavedChanges,
  };
}
