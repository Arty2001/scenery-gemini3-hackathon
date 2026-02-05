'use client';

import { useEffect } from 'react';
import { useCompositionStore } from '@/lib/composition/store';

/**
 * Global keyboard shortcuts for the editor.
 *
 * - Space: toggle play/pause
 * - ArrowLeft: back 1 frame (Shift = 1 second)
 * - ArrowRight: forward 1 frame (Shift = 1 second)
 * - Ctrl/Cmd+Z: undo
 * - Ctrl/Cmd+Shift+Z: redo
 *
 * Shortcuts are suppressed when focus is inside an input, textarea, or select.
 */
export function useKeyboardShortcuts() {
  const isPlaying = useCompositionStore((s) => s.isPlaying);
  const setIsPlaying = useCompositionStore((s) => s.setIsPlaying);
  const currentFrame = useCompositionStore((s) => s.currentFrame);
  const setCurrentFrame = useCompositionStore((s) => s.setCurrentFrame);
  const fps = useCompositionStore((s) => s.fps);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when typing in form fields
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd+Shift+Z → redo (check before plain Ctrl+Z)
      if (ctrlOrMeta && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        useCompositionStore.temporal.getState().redo();
        return;
      }

      // Ctrl/Cmd+Z → undo
      if (ctrlOrMeta && e.key === 'z') {
        e.preventDefault();
        useCompositionStore.temporal.getState().undo();
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentFrame(Math.max(0, currentFrame - (e.shiftKey ? fps : 1)));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setCurrentFrame(currentFrame + (e.shiftKey ? fps : 1));
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPlaying, currentFrame, fps, setIsPlaying, setCurrentFrame]);
}
