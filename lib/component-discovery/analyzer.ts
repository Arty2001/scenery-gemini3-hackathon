import { getAIClient } from '@/lib/ai/client';
import { DEFAULT_MODEL, getModelIdOrDefault, type GeminiModelId } from '@/lib/ai/models';
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
import { generateHybridPreviewHtml } from './ssr-preview';
import { extractStorybookArgs } from './storybook-extractor';

/**
 * Get AI model to use for this operation.
 * Uses project's configured model if available, otherwise falls back to default.
 */
function getModelForContext(repoContext?: RepoContext): GeminiModelId {
  if (repoContext?.aiModel) {
    return getModelIdOrDefault(repoContext.aiModel);
  }
  return DEFAULT_MODEL;
}

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
  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const ai = getAIClient();

      const prompt = `Categorize this React UI component for VIDEO SHOWCASE purposes.

Repository: ${repoContext.owner}/${repoContext.name}
Component name: ${component.componentName}
${component.description ? `Description: ${component.description}` : ''}
Props:
${formatPropsForPrompt(component.props)}

Available categories: ${COMPONENT_CATEGORIES.join(', ')}

## Your Task

Analyze the component and determine:

1. **Primary category** — The most specific UI category that applies.

2. **Video role** — How should this component be featured in a demo video?
   - "hero": Full-screen showcase, main attraction (dashboards, hero sections, full layouts)
   - "supporting": Shown in context with other elements (cards, modals, forms)
   - "detail": Close-up feature highlight (buttons, inputs, small widgets)

3. **Suggested duration** — How many frames of screen time (30 frames = 1 second)?
   - Heavy components (layouts, dashboards): 180-360 frames (6-12s)
   - Medium components (cards, forms, modals): 120-180 frames (4-6s)
   - Light components (buttons, inputs): 60-120 frames (2-4s)

4. **Device frame** — Which frame displays this component best?
   - "laptop": Wide layouts, dashboards, tables (1280px+ width)
   - "phone": Mobile UIs, forms, cards (375px width)
   - "tablet": Medium layouts (768px width)
   - "none": Full-bleed backgrounds, hero sections

5. **Visual weight** — How visually prominent is this component?
   - "heavy": Full-page layouts, complex dashboards
   - "medium": Cards, modals, forms, nav bars
   - "light": Buttons, inputs, badges, icons`;

      const response = await ai.models.generateContent({
        model: getModelForContext(repoContext),
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
      lastError = error;
      const isNetworkError = error instanceof Error &&
        (error.message.includes('fetch failed') || error.message.includes('ECONNRESET'));

      if (isNetworkError && attempt < maxRetries) {
        console.log(`[categorize] ${component.componentName}: Network error, retrying (${attempt + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      break;
    }
  }

  console.error('Categorization failed:', lastError);
  return null;
}

export async function generateDemoProps(
  component: ComponentInfo,
  repoContext: RepoContext,
  sourceCodeMap?: Record<string, string>
): Promise<DemoPropsResult | null> {
  // Skip if no props to generate
  if (component.props.length === 0) {
    return { props: {}, confidence: 'high' };
  }

  // Try extracting args from Storybook stories first (highest quality)
  if (sourceCodeMap) {
    const storybookResult = extractStorybookArgs(component.filePath, sourceCodeMap);
    if (storybookResult.hasStorybook && storybookResult.defaultArgs) {
      console.log(`[demo-props] ${component.componentName}: using Storybook args`);
      return {
        props: storybookResult.defaultArgs,
        confidence: 'high', // Storybook args are author-defined, highest confidence
      };
    }
  }

  // Fallback to AI-generated demo props with retry
  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const ai = getAIClient();

      const prompt = `Generate STORYTELLING demo props for a React component in a VIDEO DEMO.

Repository: ${repoContext.owner}/${repoContext.name}
Component: ${component.componentName}
${component.category ? `Category: ${component.category}` : ''}

Props interface:
${formatPropsForPrompt(component.props)}

## Requirements

### Props Should Tell a STORY
- DON'T use generic placeholders ("John Doe", "lorem ipsum", "test@example.com")
- DO use realistic, contextual content that shows the component's purpose:
  - Checkout form: "MacBook Pro 14-inch", "$1,999.00", "123 Tech Lane, San Francisco, CA"
  - User profile: "Sarah Chen", "Senior Product Designer", avatar URL
  - Dashboard: Real-looking metrics with trends ("+12.5% vs last month")
  - Chat: Realistic conversation snippets

### Brand Context
- Use "${repoContext.name}" as the brand name in UI text
- Match the visual style (if repo is "acme-ui", use "Acme" in labels)

### Stateful Components
- For components with multiple states (tabs, accordions, steppers):
  - Pick the MOST VISUALLY INTERESTING state to show
  - Set activeTab/activeStep/selectedIndex to that value
  - Explain in suggestedState WHY you chose that state

### Visibility Props (CRITICAL)
- Modal, Dialog, Sheet, Drawer, Popover, Tooltip, Dropdown, Menu, Alert, Toast:
  - ALWAYS set open/isOpen/visible/show to TRUE
  - Component won't render content otherwise

### Interactive Elements (for cursor tutorials)
- Identify clickable/hoverable/typeable elements the cursor can target
- Provide CSS selectors that work on the rendered HTML
- Examples:
  - Button: { selector: "button[type='submit']", action: "click", description: "Submit form" }
  - Input: { selector: "input[name='email']", action: "type", description: "Email field", sampleValue: "demo@${repoContext.name}.com" }
  - Link: { selector: "a[href='/dashboard']", action: "click", description: "Navigate to dashboard" }

### Data Types
- Strings: Realistic content matching context
- Numbers: Sensible defaults (not 0 or 1)
- Functions: null (mocked in sandbox)
- Arrays: 2-4 items with varied realistic data
- Objects: Minimal valid structure with realistic values

### Theme Support
- If component has theme/colorScheme/mode prop, include it
- Prefer "light" unless component looks better in dark mode`;

      const response = await ai.models.generateContent({
        model: getModelForContext(repoContext),
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: toJsonSchema(demoPropsSchema) as object,
        },
      });

      const text = response.text;
      if (!text) return null;

      const result = demoPropsSchema.parse(JSON.parse(text));

      // Post-process: ensure conditional components have visibility props set
      const conditionalPatterns = ['modal', 'dialog', 'drawer', 'popover', 'tooltip', 'sheet', 'dropdown', 'menu', 'alert', 'toast', 'overlay', 'portal'];
      const isConditional = conditionalPatterns.some(p => component.componentName.toLowerCase().includes(p));

      if (isConditional) {
        const visibilityProps = ['open', 'isOpen', 'visible', 'show', 'isVisible', 'isShown'];
        const hasProp = component.props.find(p => visibilityProps.includes(p.name));
        if (hasProp && result.props[hasProp.name] === undefined) {
          result.props[hasProp.name] = true;
          console.log(`[demo-props] ${component.componentName}: auto-set ${hasProp.name}=true for visibility`);
        }
      }

      return result;
    } catch (error) {
      lastError = error;
      const isNetworkError = error instanceof Error &&
        (error.message.includes('fetch failed') || error.message.includes('ECONNRESET'));

      if (isNetworkError && attempt < maxRetries) {
        console.log(`[demo-props] ${component.componentName}: Network error, retrying (${attempt + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // Exponential backoff
        continue;
      }
      break;
    }
  }

  console.error('Demo props generation failed:', lastError);
  return null;
}

/**
 * Generate a self-contained HTML/CSS visual preview of a component.
 *
 * Pipeline (in order of accuracy):
 * 1. Playwright rendering (highest accuracy - real browser with hooks, context, effects)
 * 2. SSR rendering (fast - renderToStaticMarkup, limited to simple components)
 * 3. AI generation (fallback - Gemini generates HTML from source code)
 *
 * All paths use AI for Tailwind → inline style conversion.
 */
export async function generatePreviewHtml(
  component: ComponentInfo,
  repoContext: RepoContext,
  sourceCode?: string,
  relatedSourceCode?: Record<string, string>,
  repoPath?: string
): Promise<PreviewHtmlResult | null> {
  // Try hybrid approach first (Playwright → SSR → null)
  if (sourceCode) {
    const hybridResult = await generateHybridPreviewHtml(
      component,
      repoContext,
      sourceCode,
      relatedSourceCode,
      repoPath
    );

    if (hybridResult) {
      console.log(`[preview] ${component.componentName}: ${hybridResult.method} succeeded`);
      return { html: hybridResult.html };
    }
  }

  // Fallback to AI-only generation
  console.log(`[preview] ${component.componentName}: falling back to AI-only generation`);
  return generateAIOnlyPreviewHtml(component, repoContext, sourceCode, relatedSourceCode);
}

/**
 * AI-only preview generation (fallback when Playwright and SSR fail)
 */
async function generateAIOnlyPreviewHtml(
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

## CRITICAL: EXACT REPRODUCTION REQUIRED

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

## Tailwind to CSS Reference

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

## INTERACTIVE ELEMENTS — USE REAL HTML TAGS

For cursor targeting in video tutorials, you MUST use semantic HTML:

- **Buttons**: <button type="button" data-testid="btn-name"> NOT <div>
- **Inputs**: <input type="text" name="field" placeholder="..." data-testid="input-name"> NOT <div>
- **Links**: <a href="#" data-testid="link-name"> NOT <span>
- **Selects**: <select name="field"><option>...</option></select>
- **Checkboxes**: <input type="checkbox" name="field">

## Output

Return ONLY the HTML. No markdown, no explanation, no code fences. Just raw HTML starting with <div style="..."> and ending with </div>.`;

    const response = await ai.models.generateContent({
      model: getModelForContext(repoContext),
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
