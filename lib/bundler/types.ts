/**
 * Type definitions for runtime component bundling
 *
 * These types define the contract for the Sandpack-based bundler service
 * that compiles arbitrary user React components at runtime.
 */

import type { ComponentType } from 'react';

/**
 * Result of a component bundle operation
 */
export interface BundleResult {
  /** Whether bundling succeeded */
  success: boolean;
  /** Error message if bundling failed */
  error?: string;
  /** The bundled React component, or null if failed */
  Component: ComponentType<Record<string, unknown>> | null;
}

/**
 * Options for the bundler
 */
export interface BundlerOptions {
  /** Additional NPM dependencies required by the component */
  dependencies?: Record<string, string>;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Reference to an active bundler instance for cleanup
 */
export interface BundlerInstance {
  /** Unique identifier for this bundler instance */
  id: string;
  /** Destroy the bundler and clean up resources */
  destroy: () => void;
}

/**
 * Default bundler options
 */
export const DEFAULT_BUNDLER_OPTIONS: Required<BundlerOptions> = {
  dependencies: {},
  timeout: 30000,
};

// --- Server-side bundling types ---

/**
 * Result of a server-side component bundle operation
 */
export interface ServerBundleResult {
  /** Whether bundling succeeded */
  success: boolean;
  /** The bundled IIFE JavaScript string */
  code?: string;
  /** Error message if bundling failed */
  error?: string;
}

/**
 * Result of bundling multiple components for export
 */
export interface BulkBundleResult {
  /** Map of component ID to bundled JavaScript code */
  componentCodes: Record<string, string>;
  /** Components that failed to bundle */
  errors: Array<{
    componentId: string;
    componentName: string;
    error: string;
  }>;
}
