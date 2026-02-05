import { getAIClient } from '@/lib/ai/client';
import {
  categorySchema,
  demoPropsSchema,
  previewHtmlSchema,
  toJsonSchema,
  type CategoryResult,
  type DemoPropsResult,
  type PreviewHtmlResult,
  COMPONENT_CATEGORIES,
} from './schemas';
import type { ComponentInfo, PropInfo, RepoContext } from './types';
import { extractInteractiveElements } from './extract-interactive-elements';

function formatPropsForPrompt(props: PropInfo[]): string {
  if (props.length === 0) return 'No props defined';

  return props
    .map(
      (p) =>
        `- ${p.name}: ${p.type}${p.required ? ' (required)' : ''}${p.description ? ` - ${p.description}` : ''}`
    )
    .join('\n');
}

export async function categorizeComponent(
  component: ComponentInfo,
  repoContext: RepoContext
): Promise<CategoryResult | null> {
  try {
    const ai = getAIClient();

    const prompt = `Categorize this React UI component.

Repository: ${repoContext.owner}/${repoContext.name}
Component name: ${component.componentName}
${component.description ? `Description: ${component.description}` : ''}
Props:
${formatPropsForPrompt(component.props)}

Available categories: ${COMPONENT_CATEGORIES.join(', ')}

Analyze the component name, props, and context to determine its UI category.
Choose the most specific category that applies.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: toJsonSchema(categorySchema) as object,
      },
    });

    const text = response.text;
    if (!text) return null;

    return categorySchema.parse(JSON.parse(text));
  } catch (error) {
    console.error('Categorization failed:', error);
    return null;
  }
}

export async function generateDemoProps(
  component: ComponentInfo,
  repoContext: RepoContext
): Promise<DemoPropsResult | null> {
  try {
    const ai = getAIClient();

    // Skip if no props to generate
    if (component.props.length === 0) {
      return { props: {}, confidence: 'high' };
    }

    const prompt = `Generate realistic demo props for a React component.

Repository: ${repoContext.owner}/${repoContext.name}
Component: ${component.componentName}
${component.category ? `Category: ${component.category}` : ''}

Props interface:
${formatPropsForPrompt(component.props)}

Requirements:
- Generate props that produce a production-quality preview
- Use the repository name for brand context (e.g., if repo is 'acme-ui', use 'Acme' in text)
- For strings: use realistic content, not "lorem ipsum" or "foo/bar"
- For numbers: use sensible defaults
- For functions: use null (will be mocked in sandbox)
- For complex objects: provide minimal valid structure
- Only include required props and commonly-used optional ones`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: toJsonSchema(demoPropsSchema) as object,
      },
    });

    const text = response.text;
    if (!text) return null;

    return demoPropsSchema.parse(JSON.parse(text));
  } catch (error) {
    console.error('Demo props generation failed:', error);
    return null;
  }
}

/**
 * Generate a self-contained HTML/CSS visual preview of a component.
 * Called one-at-a-time (not batched) for maximum quality.
 * Receives the actual source code and related component source code for context.
 */
export async function generatePreviewHtml(
  component: ComponentInfo,
  repoContext: RepoContext,
  sourceCode?: string,
  relatedSourceCode?: Record<string, string>
): Promise<PreviewHtmlResult | null> {
  try {
    const ai = getAIClient();

    // Build related components context (child components, imported components)
    let relatedContext = '';
    if (relatedSourceCode && Object.keys(relatedSourceCode).length > 0) {
      relatedContext = '\n### Related/Child Component Source Code\nThese are components imported and used inside this component. Study them to understand what they render.\n\n';
      for (const [name, code] of Object.entries(relatedSourceCode)) {
        relatedContext += `#### ${name}\n\`\`\`tsx\n${code.slice(0, 2000)}\n\`\`\`\n\n`;
      }
    }

    const prompt = `You are converting a React component from a REAL CODEBASE into static HTML. Your job is to create an EXACT visual replica — not a generic interpretation.

## ⚠️ CRITICAL: EXACT REPRODUCTION REQUIRED

**You MUST reproduce the component EXACTLY as it appears in the source code below.**

- DO NOT make up your own design
- DO NOT add elements that aren't in the source
- DO NOT change the layout or structure
- DO NOT use generic placeholder content
- COPY the exact JSX structure, just convert className to inline style

If the source has 2 buttons, output 2 buttons. If it has a specific label text, use that exact text. If it uses flex-col, use flex-direction:column. EXACT MATCH.

## Source Code (THIS IS THE TRUTH — COPY IT EXACTLY)

Component: ${component.componentName} (${repoContext.owner}/${repoContext.name})

${component.demoProps ? `### Demo Props (USE THESE VALUES FOR TEXT/DATA):\n\`\`\`json\n${JSON.stringify(component.demoProps, null, 2)}\n\`\`\`\n` : ''}

