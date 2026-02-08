'use client';

/**
 * Zustand store for composition state management.
 * Provides centralized state for the video composition editor.
 * Uses immer middleware for immutable state updates.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import type { Composition, Track, TimelineItem, Scene, TransitionConfig } from './types';

// =============================================
// Track Layer Priority (for z-ordering)
// =============================================

/**
 * Track layer priority for automatic z-ordering.
 * Lower numbers render FIRST (bottom layer), higher numbers render LAST (top layer).
 */
function getTrackLayerPriority(type: string): number {
  switch (type) {
    case 'gradient':
    case 'blob':
      return 0; // Background effects at bottom
    case 'film-grain':
    case 'vignette':
    case 'color-grade':
      return 1; // Post-processing effects
    case 'video':
    case 'image':
      return 2; // Media
    case 'component':
    case 'custom-html':
      return 3; // Components
    case 'shape':
      return 4; // Shapes
    case 'text':
      return 5; // Text overlays
    case 'particles':
      return 6; // Particles
    case 'cursor':
      return 7; // Cursor always on top
    case 'audio':
      return 8; // Audio has no visual
    default:
      return 5; // Default to middle
  }
}

/**
 * Find the correct index to insert a track based on its type for proper layering.
 */
function findTrackInsertIndex(tracks: { type: string }[], newType: string): number {
  const newPriority = getTrackLayerPriority(newType);
  for (let i = 0; i < tracks.length; i++) {
    if (getTrackLayerPriority(tracks[i].type) > newPriority) {
      return i;
    }
  }
  return tracks.length;
}

// =============================================
// Store State Interface
// =============================================

interface CompositionState {
  // Core composition fields
  id: string;
  projectId: string;
  name: string;
  tracks: Track[];
  scenes: Scene[];  // Scenes for slide-based editing
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;

  // Playback state
  currentFrame: number;
  isPlaying: boolean;

  // Selection state (for preview outline)
  selectedItemId: string | null;
  selectedItemIds: string[];  // Multi-selection support
  selectedSceneId: string | null;  // Currently selected scene

  // Preview refresh key (increment to trigger re-fetch of component previews)
  previewRefreshKey: number;

  // Clipboard for copy/paste
  clipboard: TimelineItem[];
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

  // Scene operations
  addScene: (scene: Omit<Scene, 'id'>) => string;  // Returns new scene ID
  removeScene: (sceneId: string) => void;
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;
  reorderScene: (sceneId: string, newIndex: number) => void;
  setSceneTransition: (sceneId: string, transition: TransitionConfig | undefined) => void;
  setSelectedSceneId: (sceneId: string | null) => void;
  getSceneAtFrame: (frame: number) => Scene | undefined;
  assignItemToScene: (trackId: string, itemId: string, sceneId: string | undefined) => void;

  // Playback
  setCurrentFrame: (frame: number) => void;
  setIsPlaying: (playing: boolean) => void;

  // Selection
  setSelectedItemId: (itemId: string | null) => void;
  toggleItemSelection: (itemId: string, addToSelection?: boolean) => void;
  addToSelection: (itemId: string) => void;
  removeFromSelection: (itemId: string) => void;
  clearSelection: () => void;
  selectItems: (itemIds: string[]) => void;

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

  // Clipboard operations
  copySelectedItems: () => void;
  cutSelectedItems: () => void;
  pasteItems: (targetFrame: number) => void;
  duplicateSelectedItems: () => void;
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
  scenes: [],
  durationInFrames: 900, // 30 seconds at 30fps
  fps: 30,
  width: 1920,
  height: 1080,
  currentFrame: 0,
  isPlaying: false,
  selectedItemId: null,
  selectedItemIds: [],
  selectedSceneId: null,
  previewRefreshKey: 0,
  clipboard: [],
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
    // Scene Operations
    // =============================================

    addScene: (scene) => {
      const newId = crypto.randomUUID();
      set((state) => {
        const newScene: Scene = {
          ...scene,
          id: newId,
        };
        state.scenes.push(newScene);
        // Sort scenes by startFrame
        state.scenes.sort((a, b) => a.startFrame - b.startFrame);
      });
      return newId;
    },

