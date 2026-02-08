/**
 * AI-powered holistic render error recovery with progressive simplification
 *
 * Strategy:
 * 1. First try: Fix props based on error analysis
 * 2. Second try: Wrap in error boundary + simplify props
 * 3. Third try: Render with minimal props
 * 4. Final: Skip the component (mark as unfixable)
 *
 * The AI analyzes the component holistically and returns ALL fixes needed.
 */

import { z } from 'zod';
import { getAIClient } from '@/lib/ai/client';
import { toJsonSchema } from './schemas';

// Zod schema for structured recovery response
const recoveryFixSchema = z.object({
  propsToAdd: z.record(z.string(), z.unknown()).describe('Props to add or override'),
  propsToRemove: z.array(z.string()).describe('Prop names to remove'),
  mockCode: z.string().describe('Additional JS to inject before component (for custom setup)'),
  reason: z.string().describe('1-2 sentence explanation of the fix'),
  shouldSkip: z.boolean().describe('True if component cannot be rendered'),
  recoveryStrategy: z.enum(['fix-props', 'simplify', 'minimal', 'skip']).describe('Which strategy to use'),
});

export interface RecoveryFix {
  propsToAdd: Record<string, unknown>;
  propsToRemove: string[];
  mockCode: string;
  reason: string;
  shouldSkip: boolean;
  recoveryStrategy?: 'fix-props' | 'simplify' | 'minimal' | 'skip';
}

// Track failure counts per component for progressive simplification
const failureCountMap = new Map<string, number>();

export function getFailureCount(componentName: string): number {
  return failureCountMap.get(componentName) ?? 0;
}

export function incrementFailureCount(componentName: string): number {
  const count = (failureCountMap.get(componentName) ?? 0) + 1;
  failureCountMap.set(componentName, count);
  return count;
}