### Component Source Code:
${sourceCode ? `\`\`\`tsx\n${sourceCode.slice(0, 10000)}\n\`\`\`` : `Props:\n${formatPropsForPrompt(component.props)}`}
${relatedContext}

## Your Task

1. READ the source code above carefully
2. IDENTIFY every JSX element in the render return
3. CONVERT each className to inline CSS (use reference below)
4. OUTPUT the exact same structure as HTML

## Tailwind → CSS Reference

**Spacing:** p-1:4px p-2:8px p-3:12px p-4:16px p-5:20px p-6:24px p-8:32px m-1:4px m-2:8px m-4:16px gap-1:4px gap-2:8px gap-4:16px gap-6:24px
**Text:** text-xs:12px text-sm:14px text-base:16px text-lg:18px text-xl:20px text-2xl:24px text-3xl:30px text-4xl:36px
**Font:** font-normal:400 font-medium:500 font-semibold:600 font-bold:700
**Rounded:** rounded:4px rounded-md:6px rounded-lg:8px rounded-xl:12px rounded-2xl:16px rounded-full:9999px
**Flex:** flex:display:flex flex-col:flex-direction:column flex-row:flex-direction:row items-center:align-items:center justify-center:justify-content:center justify-between:justify-content:space-between
**Width/Height:** w-full:width:100% h-full:height:100% w-auto:width:auto
**Shadow:** shadow-sm:0 1px 2px rgba(0,0,0,.05) shadow:0 1px 3px rgba(0,0,0,.1) shadow-md:0 4px 6px -1px rgba(0,0,0,.1) shadow-lg:0 10px 15px -3px rgba(0,0,0,.1)

**shadcn/ui Colors:**
background:#ffffff foreground:#0a0a0a primary:#171717 primary-foreground:#fafafa
secondary:#f5f5f5 secondary-foreground:#171717 muted:#f5f5f5 muted-foreground:#737373
accent:#f5f5f5 accent-foreground:#171717 destructive:#ef4444 border:#e5e5e5

## Output Rules

