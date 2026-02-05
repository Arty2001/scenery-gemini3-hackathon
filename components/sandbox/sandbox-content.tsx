'use client';

/**
 * Sandbox content component
 *
 * Rendered inside the iframe to handle props updates and thumbnail capture.
 * Uses render-props pattern for flexibility in what component is rendered.
 *
 * Key features:
 * - Listens for prop updates from parent via postMessage bridge
 * - Supports thumbnail capture via html-to-image
 * - Sends ready message when component mounts
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import debounce from 'lodash.debounce';

/**
 * Props for the SandboxContent component
 */
export interface SandboxContentProps {
  /** Unique identifier for the component being rendered */
  componentId: string;
  /** Initial props to render the component with */
  initialProps: Record<string, unknown>;
  /** Render function that receives current props and returns React node */
  children: (props: Record<string, unknown>) => React.ReactNode;
  /** Optional callback when thumbnail is captured */
  onThumbnailCapture?: (dataUrl: string) => void;
}

/**
 * Sandbox content component for rendering inside the iframe
 *
 * Uses render-props pattern to allow parent to control what component
 * renders while SandboxContent manages the props state and bridge communication.
 *
 * @example
 * ```tsx
 * <SandboxContent
 *   componentId="button-1"
 *   initialProps={{ label: 'Click me' }}
 *   onThumbnailCapture={(url) => console.log('Captured:', url)}
 * >
 *   {(props) => <Button {...props} />}
 * </SandboxContent>
 * ```
 */
export function SandboxContent({
  componentId,
  initialProps,
  children,
  onThumbnailCapture,
}: SandboxContentProps): React.ReactElement {
  // Current props state, initialized from initialProps
  const [props, setProps] = useState<Record<string, unknown>>(initialProps);

  // Ref to the container element for thumbnail capture
  const containerRef = useRef<HTMLDivElement>(null);

  // Track if component has mounted
  const isMountedRef = useRef(false);

  /**
   * Capture thumbnail of the container element
   */
  const captureThumb = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      // Dynamic import to avoid loading until needed
      const { toPng } = await import('html-to-image');

      const dataUrl = await toPng(containerRef.current, {
        cacheBust: true,
        pixelRatio: 1, // Lower for thumbnails
      });

      onThumbnailCapture?.(dataUrl);
    } catch (error) {
      console.error('[SandboxContent] Thumbnail capture failed:', error);
    }
  }, [onThumbnailCapture]);

  /**
   * Debounced thumbnail capture (500ms delay)
   */
  const debouncedCapture = useRef(
    debounce(() => {
      captureThumb();
    }, 500)
  ).current;

  /**
   * Send ready message to parent
   */
  const sendReadyMessage = useCallback(() => {
    window.parent.postMessage(
      {
        type: 'READY',
        componentId,
      },
      '*'
    );
  }, [componentId]);

  /**
   * Handle prop update messages from parent
   */
  const handlePropsUpdate = useCallback(
    (newProps: Record<string, unknown>) => {
      setProps(newProps);
      // Capture thumbnail after props change (debounced)
      debouncedCapture();
    },
    [debouncedCapture]
  );

  /**
   * Handle thumbnail request from parent
   */
  const handleThumbnailRequest = useCallback(
    async (requestId: string) => {
      if (!containerRef.current) {
        window.parent.postMessage(
          {
            type: 'THUMBNAIL_RESPONSE',
            requestId,
            dataUrl: '',
            error: 'Container element not available',
          },
          '*'
        );
        return;
      }

      try {
        const { toPng } = await import('html-to-image');
        const dataUrl = await toPng(containerRef.current, {
          cacheBust: true,
          pixelRatio: 1,
        });

        window.parent.postMessage(
          {
            type: 'THUMBNAIL_RESPONSE',
            requestId,
            dataUrl,
          },
          '*'
        );

        onThumbnailCapture?.(dataUrl);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown capture error';
        window.parent.postMessage(
          {
            type: 'THUMBNAIL_RESPONSE',
            requestId,
            dataUrl: '',
            error: errorMessage,
          },
          '*'
        );
      }
    },
    [onThumbnailCapture]
  );

  /**
   * Set up message listener for bridge communication
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // In production, validate origin
      // For development, accept all origins
      const data = event.data;

      if (!data || typeof data !== 'object' || !('type' in data)) {
        return;
      }

      switch (data.type) {
        case 'PROP_UPDATE':
          if (data.props && typeof data.props === 'object') {
            handlePropsUpdate(data.props as Record<string, unknown>);
          }
          break;
        case 'THUMBNAIL_REQUEST':
          if (data.requestId && typeof data.requestId === 'string') {
            handleThumbnailRequest(data.requestId);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      debouncedCapture.cancel();
    };
  }, [handlePropsUpdate, handleThumbnailRequest, debouncedCapture]);

  /**
   * Send ready message after initial mount and capture initial thumbnail
   */
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        sendReadyMessage();
        // Capture initial thumbnail
        captureThumb();
      }, 100);
    }
  }, [sendReadyMessage, captureThumb]);

  return (
    <div ref={containerRef} className="sandbox-content">
      {children(props)}
    </div>
  );
}

export default SandboxContent;
