/**
 * AI-powered holistic render error recovery
 *
 * Instead of pattern matching specific errors, we give the AI:
 * - Full component source code
 * - The error message and console output
 * - Context about what's available in the render environment
 *
 * The AI analyzes the component holistically and returns ALL fixes needed.
 */

import { getAIClient } from '@/lib/ai/client';

export interface RecoveryFix {
  propsToAdd: Record<string, unknown>;
  propsToRemove: string[];
  mockCode: string; // Additional JS to inject before component
  reason: string;
  shouldSkip: boolean; // If true, component can't be fixed
}

/**
 * Analyze a component holistically and suggest ALL fixes needed
 */
export async function analyzeAndFix(
  componentName: string,
  sourceCode: string,
  errorMessage: string,
  consoleLog: string,
  currentProps: Record<string, unknown>
): Promise<RecoveryFix> {
  const prompt = `You are an expert React debugger. A component failed to render in an isolated Playwright browser environment. Your job is to analyze the FULL source code and error to determine exactly what's wrong and how to fix it.

## COMPONENT: ${componentName}

## SOURCE CODE
\`\`\`tsx
${sourceCode.slice(0, 10000)}
\`\`\`

## ERROR MESSAGE
${errorMessage}

## BROWSER CONSOLE
${consoleLog || 'No additional console output'}

## CURRENT PROPS
${JSON.stringify(currentProps, null, 2)}

## ENVIRONMENT (already provided)
- React 18 with all hooks
- Browser APIs: matchMedia, localStorage, ResizeObserver, IntersectionObserver, MutationObserver, crypto, fetch, XMLHttpRequest, Canvas/WebGL, PointerEvent, DragEvent
- Context Providers: ThemeProvider (next-themes), FormProvider (react-hook-form), RouterProvider, AuthProvider, QueryClientProvider, ToastProvider, I18nProvider
- Error boundary and Suspense boundary wrap the component
- Props are wrapped in safe Proxy (returns [] for array-like, {} for object-like, () => {} for callback-like props when undefined)

## ANALYSIS CHECKLIST
Read through the source code carefully and check each of these:

1. **Props destructuring**: Find \`const { x, y, z } = props\` or \`function Component({ x, y })\`. What props are destructured?

2. **Array operations**: Find \`.map(\`, \`.filter(\`, \`.reduce(\`, \`.forEach(\`, \`.find(\`, \`.some(\`. What variable is being mapped? Is it a prop that needs array data?

3. **Object access**: Find \`x.y\`, \`x?.y\`, \`x['y']\`. Are there deep object accesses that might fail?

4. **Function calls**: Find \`onClick(\`, \`onSubmit(\`, \`onChange(\`, \`onX(\`. Are callbacks being called that might not exist?

5. **Conditional rendering**: Is this a Dialog, Modal, Sheet, Popover, Dropdown, Tooltip? These need \`open={true}\` or \`isOpen={true}\`.

6. **Data requirements**: Does the component render a list, table, chart, or grid? It needs sample data.

7. **Specific hook usage**: Any \`useX()\` calls that might need specific setup?

## EXAMPLES OF GOOD FIXES

Example 1 - Component needs array data:
\`\`\`tsx
// Source: const { tracks } = props; return tracks.map(t => <Track {...t} />)
// Fix:
{ "propsToAdd": { "tracks": [{ "id": "1", "name": "Track 1", "artist": "Artist" }, { "id": "2", "name": "Track 2", "artist": "Artist" }] } }
\`\`\`

Example 2 - Modal needs to be open:
\`\`\`tsx
// Source: if (!open) return null; return <div className="modal">...
// Fix:
{ "propsToAdd": { "open": true, "onOpenChange": null } }
\`\`\`

Example 3 - Table needs data with specific shape:
\`\`\`tsx
// Source: columns.map(col => <th>{col.header}</th>) ... rows.map(row => <td>{row[col.key]}</td>)
// Fix:
{ "propsToAdd": { "columns": [{ "key": "name", "header": "Name" }, { "key": "email", "header": "Email" }], "rows": [{ "name": "John", "email": "john@example.com" }] } }
\`\`\`

Example 4 - Component uses custom hook that needs data:
\`\`\`tsx
// Source: const { data } = useCustomQuery(); return data.items.map(...)
// Fix: Provide the data that would come from the hook
{ "propsToAdd": { "items": [{ "id": "1" }] }, "mockCode": "window.__CUSTOM_QUERY_DATA__ = { items: [{ id: '1' }] };" }
\`\`\`

## YOUR RESPONSE
Return a JSON object:
{
  "propsToAdd": { ... },      // Props to add - use REALISTIC values that match the component's data shape
  "propsToRemove": [],        // Props causing issues (rare)
  "mockCode": "",             // Extra JS to inject (only if needed for custom setup)
  "reason": "...",            // 1-2 sentence explanation
  "shouldSkip": false         // Only true if component CANNOT be rendered (e.g., requires real API, WebSocket, etc.)
}

CRITICAL: Look at what the component ACTUALLY does with props. Don't just return empty arrays - provide realistic sample data that matches the structure the component expects.

Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim() || '';

    try {
      const result = JSON.parse(text);
      console.log(`[render-recovery] ${componentName}: AI analysis complete - ${result.reason}`);

      return {
        propsToAdd: result.propsToAdd || {},
        propsToRemove: result.propsToRemove || [],
        mockCode: result.mockCode || '',
        reason: result.reason || 'AI suggested fixes',
        shouldSkip: result.shouldSkip || false,
      };
    } catch (parseError) {
      console.log(`[render-recovery] ${componentName}: Failed to parse AI response`);
      return {
        propsToAdd: {},
        propsToRemove: [],
        mockCode: '',
        reason: 'Failed to parse AI response',
        shouldSkip: false,
      };
    }
  } catch (err) {
    console.error(`[render-recovery] ${componentName}: AI analysis failed:`, err);
    return {
      propsToAdd: {},
      propsToRemove: [],
      mockCode: '',
      reason: 'AI analysis failed',
      shouldSkip: false,
    };
  }
}

/**
 * Apply recovery fixes to props and generate setup code
 */
export function applyFix(
  fix: RecoveryFix,
  currentProps: Record<string, unknown>,
  currentSetupCode: string
): {
  newProps: Record<string, unknown>;
  newSetupCode: string;
} {
  // Start with current props
  const newProps = { ...currentProps };

  // Remove props that cause issues
  for (const propName of fix.propsToRemove) {
    delete newProps[propName];
  }

  // Add/override props
  for (const [key, value] of Object.entries(fix.propsToAdd)) {
    // Handle function props - AI might return them as strings
    if (typeof value === 'string' && value.includes('=>')) {
      try {
        // Try to evaluate arrow functions
        newProps[key] = new Function(`return ${value}`)();
      } catch {
        newProps[key] = () => {};
      }
    } else {
      newProps[key] = value;
    }
  }

  // Accumulate setup code
  const newSetupCode = currentSetupCode + '\n' + (fix.mockCode || '');

  return { newProps, newSetupCode };
}