export function resetFailureCount(componentName: string): void {
  failureCountMap.delete(componentName);
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
  const failureCount = incrementFailureCount(componentName);

  // Progressive simplification based on failure count
  let strategyHint = '';
  let defaultStrategy: RecoveryFix['recoveryStrategy'] = 'fix-props';

  if (failureCount >= 5) {
    // After 5 failures, give up
    console.log(`[render-recovery] ${componentName}: 5+ failures, marking as skip`);
    return {
      propsToAdd: {},
      propsToRemove: [],
      mockCode: '',
      reason: `Component failed ${failureCount} times after exhausting all strategies.`,
      shouldSkip: true,
      recoveryStrategy: 'skip',
    };
  } else if (failureCount === 4) {
    strategyHint = `\n\n## ATTEMPT ${failureCount + 1}: LAST RESORT
This is the FINAL attempt. Try the most minimal render possible:
- Return a simple placeholder div instead of complex JSX
- Mock ALL external calls in mockCode
- If the error is about undefined components, provide stubs in mockCode`;
    defaultStrategy = 'minimal';
  } else if (failureCount === 3) {
    strategyHint = `\n\n## ATTEMPT ${failureCount + 1}: AGGRESSIVE MOCKING
Previous attempts failed. Time for aggressive mocking:
- Add mockCode to define any undefined functions/variables
- Provide all required props with realistic values
- Consider the error message carefully - what exact value is undefined?`;
    defaultStrategy = 'minimal';
  } else if (failureCount === 2) {
    strategyHint = `\n\n## ATTEMPT ${failureCount + 1}: SIMPLIFICATION STRATEGY
Previous fix didn't work. Try a simpler approach:
- Remove complex nested objects, use flat structures
- Use empty arrays [] instead of populated ones
- Add mockCode for any external dependencies`;
    defaultStrategy = 'simplify';
  } else if (failureCount === 1) {
    strategyHint = `\n\n## ATTEMPT ${failureCount + 1}: TARGETED FIX
Analyze the error carefully and provide targeted fixes:
- If "X is undefined", add mockCode to define X
- If "cannot read property of undefined", provide the missing object structure
- Look at what the component actually imports and use`;
    defaultStrategy = 'fix-props';
  }

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
${strategyHint}

## COMMON FAILURE PATTERNS (with exact fixes)

### 1. "Cannot read property 'map' of undefined"
\`\`\`json
{ "propsToAdd": { "items": [] }, "reason": "Add empty array for mapped prop" }
\`\`\`

### 2. "X is not a function"
\`\`\`json
{ "propsToAdd": { "onClick": null }, "mockCode": "", "reason": "Callback will be mocked as noop" }
\`\`\`

### 3. "Invalid hook call" / "Hooks can only be called inside..."
\`\`\`json
{ "mockCode": "// Component needs context provider - already wrapped", "shouldSkip": false, "reason": "Hook context issue" }
\`\`\`
If context is truly missing and can't be mocked, set shouldSkip: true.

### 4. "window is not defined" / "document is not defined"
This is already handled by the template - window/document are always defined in Playwright.
\`\`\`json
{ "mockCode": "", "shouldSkip": false, "reason": "Browser APIs already mocked in template" }
\`\`\`

### 5. "Cannot read property 'x' of null/undefined" (deep access)
\`\`\`json
{ "propsToAdd": { "user": { "name": "Demo User", "email": "demo@example.com" } }, "reason": "Provide nested object structure" }
\`\`\`

## ENVIRONMENT (already provided - these ALL work, do NOT skip because of them)
- React 18 with all hooks
- Browser APIs: matchMedia, localStorage, ResizeObserver, IntersectionObserver
- Context Providers: ThemeProvider, FormProvider, RouterProvider, AuthProvider, QueryClientProvider
- Error boundary and Suspense boundary wrap the component
- Props are wrapped in safe Proxy (returns [] for arrays, {} for objects, () => {} for functions)

## MOCKED LIBRARIES (these are ALREADY MOCKED and WORK - do NOT skip because of them):
- next/link → renders as <a> tag
- next/image → renders as <img> tag
- next/navigation → useRouter, usePathname, useSearchParams all return mock values
- next/router → useRouter returns mock router
- lucide-react → all icons render as SVG placeholders
- framer-motion → motion components render as regular HTML
- @radix-ui/* → all Radix components render as divs
- react-hook-form → useForm, Controller, etc. return mock values
- @tanstack/react-query → useQuery returns { data: null, isLoading: false }
- swr → useSWR returns { data: null, isLoading: false }
- zustand, jotai, recoil, valtio → all state management mocked
- next-themes → useTheme returns { theme: 'light' }
- date-fns, dayjs, moment → return formatted date strings
- recharts → chart components render as placeholder divs

## CRITICAL: NEVER SET shouldSkip: true
You must ALWAYS try to fix the component. Setting shouldSkip: true is NOT ALLOWED except in these rare cases:
- Real WebSocket/Socket.io connections that hang indefinitely
- Camera/microphone getUserMedia() calls
- WebRTC/peer-to-peer connections

EVERYTHING ELSE CAN BE MOCKED. Be creative with mockCode and propsToAdd.

If you see these, they are ALREADY MOCKED - provide fixes instead of skipping:
- next/link, next/image → Already mocked, just works
- useRouter, usePathname → Already mocked
- Server actions (@/lib/actions) → Mocked as async functions returning null
- Data fetching (getWorkout, fetchUser) → Mocked, may return null - add fallback props
- UI libraries (Radix, Lucide) → Already mocked
- State management (Zustand, Jotai) → Already mocked

If a component fails because a function returns null/undefined, provide mock data in propsToAdd.
If a variable is undefined, define it in mockCode.

## YOUR RESPONSE

Return JSON matching this schema:
{
  "propsToAdd": { ... },           // Props to add/override with REALISTIC values
  "propsToRemove": [],             // Props causing issues
  "mockCode": "",                  // Extra JS to run before bundle (see IMPORTANT notes below)
  "reason": "...",                 // 1-2 sentence explanation
  "shouldSkip": false,             // true ONLY if component requires real API/WebSocket/auth
  "recoveryStrategy": "${defaultStrategy}"  // fix-props, simplify, minimal, or skip
}

## IMPORTANT: mockCode guidelines
- mockCode runs at the TOP LEVEL of a script, NOT inside a function
- NEVER use "return" statements - they are ILLEGAL at script level
- NEVER use "export" or "import" statements
- Use mockCode ONLY for: setting window globals, defining helper functions, or adding mock data
- Example VALID mockCode: "window.myGlobal = { foo: 'bar' };"
- Example INVALID mockCode: "return null;" or "if (x) return;"
- When in doubt, leave mockCode as empty string "" and use propsToAdd instead

CRITICAL: Look at what the component ACTUALLY does with props. Provide realistic sample data that matches the expected structure.`;

  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: toJsonSchema(recoveryFixSchema) as object,
      },
    });

    const text = response.text?.trim() || '';

    try {
      const parsed = JSON.parse(text);
      const result = recoveryFixSchema.parse(parsed);

      console.log(`[render-recovery] ${componentName}: AI analysis complete (attempt ${failureCount}) - ${result.reason}`);

      // Override shouldSkip - only allow skip after 4+ failures
      let shouldSkip = result.shouldSkip || false;
      if (shouldSkip && failureCount < 4) {
        console.log(`[render-recovery] ${componentName}: AI wanted to skip but we're only on attempt ${failureCount}, forcing retry`);
        shouldSkip = false;
      }

      return {
        propsToAdd: result.propsToAdd || {},
        propsToRemove: result.propsToRemove || [],
        mockCode: result.mockCode || '',
        reason: result.reason || 'AI suggested fixes',
        shouldSkip,
        recoveryStrategy: result.recoveryStrategy,
      };
    } catch (parseError) {
      console.log(`[render-recovery] ${componentName}: Failed to parse AI response`);
      return {
        propsToAdd: {},
        propsToRemove: [],
        mockCode: '',
        reason: 'Failed to parse AI response',
        shouldSkip: failureCount >= 4, // Only skip after many failures
        recoveryStrategy: 'fix-props',
      };
    }
  } catch (err) {
    console.error(`[render-recovery] ${componentName}: AI analysis failed:`, err);
    return {
      propsToAdd: {},
      propsToRemove: [],
      mockCode: '',
      reason: 'AI analysis failed',
      shouldSkip: failureCount >= 4, // Only skip after many failures
      recoveryStrategy: 'fix-props',
    };
  }
}

