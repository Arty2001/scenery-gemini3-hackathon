/**
 * Runtime component bundler using Sandpack
 *
 * This module provides the ability to bundle arbitrary React components at runtime
 * using CodeSandbox's Sandpack bundler. Components are compiled in isolated iframes
 * and the resulting React components are returned for use in the application.
 *
 * Key features:
 * - In-browser compilation of React components
 * - NPM dependency resolution
 * - Isolated execution environment
 * - Cleanup and memory management
 */

import { loadSandpackClient, type SandpackClient } from '@codesandbox/sandpack-client';
import type { BundleResult, BundlerOptions, BundlerInstance } from './types';
import { DEFAULT_BUNDLER_OPTIONS } from './types';

// Extend window type for bundled component access
declare global {
  interface Window {
    __BUNDLED_COMPONENT__?: React.ComponentType<Record<string, unknown>>;
  }
}

// Track active bundler instances for cleanup
const activeBundlers = new Map<string, { iframe: HTMLIFrameElement; client: SandpackClient }>();

/**
 * Index wrapper code that exports the component for parent window access
 */
const INDEX_WRAPPER = `
import React from 'react';
import App from './App';
window.__BUNDLED_COMPONENT__ = App;
`;

/**
 * Bundle a React component at runtime using Sandpack
 *
 * @param componentCode - The React component source code (TSX/JSX)
 * @param options - Bundler options including dependencies and timeout
 * @returns Promise resolving to BundleResult with the bundled component
 *
 * @example
 * ```typescript
 * const result = await bundleComponent(`
 *   export default function MyComponent({ text }) {
 *     return <div>{text}</div>;
 *   }
 * `);
 *
 * if (result.success && result.Component) {
 *   // Use the component
 *   <result.Component text="Hello" />
 * }
 * ```
 */
export async function bundleComponent(
  componentCode: string,
  options?: BundlerOptions
): Promise<BundleResult & { bundlerId: string }> {
  const opts = { ...DEFAULT_BUNDLER_OPTIONS, ...options };
  const bundlerId = crypto.randomUUID();

  // Create hidden iframe for bundling
  const iframe = document.createElement('iframe');
  iframe.id = `sandpack-bundler-${bundlerId}`;
  iframe.style.display = 'none';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  document.body.appendChild(iframe);

  try {
    // Initialize Sandpack client
    const client = await loadSandpackClient(iframe, {
      files: {
        '/App.tsx': { code: componentCode },
        '/index.tsx': { code: INDEX_WRAPPER },
      },
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
        ...opts.dependencies,
      },
      entry: '/index.tsx',
    });

    // Store for cleanup
    activeBundlers.set(bundlerId, { iframe, client });

    // Wait for bundle completion with timeout
    const bundlePromise = new Promise<void>((resolve, reject) => {
      const unsubscribe = client.listen((msg) => {
        if (msg.type === 'done') {
          unsubscribe();
          resolve();
        }
        if (msg.type === 'action' && 'action' in msg && msg.action === 'show-error') {
          unsubscribe();
          const errorMsg = 'message' in msg && typeof msg.message === 'string'
            ? msg.message
            : 'Bundle error occurred';
          reject(new Error(errorMsg));
        }
      });
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Bundle timeout after ${opts.timeout}ms`)), opts.timeout);
    });

    await Promise.race([bundlePromise, timeoutPromise]);

    // Get the bundled component from iframe
    const contentWindow = iframe.contentWindow;
    if (!contentWindow) {
      throw new Error('Failed to access iframe content window');
    }

    const Component = contentWindow.__BUNDLED_COMPONENT__;
    if (!Component) {
      throw new Error('Bundled component not found in iframe window');
    }

    return {
      success: true,
      Component,
      bundlerId,
    };
  } catch (error) {
    // Clean up on error
    destroyBundler(bundlerId);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bundle failed',
      Component: null,
      bundlerId,
    };
  }
}

/**
 * Destroy a bundler instance and clean up its resources
 *
 * @param bundlerId - The unique identifier of the bundler to destroy
 *
 * @example
 * ```typescript
 * const result = await bundleComponent(code);
 * // ... use the component ...
 * destroyBundler(result.bundlerId);
 * ```
 */
export function destroyBundler(bundlerId: string): void {
  const bundler = activeBundlers.get(bundlerId);
  if (!bundler) {
    return;
  }

  try {
    // Destroy the Sandpack client
    bundler.client.destroy();
  } catch {
    // Ignore errors during client destruction
  }

  try {
    // Remove iframe from DOM
    if (bundler.iframe.parentNode) {
      bundler.iframe.parentNode.removeChild(bundler.iframe);
    }
  } catch {
    // Ignore errors during iframe removal
  }

  // Remove from tracking map
  activeBundlers.delete(bundlerId);
}

/**
 * Destroy all active bundler instances
 *
 * Useful for cleanup when unmounting or during tests
 */
export function destroyAllBundlers(): void {
  const bundlerIds = Array.from(activeBundlers.keys());
  for (const bundlerId of bundlerIds) {
    destroyBundler(bundlerId);
  }
}

/**
 * Get the count of active bundler instances
 *
 * Useful for debugging and testing
 */
export function getActiveBundlerCount(): number {
  return activeBundlers.size;
}

/**
 * Create a managed bundler instance with automatic cleanup
 *
 * @param componentCode - The React component source code
 * @param options - Bundler options
 * @returns Promise resolving to a BundlerInstance with destroy method
 */
export async function createBundlerInstance(
  componentCode: string,
  options?: BundlerOptions
): Promise<BundlerInstance & BundleResult> {
  const result = await bundleComponent(componentCode, options);

  return {
    ...result,
    id: result.bundlerId,
    destroy: () => destroyBundler(result.bundlerId),
  };
}