    removeScene: (sceneId) => {
      set((state) => {
        state.scenes = state.scenes.filter((s) => s.id !== sceneId);
        // Clear selection if removed scene was selected
        if (state.selectedSceneId === sceneId) {
          state.selectedSceneId = null;
        }
        // Clear sceneId from any items that referenced this scene
        state.tracks.forEach((track) => {
          track.items.forEach((item) => {
            if (item.sceneId === sceneId) {
              item.sceneId = undefined;
            }
          });
        });
      });
    },

    updateScene: (sceneId, updates) => {
      set((state) => {
        const scene = state.scenes.find((s) => s.id === sceneId);
        if (scene) {
          Object.assign(scene, updates);
          // Re-sort if startFrame changed
          if (updates.startFrame !== undefined) {
            state.scenes.sort((a, b) => a.startFrame - b.startFrame);
          }
        }
      });
    },

    reorderScene: (sceneId, newIndex) => {
      set((state) => {
        const oldIndex = state.scenes.findIndex((s) => s.id === sceneId);
        if (oldIndex === -1 || oldIndex === newIndex) return;
        const clamped = Math.max(0, Math.min(newIndex, state.scenes.length - 1));
        const [scene] = state.scenes.splice(oldIndex, 1);
        state.scenes.splice(clamped, 0, scene);
        // Recalculate startFrames after reorder
        let runningFrame = 0;
        state.scenes.forEach((s) => {
          s.startFrame = runningFrame;
          runningFrame += s.durationInFrames;
        });
      });
    },

    setSceneTransition: (sceneId, transition) => {
      set((state) => {
        const scene = state.scenes.find((s) => s.id === sceneId);
        if (scene) {
          scene.transition = transition;
        }
      });
    },

    setSelectedSceneId: (sceneId) => {
      set((state) => {
        state.selectedSceneId = sceneId;
      });
    },

    getSceneAtFrame: (frame) => {
      const state = get();
      return state.scenes.find(
        (s) => frame >= s.startFrame && frame < s.startFrame + s.durationInFrames
      );
    },

