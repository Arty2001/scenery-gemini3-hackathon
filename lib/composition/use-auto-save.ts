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

export interface AutoSaveState {
  status: SaveStatus;
  lastSaved: Date | null;
  error?: string;
}

// =============================================
// Hook
// =============================================

export function useAutoSave(compositionId: string): AutoSaveState {
  const [saveState, setSaveState] = useState<AutoSaveState>({
    status: 'idle',
    lastSaved: null,
  });

  // Track previous serialized state to detect actual changes
  const previousStateRef = useRef<string>('');
  const compositionIdRef = useRef(compositionId);
  compositionIdRef.current = compositionId;

  // Subscribe to relevant state slices
  const tracks = useCompositionStore((s) => s.tracks);
  const name = useCompositionStore((s) => s.name);
  const durationInFrames = useCompositionStore((s) => s.durationInFrames);
  const fps = useCompositionStore((s) => s.fps);
  const width = useCompositionStore((s) => s.width);
  const height = useCompositionStore((s) => s.height);

  // Debounced save function with 1s debounce, 5s maxWait
  const debouncedSave = useDebouncedCallback(
    async () => {
      const currentState = JSON.stringify({
        name,
        tracks,
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
    debouncedSave();
  }, [tracks, name, durationInFrames, fps, width, height, debouncedSave]);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      debouncedSave.flush();
    };
  }, [debouncedSave]);

  return saveState;
}
