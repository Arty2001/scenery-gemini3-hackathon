/**
 * Type definitions for component sandbox communication
 *
 * These types define the contract between the parent application and the
 * isolated iframe sandbox where components are rendered. Communication happens
 * via postMessage with type-safe message payloads.
 */

// ============================================================================
// Message Types for postMessage Bridge
// ============================================================================

/**
 * Parent sends new props to the iframe for component re-render
 */
export interface PropUpdateMessage {
  type: 'PROP_UPDATE';
  props: Record<string, unknown>;
}

/**
 * Parent requests the iframe to capture and return a thumbnail
 */
export interface ThumbnailRequestMessage {
  type: 'THUMBNAIL_REQUEST';
  requestId: string;
  options?: ThumbnailCaptureOptions;
}

/**
 * Iframe returns captured thumbnail to parent
 */
export interface ThumbnailResponseMessage {
  type: 'THUMBNAIL_RESPONSE';
  requestId: string;
  dataUrl: string;
  error?: string;
}

/**
 * Iframe signals component has rendered and is ready
 */
export interface ReadyMessage {
  type: 'READY';
  componentId: string;
}

/**
 * Iframe reports a rendering error to parent
 */
export interface ErrorMessage {
  type: 'ERROR';
  componentId: string;
  error: string;
  stack?: string;
}

/**
 * Union type for all sandbox messages - discriminated on 'type' field
 */
export type SandboxMessage =
  | PropUpdateMessage
  | ThumbnailRequestMessage
  | ThumbnailResponseMessage
  | ReadyMessage
  | ErrorMessage;

/**
 * Message types as a const for type guards
 */
export const SandboxMessageTypes = {
  PROP_UPDATE: 'PROP_UPDATE',
  THUMBNAIL_REQUEST: 'THUMBNAIL_REQUEST',
  THUMBNAIL_RESPONSE: 'THUMBNAIL_RESPONSE',
  READY: 'READY',
  ERROR: 'ERROR',
} as const;

export type SandboxMessageType = keyof typeof SandboxMessageTypes;

// ============================================================================
// Component Rendering Types
// ============================================================================

/**
 * Props for the sandbox iframe component
 */
export interface SandboxComponentProps {
  /** Unique identifier for the component being rendered */
  componentId: string;
  /** Component's display name for error reporting */
  componentName: string;
  /** Initial props to render the component with */
  initialProps: Record<string, unknown>;
  /** Optional CSS to inject into the iframe */
  customStyles?: string;
  /** Callback when component is ready */
  onReady?: () => void;
  /** Callback when component encounters an error */
  onError?: (error: string) => void;
  /** Callback when thumbnail is captured */
  onThumbnailCapture?: (dataUrl: string) => void;
  /** Width of the sandbox iframe */
  width?: number | string;
  /** Height of the sandbox iframe */
  height?: number | string;
}

/**
 * State of component rendering in the sandbox
 */
export type ComponentRenderState = 'loading' | 'ready' | 'error';

/**
 * Full render state with error details
 */
export interface ComponentRenderStatus {
  state: ComponentRenderState;
  error?: string;
  timestamp: number;
}

// ============================================================================
// Thumbnail Capture Types
// ============================================================================

/**
 * Options for thumbnail capture
 */
export interface ThumbnailCaptureOptions {
  /** Width of the captured image in pixels */
  width?: number;
  /** Height of the captured image in pixels */
  height?: number;
  /** Pixel ratio for high-DPI displays (default: 1) */
  pixelRatio?: number;
  /** Output format */
  format?: 'png' | 'jpeg' | 'svg';
  /** JPEG quality (0-1), only used when format is 'jpeg' */
  quality?: number;
  /** Whether to bust cache for capture */
  cacheBust?: boolean;
}

/**
 * Default thumbnail capture options
 */
export const DEFAULT_THUMBNAIL_OPTIONS: Required<ThumbnailCaptureOptions> = {
  width: 400,
  height: 300,
  pixelRatio: 1,
  format: 'png',
  quality: 0.92,
  cacheBust: true,
};

/**
 * Result of a thumbnail capture operation
 */
export interface ThumbnailCaptureResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
  capturedAt: number;
}

// ============================================================================
// Bridge Types
// ============================================================================

/**
 * Configuration for the sandbox message bridge
 */
export interface SandboxBridgeConfig {
  /** Timeout for waiting on responses (ms) */
  timeout?: number;
  /** Allowed origins for message validation */
  allowedOrigins?: string[];
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Default bridge configuration
 */
export const DEFAULT_BRIDGE_CONFIG: Required<SandboxBridgeConfig> = {
  timeout: 5000,
  allowedOrigins: [],
  debug: false,
};