/**
 * Sanitize mockCode to remove patterns that would crash top-level script execution
 */
function sanitizeMockCode(mockCode: string): string {
  if (!mockCode || typeof mockCode !== 'string') return '';

  let sanitized = mockCode.trim();

  // Remove bare return statements (illegal at top level)
  // Match: "return" followed by optional value and semicolon/newline
  sanitized = sanitized.replace(/\breturn\s+[^;]*;?/g, '/* removed return */');
  sanitized = sanitized.replace(/\breturn\s*;/g, '/* removed return */');

  // Remove export statements (not valid in injected code)
  sanitized = sanitized.replace(/\bexport\s+(default\s+)?/g, '/* removed export */ ');

  // Remove import statements
  sanitized = sanitized.replace(/\bimport\s+.*?['"]/g, '/* removed import */');

  // Remove any "use strict" or "use client" directives (not needed)
  sanitized = sanitized.replace(/['"]use (strict|client|server)['"];?/g, '');

  // If only comments remain, return empty string
  if (sanitized.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*/g, '').trim() === '') {
    return '';
  }

  return sanitized;
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

  // Accumulate setup code (sanitized to prevent script-level errors)
  const sanitizedMockCode = sanitizeMockCode(fix.mockCode || '');
  const newSetupCode = currentSetupCode + (sanitizedMockCode ? '\n' + sanitizedMockCode : '');

  return { newProps, newSetupCode };
}
