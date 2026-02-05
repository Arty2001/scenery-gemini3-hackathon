/**
 * Component cache for bundled React components.
 *
 * Prevents re-bundling components on every render by caching the bundled
 * component along with a code hash for invalidation on code changes.
 */

import type { ComponentType } from 'react';

// =============================================
// Types
// =============================================

interface CacheEntry {
  Component: ComponentType<Record<string, unknown>>;
  bundledAt: number;
  codeHash: string; // To invalidate on code change
}

// =============================================
// Cache Implementation
// =============================================

const cache = new Map<string, CacheEntry>();

/**
 * Get a cached component by its ID.
 *
 * @param componentId - The unique identifier for the component
 * @returns The cached component or null if not found
 */
export function getCachedComponent(
  componentId: string
): ComponentType<Record<string, unknown>> | null {
  const entry = cache.get(componentId);
  return entry?.Component ?? null;
}

/**
 * Cache a bundled component.
 *
 * @param componentId - The unique identifier for the component
 * @param Component - The React component to cache
 * @param codeHash - Hash of the source code for cache invalidation
 */
export function cacheComponent(
  componentId: string,
  Component: ComponentType<Record<string, unknown>>,
  codeHash: string
): void {
  cache.set(componentId, {
    Component,
    bundledAt: Date.now(),
    codeHash,
  });
}

/**
 * Invalidate a cached component.
 *
 * @param componentId - The unique identifier for the component to invalidate
 */
export function invalidateCache(componentId: string): void {
  cache.delete(componentId);
}

/**
 * Clear all cached components.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Check if a component is cached with a specific code hash.
 * Useful for checking if a cache entry is stale.
 *
 * @param componentId - The unique identifier for the component
 * @param codeHash - The code hash to check against
 * @returns True if cached with the same code hash
 */
export function isCacheValid(componentId: string, codeHash: string): boolean {
  const entry = cache.get(componentId);
  return entry?.codeHash === codeHash;
}

/**
 * Get the size of the cache.
 *
 * @returns The number of cached components
 */
export function getCacheSize(): number {
  return cache.size;
}

// =============================================
// Convenience Export
// =============================================

/**
 * Component cache object for easy import.
 *
 * @example
 * ```typescript
 * import { componentCache } from '@/lib/bundler/component-cache';
 *
 * const cached = componentCache.get('component-id');
 * if (!cached) {
 *   // Bundle and cache
 *   componentCache.set('component-id', BundledComponent, codeHash);
 * }
 * ```
 */
export const componentCache = {
  get: getCachedComponent,
  set: cacheComponent,
  invalidate: invalidateCache,
  clear: clearCache,
  isValid: isCacheValid,
  size: getCacheSize,
};
