'use client';

/**
 * Zustand store for composition state management.
 * Provides centralized state for the video composition editor.
 * Uses immer middleware for immutable state updates.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import type { Composition, Track, TimelineItem } from './types';

// =============================================
// Store State Interface
// =============================================

interface CompositionState {
  // Core composition fields
  id: string;
  projectId: string;
  name: string;
  tracks: Track[];
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;

  // Playback state
  currentFrame: number;
  isPlaying: boolean;

  // Selection state (for preview outline)
  selectedItemId: string | null;

  // Preview refresh key (increment to trigger re-fetch of component previews)
  previewRefreshKey: number;
}

// =============================================
// Store Actions Interface
// =============================================

interface CompositionActions {
  // Track operations
  addTrack: (track: Omit<Track, 'id'>) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  reorderTrack: (trackId: string, newIndex: number) => void;

  // Item operations
  addItem: (trackId: string, item: Omit<TimelineItem, 'id'>) => void;
  updateItem: (
    trackId: string,
    itemId: string,
    updates: Partial<TimelineItem>
  ) => void;
  removeItem: (trackId: string, itemId: string) => void;
  moveItem: (
    fromTrackId: string,
    toTrackId: string,
    itemId: string,
    newFrom?: number
  ) => void;

  // Playback
  setCurrentFrame: (frame: number) => void;
  setIsPlaying: (playing: boolean) => void;

  // Selection
  setSelectedItemId: (itemId: string | null) => void;

  // Composition metadata
  setDuration: (frames: number) => void;
  setFps: (fps: number) => void;
  setName: (name: string) => void;
  setDimensions: (width: number, height: number) => void;

  // Serialization
  loadComposition: (composition: Partial<Composition>) => void;
  getSerializedState: () => Omit<Composition, 'createdAt' | 'updatedAt'>;

  // Preview refresh (call after sync to re-fetch component HTML)
  refreshPreviews: () => void;
}

// =============================================
// Combined Store Type
// =============================================

type CompositionStore = CompositionState & CompositionActions;

// =============================================
// Initial State
// =============================================

const initialState: CompositionState = {
  id: '',
  projectId: '',
  name: 'Untitled Composition',
  tracks: [],
  durationInFrames: 900, // 30 seconds at 30fps
  fps: 30,
  width: 1920,
  height: 1080,
  currentFrame: 0,
  isPlaying: false,
  selectedItemId: null,
  previewRefreshKey: 0,
};

// =============================================
// Store Implementation
// =============================================

export const useCompositionStore = create<CompositionStore>()(
  temporal(
  immer((set, get) => ({
    // Initial state spread
    ...initialState,

    // =============================================
    // Track Operations
    // =============================================

    addTrack: (track) => {
      set((state) => {
        const newTrack: Track = {
          ...track,
          id: crypto.randomUUID(),
        };
        state.tracks.push(newTrack);
      });
    },

    removeTrack: (trackId) => {
      set((state) => {
        state.tracks = state.tracks.filter((t) => t.id !== trackId);
      });
    },

    updateTrack: (trackId, updates) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          Object.assign(track, updates);
        }
      });
    },

    reorderTrack: (trackId, newIndex) => {
      set((state) => {
        const oldIndex = state.tracks.findIndex((t) => t.id === trackId);
        if (oldIndex === -1 || oldIndex === newIndex) return;
        const clamped = Math.max(0, Math.min(newIndex, state.tracks.length - 1));
        const [track] = state.tracks.splice(oldIndex, 1);
        state.tracks.splice(clamped, 0, track);
      });
    },

    // =============================================
    // Item Operations
    // =============================================

    addItem: (trackId, item) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          const newItem = {
            ...item,
            id: crypto.randomUUID(),
          } as TimelineItem;
          track.items.push(newItem);
        }
      });
    },

    updateItem: (trackId, itemId, updates) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          const item = track.items.find((i) => i.id === itemId);
          if (item) {
            Object.assign(item, updates);
          }
        }
      });
    },

    removeItem: (trackId, itemId) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          track.items = track.items.filter((i) => i.id !== itemId);
        }
      });
    },

    moveItem: (fromTrackId, toTrackId, itemId, newFrom) => {
      set((state) => {
        const fromTrack = state.tracks.find((t) => t.id === fromTrackId);
        const toTrack = state.tracks.find((t) => t.id === toTrackId);

        if (fromTrack && toTrack) {
          const itemIndex = fromTrack.items.findIndex((i) => i.id === itemId);
          if (itemIndex !== -1) {
            // Remove from source track
            const [item] = fromTrack.items.splice(itemIndex, 1);

            // Update position if provided
            if (newFrom !== undefined) {
              item.from = newFrom;
            }

            // Add to destination track
            toTrack.items.push(item);
          }
        }
      });
    },

    // =============================================
    // Playback
    // =============================================

    setCurrentFrame: (frame) => {
      set((state) => {
        state.currentFrame = Math.max(0, Math.min(frame, state.durationInFrames - 1));
      });
    },

    setIsPlaying: (playing) => {
      set((state) => {
        state.isPlaying = playing;
      });
    },

    setSelectedItemId: (itemId) => {
      set((state) => {
        state.selectedItemId = itemId;
      });
    },

    // =============================================
    // Composition Metadata
    // =============================================

    setDuration: (frames) => {
      set((state) => {
        state.durationInFrames = Math.max(1, frames);
      });
    },

    setFps: (fps) => {
      set((state) => {
        state.fps = Math.max(1, fps);
      });
    },

    setName: (name) => {
      set((state) => {
        state.name = name;
      });
    },

    setDimensions: (width, height) => {
      set((state) => {
        state.width = Math.max(1, width);
        state.height = Math.max(1, height);
      });
    },

    // =============================================
    // Serialization
    // =============================================

    loadComposition: (composition) => {
      set((state) => {
        if (composition.id !== undefined) state.id = composition.id;
        if (composition.projectId !== undefined) state.projectId = composition.projectId;
        if (composition.name !== undefined) state.name = composition.name;
        if (composition.tracks !== undefined) {
          state.tracks = composition.tracks.map((track) => ({
            ...track,
            id: track.id || crypto.randomUUID(),
            items: track.items.map((item) => ({
              ...item,
              id: item.id || crypto.randomUUID(),
            })),
          }));
        }
        if (composition.durationInFrames !== undefined) {
          state.durationInFrames = composition.durationInFrames;
        }
        if (composition.fps !== undefined) state.fps = composition.fps;
        if (composition.width !== undefined) state.width = composition.width;
        if (composition.height !== undefined) state.height = composition.height;

        // Reset playback state when loading
        state.currentFrame = 0;
        state.isPlaying = false;
      });
    },

    getSerializedState: () => {
      const state = get();
      return {
        id: state.id,
        projectId: state.projectId,
        name: state.name,
        tracks: state.tracks,
        durationInFrames: state.durationInFrames,
        fps: state.fps,
        width: state.width,
        height: state.height,
      };
    },

    // =============================================
    // Preview Refresh
    // =============================================

    refreshPreviews: () => {
      set((state) => {
        state.previewRefreshKey += 1;
      });
    },
  })),
  {
    partialize: (state) => {
      const { currentFrame, isPlaying, ...rest } = state;
      return rest;
    },
    limit: 50,
  },
  )
);

// =============================================
// Temporal History Helpers
// =============================================

/**
 * Pause history tracking. Call before drag operations
 * so intermediate states are not recorded.
 */
export function pauseHistory() {
  useCompositionStore.temporal.getState().pause();
}

/**
 * Resume history tracking. Call after drag operations
 * so the final state is recorded as a single undo entry.
 */
export function resumeHistory() {
  useCompositionStore.temporal.getState().resume();
}
