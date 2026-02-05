'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { InteractiveElement } from '@/lib/component-discovery/types';
import { extractInteractiveElements } from '@/lib/component-discovery/extract-interactive-elements';

interface ElementRect {
  element: InteractiveElement;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

interface ElementPickerOverlayProps {
  /** The container element that contains the preview HTML */
  containerRef: React.RefObject<HTMLElement>;
  /** Whether the picker is active */
  isActive: boolean;
  /** Callback when an element is selected */
  onSelect: (element: InteractiveElement) => void;
  /** Callback to close the picker */
  onClose: () => void;
}

/**
 * Overlay that highlights interactive elements in a component preview
 * and allows clicking to select them for cursor interactions.
 */
export function ElementPickerOverlay({
  containerRef,
  isActive,
  onSelect,
  onClose,
}: ElementPickerOverlayProps) {
  const [elementRects, setElementRects] = useState<ElementRect[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Find and measure interactive elements in the preview
  const scanElements = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const html = container.innerHTML;
    const interactiveElements = extractInteractiveElements(html);

    // For each interactive element, try to find it in the DOM and measure its position
    const rects: ElementRect[] = [];

    for (const element of interactiveElements) {
      try {
        // Find the actual DOM element using the selector
        const domElement = container.querySelector(element.selector);
        if (domElement) {
          const containerRect = container.getBoundingClientRect();
          const elementRect = domElement.getBoundingClientRect();

          // Calculate position relative to the container
          rects.push({
            element,
            rect: {
              left: elementRect.left - containerRect.left,
              top: elementRect.top - containerRect.top,
              width: elementRect.width,
              height: elementRect.height,
            },
          });
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }

    setElementRects(rects);
  }, [containerRef]);

  // Re-scan when becoming active or container changes
  useEffect(() => {
    if (isActive) {
      scanElements();

      // Also observe for resize/mutations
      const observer = new ResizeObserver(() => {
        scanElements();
      });

      if (containerRef.current) {
        observer.observe(containerRef.current);
      }

      return () => observer.disconnect();
    }
  }, [isActive, scanElements, containerRef]);

  if (!isActive || elementRects.length === 0) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 z-40 cursor-crosshair"
        onClick={onClose}
      />

      {/* Element highlights */}
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none z-50">
        {elementRects.map((item, index) => (
          <div
            key={index}
            className={`absolute pointer-events-auto cursor-pointer transition-all ${
              hoveredIndex === index
                ? 'ring-2 ring-primary ring-offset-2 bg-primary/20'
                : 'ring-1 ring-primary/50 bg-primary/10'
            }`}
            style={{
              left: item.rect.left,
              top: item.rect.top,
              width: item.rect.width,
              height: item.rect.height,
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item.element);
            }}
          >
            {/* Tooltip on hover */}
            {hoveredIndex === index && (
              <div
                className="absolute left-0 -top-8 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded shadow-lg whitespace-nowrap z-60"
                style={{ transform: 'translateX(-50%)', left: '50%' }}
              >
                <span className="font-medium">{item.element.label}</span>
                <span className="text-muted-foreground ml-1">
                  ({item.element.suggestedAction})
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 bg-popover text-popover-foreground text-xs rounded-full shadow-lg">
        Click an element to select it • Press Esc to cancel
      </div>
    </>
  );
}
