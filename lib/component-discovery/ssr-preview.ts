import { getAIClient } from '@/lib/ai/client';
import { previewHtmlSchema, toJsonSchema } from './schemas';
import type { ComponentInfo, RepoContext } from './types';
import { createMockRequire } from './mock-registry';
import * as esbuild from 'esbuild';

/**
 * SSR-render a React component to static HTML using renderToStaticMarkup.
 * Returns null on any failure (missing deps, hooks, context, etc).
 */
export async function ssrRenderComponent(
  sourceCode: string,
  componentName: string,
  demoProps: Record<string, unknown>
): Promise<{ html: string } | null> {
  try {
    // Entry file that imports the component via a virtual module
    // This avoids mixing ESM (export default) with CJS (module.exports) in the same file
    const entrySource = `
import __React from 'react';
import __ReactDOMServer from 'react-dom/server';
import { default as __Default, ${componentName} as __Named } from '__component__';
const __Component = __Named || __Default;
export const __ssrHtml = __ReactDOMServer.renderToStaticMarkup(__React.createElement(__Component, ${JSON.stringify(demoProps)}));
`;

    // Bundle with esbuild — virtual plugin serves the component source
    const buildResult = await esbuild.build({
      stdin: {
        contents: entrySource,
        loader: 'tsx',
        resolveDir: process.cwd(),
      },
      bundle: true,
      format: 'cjs',
      platform: 'node',
      write: false,
      logLevel: 'silent',
      external: ['remotion', '@remotion/*'],
      plugins: [
        {
          name: 'virtual-component',
          setup(build) {
            // Serve the component source as a virtual module
            build.onResolve({ filter: /^__component__$/ }, () => ({
              path: '__component__',
              namespace: 'virtual',
            }));
            build.onLoad({ filter: /^__component__$/, namespace: 'virtual' }, () => ({
              contents: sourceCode,
              loader: 'tsx',
            }));
            // Allow react and react-dom to resolve normally (they're in our node_modules)
            // Externalize everything else — we can't resolve arbitrary repo imports
            build.onResolve({ filter: /.*/ }, (args) => {
              if (args.kind === 'entry-point') return undefined;
              // Let react/react-dom resolve from our node_modules
              if (args.path === 'react' || args.path === 'react-dom' || args.path === 'react-dom/server' || args.path === 'react/jsx-runtime') {
                return undefined;
              }
              // Everything else is external
              return { external: true };
            });
          },
        },
      ],
    });

    const bundledCode = buildResult.outputFiles?.[0]?.text;
    if (!bundledCode) return null;

    // Evaluate in sandboxed context with timeout
    const html = await Promise.race([
      new Promise<string | null>((resolve) => {
        try {
          const mod: { exports: Record<string, unknown> } = { exports: {} };
          const fn = new Function('require', 'module', 'exports', bundledCode);
          const mockRequire = createMockRequire(require);
          fn(mockRequire, mod, mod.exports);
          // esbuild CJS assigns exported values to module.exports
          const result = (mod.exports as { __ssrHtml?: string }).__ssrHtml;
          resolve(typeof result === 'string' ? result : null);
        } catch (err) {
          console.log(`[ssr-preview] eval error: ${err instanceof Error ? err.message : String(err)}`);
          resolve(null);
        }
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    if (!html) return null;
    return { html };
  } catch {
    return null;
  }
}

/**
 * Use AI to convert Tailwind class attributes to inline styles.
 * Uses Gemini 2.0 Flash (cheaper model for simpler task).
 */
export async function convertClassNamesToInlineStyles(
  html: string
): Promise<string | null> {
  try {
    const ai = getAIClient();

    const prompt = `Convert all class attributes in this HTML to equivalent inline style attributes. Remove all class attributes. Keep everything else identical - same tags, same nesting, same text content, same attributes. Only change class->style.

## CRITICAL: Preserve interactive elements for cursor targeting
- Keep ALL <button>, <input>, <select>, <textarea>, <a>, <form>, <label> tags as-is (do NOT convert to <div> or <span>)
- Keep ALL attributes on these elements: type, name, placeholder, data-testid, href, value, role, for, id
- If an element is missing data-testid, ADD one based on the element's purpose (e.g., data-testid="submit-button")

## Tailwind -> CSS Quick Reference

text-xs:12px text-sm:14px text-base:16px text-lg:18px text-xl:20px text-2xl:24px text-3xl:30px text-4xl:36px
font-normal:400 font-medium:500 font-semibold:600 font-bold:700
rounded:4px rounded-md:6px rounded-lg:8px rounded-xl:12px rounded-2xl:16px rounded-full:9999px
shadow-sm:0 1px 2px rgba(0,0,0,.05) shadow:0 1px 3px rgba(0,0,0,.1),0 1px 2px rgba(0,0,0,.06) shadow-md:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1) shadow-lg:0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1)
p-1:4px p-2:8px p-3:12px p-4:16px p-5:20px p-6:24px p-8:32px p-10:40px
gap-1:4px gap-2:8px gap-3:12px gap-4:16px gap-5:20px gap-6:24px gap-8:32px
w-full:100% h-full:100% min-h-screen:100vh
tracking-tight:-0.025em leading-none:1 leading-tight:1.25 leading-snug:1.375 leading-normal:1.5
space-y-N -> children margin-top: Npx (4px per unit)
border: 1px solid #e5e5e5

## shadcn/ui CSS Variable -> Hex

background:#ffffff foreground:#0a0a0a
card:#ffffff card-foreground:#0a0a0a
primary:#171717 primary-foreground:#fafafa
secondary:#f5f5f5 secondary-foreground:#171717
muted:#f5f5f5 muted-foreground:#737373
accent:#f5f5f5 accent-foreground:#171717
destructive:#ef4444 destructive-foreground:#fafafa
border:#e5e5e5 input:#e5e5e5 ring:#171717

## HTML to convert

${html}

Return ONLY the converted HTML with inline styles. No explanation.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: toJsonSchema(previewHtmlSchema) as object,
      },
    });

    const text = response.text;
    if (!text) return null;

    const parsed = previewHtmlSchema.parse(JSON.parse(text));
    return parsed.html;
  } catch {
    return null;
  }
}

/**
 * Hybrid SSR + AI preview generation pipeline.
 * Tries SSR first, falls back to null (caller uses AI-only fallback).
 */
export async function generateHybridPreviewHtml(
  component: ComponentInfo,
  _repoContext: RepoContext,
  sourceCode: string,
  _relatedSourceCode?: Record<string, string>
): Promise<{ html: string; method: 'hybrid' | 'ai-only' } | null> {
  // Need source code and demo props for SSR
  if (!sourceCode || !component.demoProps) {
    console.log(`[ssr-preview] ${component.componentName}: skipped (no source or demoProps)`);
    return null;
  }

  // Step 1: Try SSR rendering
  console.log(`[ssr-preview] ${component.componentName}: attempting SSR...`);
  const ssrResult = await ssrRenderComponent(
    sourceCode,
    component.componentName,
    component.demoProps
  );

  if (!ssrResult) {
    console.log(`[ssr-preview] ${component.componentName}: SSR failed, falling back to AI-only`);
    return null;
  }

  // Check HTML is non-trivial
  if (ssrResult.html.length <= 50) {
    console.log(`[ssr-preview] ${component.componentName}: SSR output too short (${ssrResult.html.length} chars), falling back`);
    return null;
  }

  // Check it's more than just a wrapper div
  const stripped = ssrResult.html.replace(/<\/?div[^>]*>/g, '').trim();
  if (stripped.length === 0) {
    console.log(`[ssr-preview] ${component.componentName}: SSR output is empty divs, falling back`);
    return null;
  }

  console.log(`[ssr-preview] ${component.componentName}: SSR success (${ssrResult.html.length} chars), converting styles...`);

  // Step 2: Convert Tailwind classes to inline styles
  const convertedHtml = await convertClassNamesToInlineStyles(ssrResult.html);
  if (!convertedHtml) {
    console.log(`[ssr-preview] ${component.componentName}: style conversion failed, falling back`);
    return null;
  }

  console.log(`[ssr-preview] ${component.componentName}: hybrid complete (${convertedHtml.length} chars)`);
  return { html: convertedHtml, method: 'hybrid' };
}
