'use client';

/**
 * React hook for parent-side sandbox iframe communication
 *
 * This hook provides a clean API for parent components to communicate with
 * the sandboxed iframe. It handles prop updates, thumbnail requests, and
 * tracks iframe ready/error state.
 *
 * Usage:
 * ```tsx
 * const iframeRef = useRef<HTMLIFrameElement>(null);
 * const { updateProps, requestThumbnail, isReady, error } = useSandboxBridge(iframeRef);
 *
 * // Update props when they change
 * updateProps({ color: 'blue', size: 'large' });
 *
 * // Request a thumbnail
 * const dataUrl = await requestThumbnail();
 * ```
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import type {
  PropUpdateMessage,
  ThumbnailRequestMessage,
  ThumbnailCaptureOptions,
} from './types';
import {
  validateMessage,
  isReadyMessage,
  isErrorMessage,
  isThumbnailResponseMessage,
} from './message-schemas';

// ============================================================================
// Types
// ============================================================================

/**
 * Pending thumbnail request awaiting response
 */
interface PendingThumbnailRequest {
  resolve: (dataUrl: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Options for the sandbox bridge hook
 */
export interface UseSandboxBridgeOptions {
  /** Target origin for postMessage (default: '*') */
  targetOrigin?: string;
  /** Timeout for thumbnail requests in ms (default: 10000) */
  thumbnailTimeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Return value from useSandboxBridge hook
 */
export interface UseSandboxBridgeReturn {
  /** Send new props to the iframe for component re-render */
  updateProps: (props: Record<string, unknown>) => void;
  /** Request a thumbnail capture from the iframe */
  requestThumbnail: (options?: ThumbnailCaptureOptions) => Promise<string>;
  /** Whether the iframe has signaled it's ready */
  isReady: boolean;
  /** Error message if the iframe reported an error */
  error: string | null;
  /** Reset error state */
  clearError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for parent-side sandbox iframe communication
 *
 * Provides methods to send props and request thumbnails from the sandboxed
 * component iframe, and tracks ready/error state.
 *
 * @param iframeRef - React ref to the sandbox iframe element
 * @param options - Optional configuration
 * @returns Object with updateProps, requestThumbnail, isReady, error, clearError
 *
 * @example
 * ```tsx
 * function ComponentPreview({ componentId }: { componentId: string }) {
 *   const iframeRef = useRef<HTMLIFrameElement>(null);
 *   const { updateProps, requestThumbnail, isReady, error } = useSandboxBridge(iframeRef);
 *
 *   const handlePropChange = (newProps: Record<string, unknown>) => {
 *     updateProps(newProps);
 *   };
 *
 *   const handleCapture = async () => {
 *     try {
 *       const thumbnail = await requestThumbnail({ format: 'png' });
 *       console.log('Captured:', thumbnail);
 *     } catch (err) {
 *       console.error('Capture failed:', err);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {error && <div className="error">{error}</div>}
 *       {!isReady && <div className="loading">Loading...</div>}
 *       <iframe ref={iframeRef} src="/sandbox" />
 *       <button onClick={handleCapture} disabled={!isReady}>
 *         Capture Thumbnail
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSandboxBridge(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  options: UseSandboxBridgeOptions = {}
): UseSandboxBridgeReturn {
  const {
    targetOrigin = '*',
    thumbnailTimeout = 10000,
    debug = false,
  } = options;

  // State for iframe status
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map of pending thumbnail requests, keyed by requestId
  const pendingRequests = useRef<Map<string, PendingThumbnailRequest>>(new Map());

  /**
   * Safely post a message to the iframe
   */
  const postToIframe = useCallback(
    (message: PropUpdateMessage | ThumbnailRequestMessage): boolean => {
      const contentWindow = iframeRef.current?.contentWindow;
      if (!contentWindow) {
        if (debug) {
          console.warn('[useSandboxBridge] Cannot post message: iframe not available');
        }
        return false;
      }

      contentWindow.postMessage(message, targetOrigin);
      return true;
    },
    [iframeRef, targetOrigin, debug]
  );

  /**
   * Send updated props to the iframe
   */
  const updateProps = useCallback(
    (props: Record<string, unknown>): void => {
      const message: PropUpdateMessage = {
        type: 'PROP_UPDATE',
        props,
      };

      if (debug) {
        console.log('[useSandboxBridge] Sending props update:', props);
      }

      postToIframe(message);
    },
    [postToIframe, debug]
  );

  /**
   * Request a thumbnail from the iframe
   * Returns a promise that resolves with the base64 data URL
   */
  const requestThumbnail = useCallback(
    (captureOptions?: ThumbnailCaptureOptions): Promise<string> => {
      return new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID();

        // Set up timeout for request
        const timeout = setTimeout(() => {
          const pending = pendingRequests.current.get(requestId);
          if (pending) {
            pendingRequests.current.delete(requestId);
            reject(new Error('Thumbnail request timed out'));
          }
        }, thumbnailTimeout);

        // Store pending request
        pendingRequests.current.set(requestId, { resolve, reject, timeout });

        const message: ThumbnailRequestMessage = {
          type: 'THUMBNAIL_REQUEST',
          requestId,
          options: captureOptions,
        };

        if (debug) {
          console.log('[useSandboxBridge] Requesting thumbnail:', requestId);
        }

        const sent = postToIframe(message);
        if (!sent) {
          clearTimeout(timeout);
          pendingRequests.current.delete(requestId);
          reject(new Error('Failed to send thumbnail request: iframe not available'));
        }
      });
    },
    [postToIframe, thumbnailTimeout, debug]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Handle incoming messages from iframe
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate the message structure
      const message = validateMessage(event.data);
      if (!message) {
        // Not a sandbox message, ignore
        return;
      }

      if (debug) {
        console.log('[useSandboxBridge] Received message:', message.type);
      }

      // Handle READY message
      if (isReadyMessage(message)) {
        if (debug) {
          console.log('[useSandboxBridge] Iframe ready:', message.componentId);
        }
        setIsReady(true);
        setError(null);
        return;
      }

      // Handle ERROR message
      if (isErrorMessage(message)) {
        if (debug) {
          console.error('[useSandboxBridge] Iframe error:', message.error);
        }
        setError(message.error);
        return;
      }

      // Handle THUMBNAIL_RESPONSE message
      if (isThumbnailResponseMessage(message)) {
        const pending = pendingRequests.current.get(message.requestId);
        if (!pending) {
          if (debug) {
            console.warn('[useSandboxBridge] Received response for unknown request:', message.requestId);
          }
          return;
        }

        // Clear timeout and remove from pending
        clearTimeout(pending.timeout);
        pendingRequests.current.delete(message.requestId);

        // Resolve or reject based on response
        if (message.error) {
          pending.reject(new Error(message.error));
        } else {
          pending.resolve(message.dataUrl);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);

      // Clean up any pending requests on unmount
      pendingRequests.current.forEach((pending, requestId) => {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Component unmounted'));
      });
      pendingRequests.current.clear();
    };
  }, [debug]);

  // Reset ready state when iframe ref changes
  useEffect(() => {
    setIsReady(false);
  }, [iframeRef.current]);

  return {
    updateProps,
    requestThumbnail,
    isReady,
    error,
    clearError,
  };
}
