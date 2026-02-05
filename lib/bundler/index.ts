/**
 * Runtime component bundler module
 *
 * Provides runtime bundling of arbitrary React components using Sandpack.
 * This enables loading user components from GitHub repositories and
 * rendering them in the video composition system.
 *
 * @example
 * ```typescript
 * import { bundleComponent, destroyBundler } from '@/lib/bundler';
 *
 * const result = await bundleComponent(`
 *   export default function Banner({ text, color }) {
 *     return <div style={{ color }}>{text}</div>;
 *   }
 * `, {
 *   dependencies: {
 *     'framer-motion': '^11.0.0',
 *   },
 * });
 *
 * if (result.success && result.Component) {
 *   // Render the component
 *   <result.Component text="Hello" color="blue" />
 * }
 *
 * // Clean up when done
 * destroyBundler(result.bundlerId);
 * ```
 */

// Core bundling functions
export {
  bundleComponent,
  destroyBundler,
  destroyAllBundlers,
  getActiveBundlerCount,
  createBundlerInstance,
} from './sandpack-bundler';

// Type definitions
export type {
  BundleResult,
  BundlerOptions,
  BundlerInstance,
  ServerBundleResult,
  BulkBundleResult,
} from './types';

export { DEFAULT_BUNDLER_OPTIONS } from './types';

// Server-side bundling (esbuild) — import directly from './server-bundler' to avoid
// pulling esbuild into Turbopack's client module graph.