    assignItemToScene: (trackId, itemId, sceneId) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          const item = track.items.find((i) => i.id === itemId);
          if (item) {
            item.sceneId = sceneId;
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
        // Also update multi-selection: single click replaces selection
        state.selectedItemIds = itemId ? [itemId] : [];
      });
    },

    toggleItemSelection: (itemId, addToSelection = false) => {
      set((state) => {
        if (addToSelection) {
          // Ctrl/Cmd+click: toggle item in selection
          const index = state.selectedItemIds.indexOf(itemId);
          if (index >= 0) {
            state.selectedItemIds.splice(index, 1);
            // Update primary selection to last selected or null
            state.selectedItemId = state.selectedItemIds.length > 0
              ? state.selectedItemIds[state.selectedItemIds.length - 1]
              : null;
          } else {
            state.selectedItemIds.push(itemId);
            state.selectedItemId = itemId;
          }
        } else {
          // Normal click: replace selection
          state.selectedItemIds = [itemId];
          state.selectedItemId = itemId;
        }
      });
    },

    addToSelection: (itemId) => {
      set((state) => {
        if (!state.selectedItemIds.includes(itemId)) {
          state.selectedItemIds.push(itemId);
          state.selectedItemId = itemId;
        }
      });
    },

    removeFromSelection: (itemId) => {
      set((state) => {
        const index = state.selectedItemIds.indexOf(itemId);
        if (index >= 0) {
          state.selectedItemIds.splice(index, 1);
          state.selectedItemId = state.selectedItemIds.length > 0
            ? state.selectedItemIds[state.selectedItemIds.length - 1]
            : null;
        }
      });
    },

    clearSelection: () => {
      set((state) => {
        state.selectedItemIds = [];
        state.selectedItemId = null;
      });
    },

    selectItems: (itemIds) => {
      set((state) => {
        state.selectedItemIds = [...itemIds];
        state.selectedItemId = itemIds.length > 0 ? itemIds[itemIds.length - 1] : null;
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
        if (composition.scenes !== undefined) {
          state.scenes = composition.scenes.map((scene) => ({
            ...scene,
            id: scene.id || crypto.randomUUID(),
          }));
          // Sort scenes by startFrame
          state.scenes.sort((a, b) => a.startFrame - b.startFrame);
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
        state.selectedSceneId = null;
      });
    },

    getSerializedState: () => {
      const state = get();
      return {
        id: state.id,
        projectId: state.projectId,
        name: state.name,
        tracks: state.tracks,
        scenes: state.scenes.length > 0 ? state.scenes : undefined,
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

    // =============================================
    // Clipboard Operations
    // =============================================

    copySelectedItems: () => {
      const state = get();
      const items: TimelineItem[] = [];

      // Find all selected items across tracks
      for (const track of state.tracks) {
        for (const item of track.items) {
          if (state.selectedItemIds.includes(item.id)) {
            // Deep clone the item to avoid reference issues
            items.push(JSON.parse(JSON.stringify(item)));
          }
        }
      }

      if (items.length > 0) {
        set((s) => {
          s.clipboard = items;
        });
      }
    },

    cutSelectedItems: () => {
      const state = get();
      const items: TimelineItem[] = [];

      // Find and collect all selected items
      for (const track of state.tracks) {
        for (const item of track.items) {
          if (state.selectedItemIds.includes(item.id)) {
            items.push(JSON.parse(JSON.stringify(item)));
          }
        }
      }

      if (items.length > 0) {
        set((s) => {
          s.clipboard = items;
          // Remove items from tracks
          for (const track of s.tracks) {
            track.items = track.items.filter(
              (item) => !state.selectedItemIds.includes(item.id)
            );
          }
          // Clear selection
          s.selectedItemIds = [];
          s.selectedItemId = null;
        });
      }
    },

    pasteItems: (targetFrame: number) => {
      const state = get();
      if (state.clipboard.length === 0) return;

      // Find the earliest start frame in the clipboard
      const minFrom = Math.min(...state.clipboard.map((item) => item.from));
      const offset = targetFrame - minFrom;

      set((s) => {
        const newItemIds: string[] = [];

        // Create a NEW track for EACH item (not grouped by type)
        for (const clipboardItem of state.clipboard) {
          const itemType = clipboardItem.type;
          const trackName = `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} (pasted)`;
          const newTrack: Track = {
            id: crypto.randomUUID(),
            name: trackName,
            type: itemType as Track['type'],
            locked: false,
            visible: true,
            items: [],
          };

          // Find correct insertion index for proper layering
          const insertIndex = findTrackInsertIndex(s.tracks, itemType);
          s.tracks.splice(insertIndex, 0, newTrack);

          // Create new item with new ID and adjusted timing
          const newItem = {
            ...JSON.parse(JSON.stringify(clipboardItem)),
            id: crypto.randomUUID(),
            from: Math.max(0, clipboardItem.from + offset),
          };
          // Clear scene assignment for pasted items
          delete newItem.sceneId;
          newTrack.items.push(newItem);
          newItemIds.push(newItem.id);
        }

        // Select the newly pasted items
        s.selectedItemIds = newItemIds;
        s.selectedItemId = newItemIds.length > 0 ? newItemIds[newItemIds.length - 1] : null;
      });
    },

    duplicateSelectedItems: () => {
      const state = get();
      if (state.selectedItemIds.length === 0) return;

      // First copy the selected items
      get().copySelectedItems();

      // Then paste at the same position with a small offset
      const minFrom = Math.min(
        ...state.tracks.flatMap((t) =>
          t.items
            .filter((i) => state.selectedItemIds.includes(i.id))
            .map((i) => i.from)
        )
      );

      // Paste with a small frame offset (10 frames = ~0.33s at 30fps)
      get().pasteItems(minFrom + 10);
    },
  })),
  {
    partialize: (state) => {
      // Exclude transient state from undo history
      const { currentFrame, isPlaying, selectedSceneId, selectedItemId, selectedItemIds, previewRefreshKey, clipboard, ...rest } = state;
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
