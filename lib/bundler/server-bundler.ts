/**
 * Server-side component bundler using esbuild
 *
 * Transforms TSX component source code into executable IIFE JavaScript strings
 * for use in Lambda/Node.js environments where browser-based Sandpack is unavailable.
 */

import * as esbuild from 'esbuild';

import type { ServerBundleResult, BulkBundleResult } from './types';

/**
 * Bundle a single component's TSX source code into an IIFE JavaScript string.
 *
 * Uses esbuild's stdin API to compile TSX without writing to disk.
 * React and Remotion packages are externalized (expected to be provided at runtime).
 */
export async function bundleComponentServer(
  sourceCode: string,
  componentName: string
): Promise<ServerBundleResult> {
  try {
    const result = await esbuild.build({
      stdin: {
        contents: sourceCode,
        loader: 'tsx',
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: 'iife',
      globalName: '__BundledComponent',
      platform: 'browser',
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'remotion',
        '@remotion/*',
      ],
      jsx: 'automatic',
      target: 'es2020',
      minify: false,
      define: {
        'process.env.NODE_ENV': '"production"',
      },
    });

    return {
      success: true,
      code: result.outputFiles[0].text,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Bundle failed for ${componentName}: ${message}`,
    };
  }
}

/**
 * Bundle multiple components in parallel for export.
 *
 * Calls bundleComponentServer for each component concurrently and
 * collects successful bundles and errors separately.
 */
export async function bundleComponentsForExport(
  components: Array<{ id: string; name: string; sourceCode: string }>
): Promise<BulkBundleResult> {
  const results = await Promise.all(
    components.map(async (component) => ({
      component,
      result: await bundleComponentServer(component.sourceCode, component.name),
    }))
  );

  const componentCodes: Record<string, string> = {};
  const errors: Array<{
    componentId: string;
    componentName: string;
    error: string;
  }> = [];

  for (const { component, result } of results) {
    if (result.success && result.code) {
      componentCodes[component.id] = result.code;
    } else {
      errors.push({
        componentId: component.id,
        componentName: component.name,
        error: result.error ?? 'Unknown bundling error',
      });
    }
  }

  return { componentCodes, errors };
}
