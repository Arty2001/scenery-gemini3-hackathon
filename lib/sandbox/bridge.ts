/**
 * Iframe-side bridge for sandbox communication
 *
 * This module handles message listening and sending from within the sandbox iframe.
 * It validates incoming messages, dispatches to handlers, and sends responses back
 * to the parent window.
 *
 * Usage in iframe:
 * ```ts
 * const cleanup = setupSandboxListener({
 *   onPropsUpdate: (props) => setComponentProps(props),
 *   targetElementId: 'component-root',
 *   componentId: 'my-component',
 * });
 * // Later: cleanup();
 * ```
 */

import type {
  ThumbnailCaptureOptions,
  ThumbnailResponseMessage,
  ReadyMessage,
  ErrorMessage,
  PropUpdateMessage,
  ThumbnailRequestMessage,
  DEFAULT_THUMBNAIL_OPTIONS,
} from './types';
import {
  validateMessage,
  isValidOrigin,
  isPropUpdateMessage,
  isThumbnailRequestMessage,
} from './message-schemas';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the sandbox listener
 */
export interface SandboxListenerConfig {
  /** Callback when props are updated from parent */
  onPropsUpdate: (props: Record<string, unknown>) => void;
  /** ID of the DOM element to capture for thumbnails */
  targetElementId: string;
  /** Component ID for message identification */
  componentId: string;
  /** Allowed origins for message validation (empty = all in dev, same-origin in prod) */
  allowedOrigins?: string[];
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// Message Sending Functions
// ============================================================================

/**
 * Sends a READY message to parent indicating component has mounted
 *
 * @param componentId - Unique identifier for the component
 * @param targetOrigin - Target origin for postMessage (default: '*')
 */
export function sendReadyMessage(
  componentId: string,
  targetOrigin: string = '*'
): void {
  const message: ReadyMessage = {
    type: 'READY',
    componentId,
  };

  window.parent.postMessage(message, targetOrigin);
}

/**
 * Sends an ERROR message to parent when component fails to render
 *
 * @param componentId - Unique identifier for the component
 * @param error - Error message or Error object
 * @param targetOrigin - Target origin for postMessage (default: '*')
 */
export function sendErrorMessage(
  componentId: string,
  error: string | Error,
  targetOrigin: string = '*'
): void {
  const errorMessage = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;

  const message: ErrorMessage = {
    type: 'ERROR',
    componentId,
    error: errorMessage,
    stack,
  };

  window.parent.postMessage(message, targetOrigin);
}

/**
 * Sends a THUMBNAIL_RESPONSE message to parent with captured image
 *
 * @param requestId - ID matching the original request
 * @param dataUrl - Base64 data URL of captured image
 * @param error - Optional error message if capture failed
 * @param targetOrigin - Target origin for postMessage (default: '*')
 */
function sendThumbnailResponse(
  requestId: string,
  dataUrl: string,
  error?: string,
  targetOrigin: string = '*'
): void {
  const message: ThumbnailResponseMessage = {
    type: 'THUMBNAIL_RESPONSE',
    requestId,
    dataUrl,
    error,
  };

  window.parent.postMessage(message, targetOrigin);
}

// ============================================================================
// Thumbnail Capture
// ============================================================================

/**
 * Captures thumbnail of a DOM element using html-to-image
 * Uses dynamic import to avoid loading library until needed
 *
 * @param element - DOM element to capture
 * @param options - Capture options
 * @returns Promise resolving to base64 data URL
 */
async function captureElement(
  element: HTMLElement,
  options?: ThumbnailCaptureOptions
): Promise<string> {
  // Dynamic import to avoid loading until needed
  const { toPng, toJpeg, toSvg } = await import('html-to-image');

  const captureOptions = {
    width: options?.width,
    height: options?.height,
    pixelRatio: options?.pixelRatio ?? 1,
    quality: options?.quality ?? 0.92,
    cacheBust: options?.cacheBust ?? true,
  };

  switch (options?.format) {
    case 'jpeg':
      return toJpeg(element, captureOptions);
    case 'svg':
      return toSvg(element, captureOptions);
    case 'png':
    default:
      return toPng(element, captureOptions);
  }
}

// ============================================================================
// Message Handlers
// ============================================================================

/**
 * Handles PROP_UPDATE messages from parent
 */
function handlePropUpdate(
  message: PropUpdateMessage,
  onPropsUpdate: (props: Record<string, unknown>) => void,
  debug: boolean
): void {
  if (debug) {
    console.log('[SandboxBridge] Received prop update:', message.props);
  }
  onPropsUpdate(message.props);
}

/**
 * Handles THUMBNAIL_REQUEST messages from parent
 */
async function handleThumbnailRequest(
  message: ThumbnailRequestMessage,
  targetElementId: string,
  debug: boolean
): Promise<void> {
  const { requestId, options } = message;

  if (debug) {
    console.log('[SandboxBridge] Thumbnail request:', requestId, options);
  }

  try {
    const element = document.getElementById(targetElementId);
    if (!element) {
      throw new Error(`Target element not found: ${targetElementId}`);
    }

    const dataUrl = await captureElement(element, options);
    sendThumbnailResponse(requestId, dataUrl);

    if (debug) {
      console.log('[SandboxBridge] Thumbnail captured successfully:', requestId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    sendThumbnailResponse(requestId, '', errorMessage);

    if (debug) {
      console.error('[SandboxBridge] Thumbnail capture failed:', requestId, error);
    }
  }
}

// ============================================================================
// Main Listener Setup
// ============================================================================

/**
 * Sets up the sandbox message listener
 *
 * Creates a message event listener that validates incoming messages from parent,
 * handles PROP_UPDATE and THUMBNAIL_REQUEST messages, and returns a cleanup function.
 *
 * @param config - Listener configuration
 * @returns Cleanup function to remove the listener
 *
 * @example
 * ```ts
 * const cleanup = setupSandboxListener({
 *   onPropsUpdate: (props) => setComponentProps(props),
 *   targetElementId: 'component-root',
 *   componentId: 'my-component',
 * });
 *
 * // When unmounting:
 * cleanup();
 * ```
 */
export function setupSandboxListener(config: SandboxListenerConfig): () => void {
  const {
    onPropsUpdate,
    targetElementId,
    componentId,
    allowedOrigins = [],
    debug = false,
  } = config;

  if (debug) {
    console.log('[SandboxBridge] Setting up listener for component:', componentId);
  }

  const handleMessage = async (event: MessageEvent) => {
    // Validate origin in production, warn in development
    if (!isValidOrigin(event.origin, allowedOrigins)) {
      if (debug) {
        console.warn('[SandboxBridge] Message from invalid origin:', event.origin);
      }
      return;
    }

    // Validate message structure
    const message = validateMessage(event.data);
    if (!message) {
      // Not a sandbox message, ignore silently
      return;
    }

    if (debug) {
      console.log('[SandboxBridge] Received message:', message.type);
    }

    // Handle message based on type
    if (isPropUpdateMessage(message)) {
      handlePropUpdate(message, onPropsUpdate, debug);
    } else if (isThumbnailRequestMessage(message)) {
      await handleThumbnailRequest(message, targetElementId, debug);
    }
    // READY, ERROR, and THUMBNAIL_RESPONSE are outbound-only messages
    // They should not be received by the iframe
  };

  window.addEventListener('message', handleMessage);

  // Return cleanup function
  return () => {
    if (debug) {
      console.log('[SandboxBridge] Removing listener for component:', componentId);
    }
    window.removeEventListener('message', handleMessage);
  };
}