1. Single root <div style="width:100%;height:auto;box-sizing:border-box;background-color:#ffffff;font-family:system-ui,-apple-system,sans-serif">
2. Convert ALL className to inline style — no classes allowed
3. **PRESERVE EXACT STRUCTURE** — same nesting, same elements, same order
4. For child components (Button, Card, Input, etc): expand them inline based on their typical appearance
5. Icons: use inline SVG (e.g., <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">...</svg>)
6. Arrays/maps: show 2-3 items with realistic data matching the component's purpose

## ⚠️ INTERACTIVE ELEMENTS — USE REAL HTML TAGS

For cursor targeting in video tutorials, you MUST use semantic HTML:

- **Buttons**: <button type="button" data-testid="btn-name"> NOT <div>
- **Inputs**: <input type="text" name="field" placeholder="..." data-testid="input-name"> NOT <div>
- **Links**: <a href="#" data-testid="link-name"> NOT <span>
- **Selects**: <select name="field"><option>...</option></select>
- **Checkboxes**: <input type="checkbox" name="field">

## Output

Return ONLY the HTML. No markdown, no explanation, no code fences. Just raw HTML starting with <div style="..."> and ending with </div>.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingBudget: 10000,
        },
      },
    });

    let html = response.text?.trim();
    if (!html) return null;

    // Strip markdown code fences if the model wrapped it
    if (html.startsWith('```')) {
      html = html.replace(/^```(?:html)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    // Validate it looks like HTML
    if (!html.startsWith('<div') && !html.startsWith('<')) {
      console.error('Preview HTML generation returned non-HTML:', html.slice(0, 100));
      return null;
    }

    return { html };
  } catch (error) {
    console.error('Preview HTML generation failed:', error);
    return null;
  }
}

export async function analyzeComponent(
  component: ComponentInfo,
  repoContext: RepoContext
): Promise<ComponentInfo> {
  // Run categorization and demo props in parallel
  const [categoryResult, propsResult] = await Promise.all([
    categorizeComponent(component, repoContext),
    generateDemoProps(component, repoContext),
  ]);

  return {
    ...component,
    category: categoryResult?.primary,
    categoryConfidence: categoryResult?.confidence,
    secondaryCategories: categoryResult?.secondary,
    demoProps: propsResult?.props,
    demoPropsConfidence: propsResult?.confidence,
    analysisError:
      !categoryResult && !propsResult ? 'AI analysis failed' : undefined,
  };
}

/**
 * Batch analyze components:
 * 1. Categorize + demo props in parallel batches (fast)
 * 2. Generate preview HTML one-at-a-time with source code context (quality)
 */
export async function analyzeComponents(
  components: ComponentInfo[],
  repoContext: RepoContext,
  options: {
    onProgress?: (completed: number, total: number) => void;
    concurrency?: number;
    /** Map of filePath -> source code for preview generation */
    sourceCodeMap?: Record<string, string>;
  } = {}
): Promise<ComponentInfo[]> {
  const { onProgress, concurrency = 3, sourceCodeMap } = options;
  const results: ComponentInfo[] = [];
  let completed = 0;

  // Phase 1: Categorize + demo props in parallel batches
  for (let i = 0; i < components.length; i += concurrency) {
    const batch = components.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((comp) => analyzeComponent(comp, repoContext))
    );
    results.push(...batchResults);
    completed += batch.length;
    onProgress?.(completed, components.length);

    if (i + concurrency < components.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Phase 1.5: Extract component relationships from source code
  if (sourceCodeMap) {
    console.log('[analyzer] Extracting component relationships...');
    const componentNames = results.map(c => c.componentName);
    const componentUsesMap = new Map<string, Set<string>>();
    const componentUsedByMap = new Map<string, Set<string>>();

    for (const comp of results) {
      const sourceCode = sourceCodeMap[comp.filePath];
      if (!sourceCode) continue;

      // Find which other components this component imports/uses
      const usesComponents = new Set<string>();

      // Match: import { ComponentA, ComponentB } from './path'
      // Match: import ComponentA from './path'
      // Match: <ComponentName ... /> or <ComponentName>
      for (const otherName of componentNames) {
        if (otherName === comp.componentName) continue;

        // Check if component is used in JSX (e.g., <Button> or <Button/>)
        const jsxPattern = new RegExp(`<${otherName}[\\s/>]`, 'g');
        if (jsxPattern.test(sourceCode)) {
          usesComponents.add(otherName);
        }
      }

      if (usesComponents.size > 0) {
        componentUsesMap.set(comp.componentName, usesComponents);
        // Build reverse mapping (usedBy)
        for (const usedComp of usesComponents) {
          if (!componentUsedByMap.has(usedComp)) {
            componentUsedByMap.set(usedComp, new Set());
          }
          componentUsedByMap.get(usedComp)!.add(comp.componentName);
        }
      }
    }

    // Find related components (same file or same directory)
    const dirToComponents = new Map<string, string[]>();
    for (const comp of results) {
      const dir = comp.filePath.split('/').slice(0, -1).join('/');
      if (!dirToComponents.has(dir)) {
        dirToComponents.set(dir, []);
      }
      dirToComponents.get(dir)!.push(comp.componentName);
    }

    // Apply relationships to results
    for (let i = 0; i < results.length; i++) {
      const comp = results[i];
      const uses = componentUsesMap.get(comp.componentName);
      const usedBy = componentUsedByMap.get(comp.componentName);
      const dir = comp.filePath.split('/').slice(0, -1).join('/');
      const sameDir = dirToComponents.get(dir)?.filter(n => n !== comp.componentName);

      results[i] = {
        ...comp,
        usesComponents: uses ? Array.from(uses) : undefined,
        usedByComponents: usedBy ? Array.from(usedBy) : undefined,
        relatedComponents: sameDir?.length ? sameDir : undefined,
      };
    }

    console.log(`[analyzer] Found ${componentUsesMap.size} components with dependencies`);
  }

  // Phase 2: Generate preview HTML one component at a time for best quality
  if (sourceCodeMap) {
    for (let i = 0; i < results.length; i++) {
      const comp = results[i];
      const sourceCode = sourceCodeMap[comp.filePath];

      // Find related/child components: scan source for imports from same repo
      const relatedSourceCode: Record<string, string> = {};
      if (sourceCode) {
        // Find imports like: import { Button } from './button' or from '../ui/card'
        const localImportRegex = /import\s+(?:{[^}]+}|[\w$]+)\s+from\s+['"](\.[^'"]+)['"]/g;
        let importMatch;
        while ((importMatch = localImportRegex.exec(sourceCode)) !== null) {
          const importPath = importMatch[1];
          // Find matching component source code by path
          for (const [filePath, code] of Object.entries(sourceCodeMap)) {
            if (filePath.includes(importPath.replace('./', '').replace('../', ''))) {
              const fileName = filePath.split('/').pop() ?? filePath;
              relatedSourceCode[fileName] = code;
              break;
            }
          }
        }
      }

      try {
        const previewResult = await generatePreviewHtml(comp, repoContext, sourceCode, relatedSourceCode);
        const previewHtml = previewResult?.html;

        // Extract interactive elements from the preview HTML
        const interactiveElements = previewHtml ? extractInteractiveElements(previewHtml) : [];

        results[i] = {
          ...comp,
          previewHtml,
          interactiveElements: interactiveElements.length > 0 ? interactiveElements : undefined,
        };
        console.log(`[analyzer] Preview HTML generated for ${comp.componentName} (${i + 1}/${results.length}), ${interactiveElements.length} interactive elements`);
      } catch (error) {
        console.error(`Preview HTML generation failed for ${comp.componentName}:`, error);
      }

      // Delay between calls to avoid rate limits
      if (i < results.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
  }

  return results;
}
