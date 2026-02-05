'use client';

/**
 * Hook for managing timeline zoom state.
 * Zoom is UI-only state, not stored in composition.
 */

import { useState, useCallback, type WheelEvent } from 'react';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10;
export const DEFAULT_ZOOM = 1;
const ZOOM_STEP = 0.1;
const BASE_PIXELS_PER_FRAME = 2;

export interface UseTimelineZoomReturn {
  /** Current zoom level (1 = 100%) */
  zoom: number;
  /** Pixels per frame at current zoom */
  pixelsPerFrame: number;
  /** Set zoom to specific value */
  setZoom: (zoom: number) => void;
  /** Increase zoom by one step */
  zoomIn: () => void;
  /** Decrease zoom by one step */
  zoomOut: () => void;
  /** Fit entire composition in view */
  fitToView: (containerWidth: number, durationInFrames: number) => void;
  /** Handle wheel events for zoom (Ctrl+scroll) */
  handleWheel: (e: WheelEvent) => void;
}

export function useTimelineZoom(): UseTimelineZoomReturn {
  const [zoom, setZoomState] = useState(DEFAULT_ZOOM);

  const pixelsPerFrame = BASE_PIXELS_PER_FRAME * zoom;

  const setZoom = useCallback((value: number) => {
    setZoomState(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)));
  }, []);

  const zoomIn = useCallback(() => {
    setZoomState((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomState((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const fitToView = useCallback(
    (containerWidth: number, durationInFrames: number) => {
      if (durationInFrames <= 0 || containerWidth <= 0) return;

      const requiredPixelsPerFrame = containerWidth / durationInFrames;
      const newZoom = requiredPixelsPerFrame / BASE_PIXELS_PER_FRAME;
      setZoomState(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom)));
    },
    []
  );

  const handleWheel = useCallback((e: WheelEvent) => {
    // Only zoom on Ctrl+scroll or Meta+scroll
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoomState((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
    }
  }, []);

  return {
    zoom,
    pixelsPerFrame,
    setZoom,
    zoomIn,
    zoomOut,
    fitToView,
    handleWheel,
  };
}
