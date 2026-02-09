import { getAIClient } from '@/lib/ai/client';
import { DEFAULT_MODEL, getModelIdOrDefault, type GeminiModelId } from '@/lib/ai/models';
import { previewHtmlSchema, toJsonSchema } from './schemas';
import type { ComponentInfo, RepoContext } from './types';
import { createMockRequire } from './mock-registry';
import { playwrightClient } from './playwright-client';
import { bundleForBrowser } from './browser-bundler';
import { analyzeAndFix, applyFix } from './render-recovery';
import * as esbuild from 'esbuild';
import { z } from 'zod';

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

/**
 * Check if source code contains Server Component patterns that can't run in browser.
 * Comprehensive detection covering all common scenarios.
 */
function isServerComponent(sourceCode: string): boolean {
  // First, check for explicit client directive - these are NOT server components
  if (/['"]use client['"]/.test(sourceCode)) {
    return false;
  }

  const serverPatterns = [
    // === ASYNC PATTERNS ===
    /export\s+default\s+async\s+function/,  // async default export
    /export\s+async\s+function\s+\w+/,       // named async export
    /const\s+\w+\s*=\s*async\s*\(/,          // async arrow function
    /await\s+\w+[\.\(]/,                      // any await call

    // === SERVER DIRECTIVES ===
    /['"]use server['"]/,

    // === NEXT.JS SERVER IMPORTS ===
    /from\s+['"]next\/headers['"]/,           // cookies(), headers()
    /from\s+['"]next\/cache['"]/,             // revalidatePath, revalidateTag
    /from\s+['"]server-only['"]/,             // server-only package
    /from\s+['"]next\/og['"]/,                // OG image generation

    // === NEXT.JS SERVER FUNCTIONS ===
    /\bredirect\s*\(/,                        // redirect() call
    /\bnotFound\s*\(\s*\)/,                   // notFound() call
    /\bpermanentRedirect\s*\(/,               // permanentRedirect() call
    /\bdraftMode\s*\(\s*\)/,                  // draftMode() call

    // === SERVER ACTION IMPORTS (common patterns) ===
    /from\s+['"]@\/lib\/actions/,
    /from\s+['"]@\/actions/,
    /from\s+['"]\.\.?\/.*actions/,
    /from\s+['"]@\/server/,
    /from\s+['"]@\/lib\/server/,
    /from\s+['"]@\/lib\/db/,
    /from\s+['"]@\/db/,
    /from\s+['"]@\/data/,
    /from\s+['"]@\/lib\/data/,
    /from\s+['"]@\/services/,
    /from\s+['"]@\/lib\/services/,
    /from\s+['"]@\/queries/,
    /from\s+['"]@\/lib\/queries/,
    /from\s+['"]@\/api/,
    /from\s+['"]@\/lib\/api/,

    // === DATABASE LIBRARIES ===
    /from\s+['"]@prisma\/client['"]/,
    /from\s+['"]prisma['"]/,
    /from\s+['"]drizzle-orm/,
    /from\s+['"]mongoose['"]/,
    /from\s+['"]@supabase\/supabase-js['"]/,
    /from\s+['"]@supabase\/ssr['"]/,
    /from\s+['"]@vercel\/postgres['"]/,
    /from\s+['"]@vercel\/kv['"]/,
    /from\s+['"]@vercel\/blob['"]/,
    /from\s+['"]@vercel\/edge-config['"]/,
    /from\s+['"]@planetscale/,
    /from\s+['"]@neondatabase/,
    /from\s+['"]@libsql/,
    /from\s+['"]@turso/,
    /from\s+['"](pg|mysql2|better-sqlite3|sqlite3|redis|ioredis)['"]/,
    /from\s+['"]kysely['"]/,
    /from\s+['"]knex['"]/,
    /from\s+['"]sequelize['"]/,
    /from\s+['"]typeorm['"]/,
    /from\s+['"]@upstash\//,                  // Upstash Redis/Kafka
    /from\s+['"]@xata\.io/,                   // Xata database
    /from\s+['"]convex/,                      // Convex database
    /from\s+['"]firebase-admin/,              // Firebase Admin SDK
    /from\s+['"]@google-cloud\//,             // Google Cloud SDK
    /from\s+['"]@aws-sdk\//,                  // AWS SDK v3
    /from\s+['"]aws-sdk['"]/,                 // AWS SDK v2
    /from\s+['"]@azure\//,                    // Azure SDK

    // === NODE.JS BUILT-INS ===
    /from\s+['"]fs['"]/,
    /from\s+['"]fs\/promises['"]/,
    /from\s+['"]node:fs/,
    /from\s+['"]path['"]/,
    /from\s+['"]node:path/,
    /from\s+['"]crypto['"]/,
    /from\s+['"]node:crypto/,
    /from\s+['"]child_process/,
    /from\s+['"]node:/,                       // any node: protocol
    /from\s+['"]stream['"]/,
    /from\s+['"]os['"]/,
    /from\s+['"]net['"]/,
    /from\s+['"]http['"]/,
    /from\s+['"]https['"]/,
    /from\s+['"]buffer['"]/,
    /from\s+['"]url['"]/,
    /from\s+['"]zlib['"]/,
    /from\s+['"]util['"]/,
    /require\s*\(\s*['"](fs|path|crypto|os|child_process|http|https|net|stream)['"]\)/,

    // === AUTH LIBRARIES (server-side) ===
    /from\s+['"]@clerk\/nextjs\/server['"]/,
    /from\s+['"]next-auth/,
    /from\s+['"]@auth\//,
    /from\s+['"]@supabase\/auth-helpers-nextjs/,
    /from\s+['"]lucia['"]/,
    /from\s+['"]@kinde-oss\/kinde-auth-nextjs\/server/,
    /from\s+['"]@stytch/,
    /from\s+['"]@workos/,
    /from\s+['"]@magic-sdk\/admin/,
    /getServerSession/,
    /getSession.*server/i,
    /\bauth\s*\(\s*\)/,                       // Auth.js auth() call
    /\bcurrentUser\s*\(\s*\)/,                // Clerk currentUser()

    // === SERVER-SIDE FUNCTION CALLS ===
    /cookies\s*\(\s*\)/,
    /headers\s*\(\s*\)/,
    /revalidatePath\s*\(/,
    /revalidateTag\s*\(/,
    /unstable_cache\s*\(/,
    /unstable_noStore\s*\(/,

    // === NEXT.JS DATA PATTERNS ===
    /getServerSideProps/,
    /getStaticProps/,
    /generateMetadata\s*.*async/,
    /generateStaticParams\s*.*async/,
    /generateViewport/,

    // === DATABASE QUERY PATTERNS ===
    /\.(execute|query|run|all|get)\s*\(/,    // SQL methods
    /prisma\.\w+\.(find|create|update|delete|upsert|aggregate|count|groupBy)/,
    /supabase\.(from|rpc|auth)\s*\(/,
    /db\.(select|insert|update|delete|execute)\s*\(/,
    /\.collection\s*\(\s*['"].*['"]\s*\)/,   // MongoDB collections
    /dynamoDB\.(get|put|delete|query|scan)/i, // DynamoDB
    /\.doc\s*\(.*\)\s*\.(get|set|update|delete)\s*\(/, // Firestore

    // === ENVIRONMENT ACCESS (server-only, not NEXT_PUBLIC_) ===
    /process\.env\.(?!NEXT_PUBLIC_)\w+/,      // server-only env vars

    // === FILE SYSTEM OPERATIONS ===
    /\breadFileSync\b|\bwriteFileSync\b|\breaddirSync\b|\bmkdirSync\b/,
    /\breadFile\b|\bwriteFile\b|\breaddir\b|\bmkdir\b|\bunlink\b|\bstat\b/,

    // === FETCH WITH NO-STORE (server pattern) ===
    /fetch\s*\([^)]*cache:\s*['"]no-store['"]/,

    // === EMAIL LIBRARIES ===
    /from\s+['"]resend['"]/,
    /from\s+['"]@sendgrid\//,
    /from\s+['"]nodemailer['"]/,
    /from\s+['"]postmark['"]/,
    /from\s+['"]@mailchimp\//,

    // === PAYMENT LIBRARIES (server-side) ===
    /from\s+['"]stripe['"]/,                  // Stripe server SDK
    /from\s+['"]@lemonsqueezy\//,
    /from\s+['"]@paddle\//,

    // === CMS/CONTENT LIBRARIES ===
    /from\s+['"]contentful['"]/,
    /from\s+['"]@sanity\/client['"]/,
    /from\s+['"]next-sanity['"]/,
    /from\s+['"]@contentlayer\//,
    /from\s+['"]contentlayer\//,
    /from\s+['"]next-mdx-remote\/rsc/,       // MDX server rendering

    // === ANALYTICS/LOGGING (server-side) ===
    /from\s+['"]@sentry\/nextjs/,
    /from\s+['"]pino['"]/,
    /from\s+['"]winston['"]/,

    // === TPRC/API PATTERNS ===
    /from\s+['"]@trpc\/server/,
    /createTRPCContext/,
    /\.query\s*\(\s*\{[\s\S]*?ctx[\s\S]*?\}/,  // tRPC context usage

    // === NEXT.JS 15 ASYNC PARAMS ===
    /params\s*:\s*Promise\s*</,               // async params in Next.js 15
    /searchParams\s*:\s*Promise\s*</,         // async searchParams
    /await\s+params\b/,                        // awaiting params
    /await\s+searchParams\b/,                  // awaiting searchParams
  ];

  return serverPatterns.some(pattern => pattern.test(sourceCode));
}

const clientCodeSchema = z.object({
  code: z.string().describe('The transformed client-side React component code'),
  success: z.boolean().describe('Whether transformation was successful'),
});

const pureReactSchema = z.object({
  code: z.string().describe('The pure React component code with all external dependencies removed'),
  success: z.boolean().describe('Whether transformation was successful'),
  notes: z.string().optional().describe('Any notes about what was changed'),
});

const previewVerificationSchema = z.object({
  isValid: z.boolean().describe('Whether the preview HTML correctly represents the component'),
  reason: z.string().describe('Brief explanation of why it is or is not valid'),
  issues: z.array(z.string()).optional().describe('List of specific issues found'),
});

const generatedPreviewSchema = z.object({
  html: z.string().describe('The generated HTML preview of the component'),
  success: z.boolean().describe('Whether generation was successful'),
});

/**
 * Verify that a Playwright-rendered preview actually matches what the component should look like.
 * Detects loading states, skeletons, empty renders, and other bad captures.
 */
async function verifyPreviewContent(
  componentName: string,
  sourceCode: string,
  previewHtml: string,
  modelId?: GeminiModelId
): Promise<{ isValid: boolean; reason: string }> {
  try {
    const ai = getAIClient();

    const prompt = `You are reviewing a component preview to check if it rendered correctly.

## COMPONENT NAME: ${componentName}

## ORIGINAL SOURCE CODE:
\`\`\`tsx
${sourceCode.slice(0, 3000)}${sourceCode.length > 3000 ? '\n... (truncated)' : ''}
\`\`\`

## RENDERED PREVIEW HTML:
\`\`\`html
${previewHtml.slice(0, 2000)}${previewHtml.length > 2000 ? '\n... (truncated)' : ''}
\`\`\`

## YOUR TASK:
Determine if the preview HTML correctly represents the component. Mark as INVALID if you see any of these issues:

1. **Loading States**: Spinners, "Loading...", skeleton placeholders, pulse animations
2. **Empty/Minimal Content**: Just wrapper divs with no real content, or content that's way too short for what the component should show
3. **Error States**: Error messages, "Something went wrong", fallback UI
4. **Missing Key Elements**: The source shows buttons/forms/cards but the preview doesn't have them
5. **Suspense Fallbacks**: React Suspense fallback content instead of actual component
6. **Placeholder Text**: Lorem ipsum, "placeholder", demo text that doesn't match source

Mark as VALID if:
- The preview shows actual UI elements that match the source code structure
- Interactive elements (buttons, inputs, links) are present
- The content structure roughly matches what the JSX describes
- Even if styling is different, the semantic content is correct

Be strict - if in doubt, mark as INVALID. It's better to regenerate than show a bad preview.`;

    const response = await ai.models.generateContent({
      model: modelId || DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: toJsonSchema(previewVerificationSchema) as object,
        temperature: 0.1, // Low temperature for consistent judgment
      },
    });

    const text = response.text;
    if (!text) {
      return { isValid: true, reason: 'Verification failed, assuming valid' };
    }

    const result = previewVerificationSchema.parse(JSON.parse(text));
    console.log(`[verify-preview] ${componentName}: ${result.isValid ? 'VALID' : 'INVALID'} - ${result.reason}`);

    return { isValid: result.isValid, reason: result.reason };
  } catch (error) {
    console.error(`[verify-preview] ${componentName}: verification error:`, error);
    // On error, assume valid to avoid blocking
    return { isValid: true, reason: 'Verification error, assuming valid' };
  }
}

/**
 * Generate preview HTML directly from source code using Gemini.
 * Used as a fallback when Playwright produces a bad render or fails.
 */
async function generatePreviewHtmlFromSource(
  componentName: string,
  sourceCode: string,
  demoProps: Record<string, unknown>,
  modelId?: GeminiModelId
): Promise<string | null> {
  try {
    const ai = getAIClient();

    const prompt = `You are an expert at generating HTML previews of React components. Generate a static HTML representation of this component that shows what it would look like when rendered.

## COMPONENT NAME: ${componentName}

## SOURCE CODE:
\`\`\`tsx
${sourceCode}
\`\`\`

## DEMO PROPS:
${JSON.stringify(demoProps, null, 2)}

## YOUR TASK:
Generate the HTML that this component would produce when rendered with the demo props.

## RULES:
1. **Use inline styles** - Convert all Tailwind/CSS classes to inline style attributes
2. **Include realistic content** - Use the demo props values, don't use placeholders
3. **Preserve structure** - Match the JSX structure as closely as possible
4. **Keep interactive elements** - Include buttons, inputs, links with proper attributes
5. **Add data-testid** - Add data-testid attributes to interactive elements for targeting
6. **Make it responsive** - Root element should have: width: 100%; max-width: 100%; box-sizing: border-box;
7. **Expand dynamic content** - If there's a .map() over an array, show 2-3 example items

## STYLE REFERENCE:
- Use modern CSS: flexbox, grid, border-radius, box-shadow
- Common colors: #171717 (dark), #737373 (muted), #f5f5f5 (light bg), #ffffff (white)
- Font: font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- Spacing: 4px, 8px, 12px, 16px, 24px, 32px
- Rounded: 4px, 6px, 8px, 12px

Return ONLY the HTML, no wrapper, no explanation. Start directly with the component's root element.`;

    const response = await ai.models.generateContent({
      model: modelId || DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: toJsonSchema(generatedPreviewSchema) as object,
        thinkingConfig: { thinkingBudget: 5000 }, // Use thinking for better output
      },
    });

    const text = response.text;
    if (!text) return null;

    const result = generatedPreviewSchema.parse(JSON.parse(text));
    if (!result.success || !result.html) return null;

    // Wrap in responsive container
    const wrappedHtml = `<div style="width: 100%; max-width: 100%; box-sizing: border-box; overflow: hidden;">${result.html}</div>`;

    console.log(`[ai-preview] ${componentName}: generated preview (${wrappedHtml.length} chars)`);
    return wrappedHtml;
  } catch (error) {
    console.error(`[ai-preview] ${componentName}: generation failed:`, error);
    return null;
  }
}

/**
 * Transform ANY React component into "pure React" that can run in an isolated browser.
 * This removes ALL external imports and replaces them with inline equivalents.
 *
 * Key transformations:
 * - next/link <Link> → <a>
 * - next/image <Image> → <img>
 * - next/navigation useRouter → mock object
 * - lucide-react icons → inline SVG placeholders
 * - framer-motion → regular divs/spans
 * - @radix-ui/* → native HTML equivalents
 * - Any data fetching → inline mock data
 * - Server actions → inline mock functions
 *
 * The result is a self-contained React component that only needs React to render.
 */
async function transformToPureReact(
  sourceCode: string,
  componentName: string,
  demoProps: Record<string, unknown>,
  modelId?: GeminiModelId
): Promise<string | null> {
  try {
    const ai = getAIClient();

    const prompt = `You are an expert React developer. Your task is to transform a React component into "pure React" that can render in an isolated browser environment with ONLY React available.

## COMPONENT NAME: ${componentName}

## ORIGINAL SOURCE CODE:
\`\`\`tsx
${sourceCode}
\`\`\`

## DEMO PROPS (use these values for any data):
${JSON.stringify(demoProps, null, 2)}

## YOUR TASK:
Rewrite this component to be completely self-contained. The ONLY imports allowed are:
- import React from 'react' (optional, can use global React)
- import { useState, useEffect, useRef, ... } from 'react' (React hooks only)

EVERYTHING ELSE must be inlined, replaced, or removed.

## TRANSFORMATION RULES:

### 1. NEXT.JS COMPONENTS → HTML
\`\`\`tsx
// BEFORE:
import Link from 'next/link';
<Link href="/about">About</Link>

// AFTER:
<a href="/about" style={{ textDecoration: 'none', color: 'inherit' }}>About</a>
\`\`\`

\`\`\`tsx
// BEFORE:
import Image from 'next/image';
<Image src="/photo.jpg" alt="Photo" width={200} height={150} />

// AFTER:
<img src="/photo.jpg" alt="Photo" style={{ width: 200, height: 150, objectFit: 'cover' }} />
\`\`\`

### 2. NEXT.JS NAVIGATION → MOCK VALUES
\`\`\`tsx
// BEFORE:
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
const router = useRouter();
const pathname = usePathname();
const params = useSearchParams();

// AFTER:
const router = { push: () => {}, replace: () => {}, back: () => {}, forward: () => {} };
const pathname = '/';
const params = { get: () => null, getAll: () => [] };
\`\`\`

### 3. ICONS (lucide-react, heroicons, etc.) → INLINE SVG
\`\`\`tsx
// BEFORE:
import { ChevronRight, User, Settings } from 'lucide-react';
<ChevronRight className="w-4 h-4" />

// AFTER (simple placeholder):
const ChevronRight = ({ className = '', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const User = ({ className = '', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);
const Settings = ({ className = '', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="12" cy="12" r="3" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
  </svg>
);
\`\`\`

### 4. RADIX UI / HEADLESS UI → NATIVE HTML
\`\`\`tsx
// BEFORE:
import { Button } from '@radix-ui/react-button';
import { Dialog, DialogTrigger, DialogContent } from '@radix-ui/react-dialog';

// AFTER:
const Button = ({ children, onClick, className, ...props }) => (
  <button onClick={onClick} className={className} {...props}>{children}</button>
);
const Dialog = ({ children, open }) => open ? <div className="dialog-overlay">{children}</div> : null;
const DialogTrigger = ({ children, onClick }) => <span onClick={onClick}>{children}</span>;
const DialogContent = ({ children, className }) => (
  <div className={\`dialog-content \${className}\`} style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
    {children}
  </div>
);
\`\`\`

### 5. FRAMER MOTION → STATIC HTML
\`\`\`tsx
// BEFORE:
import { motion } from 'framer-motion';
<motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }}>

// AFTER (just render static):
<div style={{ opacity: 1 }}>
\`\`\`

### 6. DATA FETCHING HOOKS → MOCK DATA
\`\`\`tsx
// BEFORE:
import { useQuery } from '@tanstack/react-query';
const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

// AFTER:
const data = [{ id: '1', name: 'John Doe', email: 'john@example.com' }];
const isLoading = false;
\`\`\`

### 7. FORM LIBRARIES → SIMPLE STATE
\`\`\`tsx
// BEFORE:
import { useForm } from 'react-hook-form';
const { register, handleSubmit } = useForm();

// AFTER:
const [formData, setFormData] = React.useState({});
const register = (name) => ({
  value: formData[name] || '',
  onChange: (e) => setFormData(prev => ({ ...prev, [name]: e.target.value }))
});
const handleSubmit = (onSubmit) => (e) => { e.preventDefault(); onSubmit(formData); };
\`\`\`

### 8. AUTH HOOKS → MOCK USER
\`\`\`tsx
// BEFORE:
import { useUser, useAuth } from '@clerk/nextjs';
const { user, isLoaded } = useUser();

// AFTER:
const user = { id: 'user_1', firstName: 'John', lastName: 'Doe', email: 'john@example.com', imageUrl: 'https://via.placeholder.com/100' };
const isLoaded = true;
\`\`\`

### 9. INTERNAL IMPORTS (@/components/*, @/lib/*) → INLINE OR PLACEHOLDER
For simple UI components, inline them. For complex ones, create a placeholder:
\`\`\`tsx
// If you can see what the imported component does, inline it
// Otherwise, create a simple placeholder:
const SomeComplexComponent = ({ children, ...props }) => <div {...props}>{children}</div>;
\`\`\`

### 10. SERVER ACTIONS → MOCK ASYNC FUNCTIONS
\`\`\`tsx
// BEFORE:
import { submitForm } from '@/lib/actions';
await submitForm(data);

// AFTER:
const submitForm = async (data) => {
  console.log('Form submitted:', data);
  return { success: true };
};
\`\`\`

### 11. REMOVE COMPLETELY (these are not needed for preview):
- 'use client' directive (remove, not needed)
- 'use server' directive (remove, not needed)
- import type statements (remove)
- TypeScript types/interfaces (keep the component working but remove type annotations if they cause issues)

### 12. KEEP AS-IS:
- All JSX structure
- All className strings (Tailwind will be converted to inline styles later)
- All inline styles
- React.useState, React.useEffect, React.useRef, etc.
- Event handlers (onClick, onChange, etc.)
- Conditional rendering
- .map() calls (but use mock data for arrays)

## OUTPUT FORMAT:
Return the COMPLETE, WORKING React component code. It should be able to run in a browser with ONLY React available.

Start with any inline component definitions (icons, UI primitives) at the top, then the main component export.

The component must export default the main component.

Example output structure:
\`\`\`tsx
// Inline icon components
const ChevronRight = (props) => <svg {...props}>...</svg>;
const User = (props) => <svg {...props}>...</svg>;

// Inline UI components
const Button = ({ children, ...props }) => <button {...props}>{children}</button>;

// Main component
export default function ${componentName}(props) {
  // Mock data
  const items = [...];

  // Mock hooks
  const router = { push: () => {} };

  return (
    // Original JSX structure preserved
  );
}
\`\`\``;

    const response = await ai.models.generateContent({
      model: modelId || DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: toJsonSchema(pureReactSchema) as object,
      },
    });

    const text = response.text;
    if (!text) return null;

    const result = pureReactSchema.parse(JSON.parse(text));
    if (!result.success) {
      console.log(`[pure-react] ${componentName}: AI reported transformation failed`);
      return null;
    }

    // Clean up any remaining issues
    let code = result.code;

    // Remove 'use client'/'use server' if AI didn't
    code = code.replace(/['"]use (client|server)['"];?\n?/g, '');

    // Remove any remaining external imports that AI might have missed
    // Only keep React imports
    const lines = code.split('\n');
    const cleanedLines = lines.filter(line => {
      const trimmed = line.trim();
      // Keep non-import lines
      if (!trimmed.startsWith('import ')) return true;
      // Keep React imports
      if (/from\s+['"]react['"]/.test(trimmed)) return true;
      if (/from\s+['"]react\//.test(trimmed)) return true;
      // Remove all other imports
      console.log(`[pure-react] ${componentName}: removing leftover import: ${trimmed}`);
      return false;
    });
    code = cleanedLines.join('\n');

    console.log(`[pure-react] ${componentName}: transformation complete${result.notes ? ` (${result.notes})` : ''}`);
    return code;
  } catch (error) {
    console.error(`[pure-react] ${componentName}: transformation failed:`, error);
    return null;
  }
}

/**
 * Check if a client component uses data fetching that needs mocking.
 * This catches patterns that aren't server components but still fetch data.
 */
function usesDataFetching(sourceCode: string): boolean {
  const dataFetchingPatterns = [
    // React Query / TanStack Query
    /\buseQuery\s*\(/,
    /\buseMutation\s*\(/,
    /\buseInfiniteQuery\s*\(/,
    /\buseSuspenseQuery\s*\(/,

    // SWR
    /\buseSWR\s*\(/,
    /\buseSWRMutation\s*\(/,
    /\buseSWRInfinite\s*\(/,

    // Apollo GraphQL
    /\buseQuery\s*<.*>\s*\(/,
    /\buseLazyQuery\s*\(/,
    /\buseMutation\s*<.*>\s*\(/,
    /\buseSubscription\s*\(/,

    // URQL
    /\buseQuery\s*\(\s*\{/,

    // Fetch in useEffect
    /useEffect\s*\(\s*(?:async\s*)?\(\)\s*=>\s*\{[^}]*fetch\s*\(/,
    /useEffect\s*\([^)]*\)\s*=>\s*\{[^}]*fetch\s*\(/,

    // Axios in useEffect
    /useEffect\s*\([^)]*\{[^}]*axios\./,

    // Custom data hooks (common patterns)
    /\buse[A-Z]\w*Data\s*\(/,
    /\buse[A-Z]\w*Query\s*\(/,
    /\buseFetch\w*\s*\(/,
    /\buseApi\w*\s*\(/,
    /\buseLoad\w*\s*\(/,
    /\buseGet\w*\s*\(/,

    // tRPC client
    /\btrpc\.\w+\.\w+\.useQuery\s*\(/,
    /\bapi\.\w+\.\w+\.useQuery\s*\(/,

    // Convex client
    /\buseQuery\s*\(\s*api\./,
    /\buseMutation\s*\(\s*api\./,

    // Firebase client
    /\buseCollection\s*\(/,
    /\buseDocument\s*\(/,
    /\buseFirestore\w*\s*\(/,

    // Supabase client hooks
    /\buseSupabase\w*\s*\(/,
    /supabase\s*\.\s*from\s*\(/,
  ];

  return dataFetchingPatterns.some(pattern => pattern.test(sourceCode));
}

/**
 * Transform a client component that uses data fetching hooks into a static preview.
 * Replaces useSWR, useQuery, fetch, etc. with mock data.
 */
async function transformDataFetchingToMock(
  sourceCode: string,
  componentName: string,
  demoProps: Record<string, unknown>
): Promise<string | null> {
  try {
    const ai = getAIClient();

    const prompt = `Transform this React component that uses data fetching into a static preview component with mock data.

ORIGINAL CODE:
\`\`\`tsx
${sourceCode}
\`\`\`

COMPONENT NAME: ${componentName}
DEMO PROPS: ${JSON.stringify(demoProps, null, 2)}

YOUR TASK:
Rewrite this component to work WITHOUT any data fetching. Replace all data fetching hooks/calls with realistic mock data.

## DATA FETCHING PATTERNS TO REPLACE:

### 1. React Query / TanStack Query
Before: const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
After:  const data = [{ id: "1", name: "John Doe" }, { id: "2", name: "Jane Smith" }];
        const isLoading = false;

### 2. SWR
Before: const { data, error, isLoading } = useSWR('/api/users', fetcher);
After:  const data = [{ id: "1", name: "John Doe" }];
        const error = null;
        const isLoading = false;

### 3. Fetch in useEffect
Before:
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/data').then(r => r.json()).then(setData);
  }, []);
After:
  const data = { title: "Sample Data", items: ["Item 1", "Item 2"] };

### 4. tRPC / API routes
Before: const { data } = trpc.users.getAll.useQuery();
After:  const data = [{ id: "1", name: "User 1" }];

### 5. Loading states
Before: if (isLoading) return <Skeleton />;
After:  // Remove loading check - we have data immediately

### 6. Error states
Before: if (error) return <Error message={error.message} />;
After:  // Remove error check - no errors with mock data

## RULES:

1. ANALYZE THE JSX to understand what data shape is needed
   - Look at .map() calls to see array item structure
   - Look at property access (data.title, user.name) to see object shape
   - Look at conditional renders to understand optional fields

2. GENERATE REALISTIC MOCK DATA
   - Use real-looking names, emails, dates, prices
   - Match the exact structure the component expects
   - Provide 2-3 items for arrays

3. REMOVE LOADING/ERROR STATES
   - Delete: if (isLoading) return ...
   - Delete: if (error) return ...
   - Delete: if (!data) return ...
   - The mock data is always available

4. KEEP EVERYTHING ELSE
   - All imports (except data fetching hooks)
   - All UI components and styling
   - All event handlers
   - All other hooks (useState for UI state, etc.)

5. REMOVE THESE IMPORTS
   - useSWR, useSWRMutation from 'swr'
   - useQuery, useMutation from '@tanstack/react-query'
   - Apollo/URQL query hooks
   - Any custom data fetching hooks

## EXAMPLE:

Before:
\`\`\`tsx
import { useQuery } from '@tanstack/react-query';
import { UserCard } from './user-card';

export function UserList() {
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(r => r.json())
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!users?.length) return <div>No users</div>;

  return (
    <div className="grid gap-4">
      {users.map(user => (
        <UserCard key={user.id} name={user.name} email={user.email} avatar={user.avatar} />
      ))}
    </div>
  );
}
\`\`\`

After:
\`\`\`tsx
import { UserCard } from './user-card';

export function UserList() {
  const users = [
    { id: "1", name: "Alice Johnson", email: "alice@example.com", avatar: "/avatars/alice.jpg" },
    { id: "2", name: "Bob Smith", email: "bob@example.com", avatar: "/avatars/bob.jpg" },
    { id: "3", name: "Carol Williams", email: "carol@example.com", avatar: "/avatars/carol.jpg" },
  ];

  return (
    <div className="grid gap-4">
      {users.map(user => (
        <UserCard key={user.id} name={user.name} email={user.email} avatar={user.avatar} />
      ))}
    </div>
  );
}
\`\`\`

Return the COMPLETE transformed code. Include all necessary imports.`;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: toJsonSchema(clientCodeSchema) as object,
      },
    });

    const text = response.text;
    if (!text) return null;

    const result = clientCodeSchema.parse(JSON.parse(text));
    if (!result.success) return null;

    console.log(`[transform] ${componentName}: Data fetching → Mock data transformation complete`);
    return result.code;
  } catch (error) {
    console.error(`[transform] ${componentName}: data fetching transformation failed:`, error);
    return null;
  }
}

/**
 * Post-transformation cleanup for patterns that Gemini might miss.
 * This is a safety net that removes any remaining server-side patterns.
 */
function cleanupTransformedCode(code: string): string {
  let cleaned = code;

  // Remove any remaining server-only imports that Gemini missed
  const serverImportPatterns = [
    // Server-only packages
    /import\s+.*\s+from\s+['"]next\/headers['"];?\n?/g,
    /import\s+.*\s+from\s+['"]next\/cache['"];?\n?/g,
    /import\s+.*\s+from\s+['"]server-only['"];?\n?/g,
    /import\s+.*\s+from\s+['"]@prisma\/client['"];?\n?/g,
    /import\s+.*\s+from\s+['"]drizzle-orm[^'"]*['"];?\n?/g,
    /import\s+.*\s+from\s+['"]mongoose['"];?\n?/g,
    /import\s+.*\s+from\s+['"]@supabase\/[^'"]+['"];?\n?/g,
    /import\s+.*\s+from\s+['"]firebase-admin[^'"]*['"];?\n?/g,
    /import\s+.*\s+from\s+['"]@upstash\/[^'"]+['"];?\n?/g,
    /import\s+.*\s+from\s+['"]fs['"];?\n?/g,
    /import\s+.*\s+from\s+['"]fs\/promises['"];?\n?/g,
    /import\s+.*\s+from\s+['"]node:[^'"]+['"];?\n?/g,
    /import\s+.*\s+from\s+['"]path['"];?\n?/g,
    /import\s+.*\s+from\s+['"]crypto['"];?\n?/g,
    /import\s+.*\s+from\s+['"]@\/lib\/actions[^'"]*['"];?\n?/g,
    /import\s+.*\s+from\s+['"]@\/actions[^'"]*['"];?\n?/g,
    /import\s+.*\s+from\s+['"]@\/lib\/db[^'"]*['"];?\n?/g,
    /import\s+.*\s+from\s+['"]@\/db[^'"]*['"];?\n?/g,
    /import\s+.*\s+from\s+['"]@\/server[^'"]*['"];?\n?/g,
    /import\s+.*\s+from\s+['"]@\/lib\/server[^'"]*['"];?\n?/g,
    // Auth libraries
    /import\s+.*\s+from\s+['"]next-auth[^'"]*['"];?\n?/g,
    /import\s+.*\s+from\s+['"]@clerk\/nextjs\/server['"];?\n?/g,
    /import\s+.*\s+from\s+['"]lucia['"];?\n?/g,
    // Email/Payment
    /import\s+.*\s+from\s+['"]resend['"];?\n?/g,
    /import\s+.*\s+from\s+['"]nodemailer['"];?\n?/g,
    /import\s+.*\s+from\s+['"]stripe['"];?\n?/g,
  ];

  for (const pattern of serverImportPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove specific redirect/notFound imports from next/navigation but keep useRouter etc.
  cleaned = cleaned.replace(
    /import\s*\{([^}]*)\}\s*from\s*['"]next\/navigation['"]/g,
    (match, imports) => {
      const cleanedImports = imports
        .split(',')
        .map((i: string) => i.trim())
        .filter((i: string) => !['redirect', 'notFound', 'permanentRedirect'].includes(i))
        .join(', ');
      return cleanedImports ? `import { ${cleanedImports} } from 'next/navigation'` : '';
    }
  );

  // Remove any remaining await statements (replace with the value)
  // This is a simple pattern - Gemini should handle complex cases
  cleaned = cleaned.replace(/await\s+(cookies|headers)\s*\(\s*\)/g, '({ get: () => "" })');

  // Remove redirect/notFound calls that might be in if statements
  cleaned = cleaned.replace(/if\s*\([^)]*\)\s*\{?\s*(redirect|notFound|permanentRedirect)\s*\([^)]*\)\s*;?\s*\}?/g, '');
  cleaned = cleaned.replace(/(redirect|notFound|permanentRedirect)\s*\([^)]*\)\s*;?/g, '');

  // Remove 'use server' directive
  cleaned = cleaned.replace(/['"]use server['"];?\n?/g, '');

  // Remove any remaining process.env that aren't NEXT_PUBLIC
  // Replace with empty string to avoid undefined errors
  cleaned = cleaned.replace(/process\.env\.(?!NEXT_PUBLIC_)(\w+)/g, '""');

  // Clean up multiple empty lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Use Gemini to transform Server Component code into client-renderable code.
 * Replaces async/await, server actions, and database calls with mock data.
 */
async function transformServerToClient(
  sourceCode: string,
  componentName: string,
  demoProps: Record<string, unknown>
): Promise<string | null> {
  try {
    const ai = getAIClient();

    const prompt = `Transform this Next.js Server Component into a client-renderable React component for preview generation.

ORIGINAL CODE:
\`\`\`tsx
${sourceCode}
\`\`\`

COMPONENT NAME: ${componentName}
DEMO PROPS: ${JSON.stringify(demoProps, null, 2)}

TRANSFORMATION RULES:

1. FUNCTION DECLARATION:
   - Remove "async" keyword from function declaration
   - Keep "export default function ${componentName}()" structure
   - If function has params/searchParams as Promise (Next.js 15), extract the awaited value as mock data

2. IMPORTS - REMOVE these server-only imports entirely:
   - @/lib/actions, @/actions, @/server, @/db, @/data, @/services, @/queries, @/api
   - next/headers, next/cache, server-only, next/og
   - @prisma/client, drizzle-orm, mongoose, @supabase/*, convex, firebase-admin
   - @upstash/*, @xata.io/*, @aws-sdk/*, @google-cloud/*, @azure/*
   - fs, path, crypto, child_process, and any node:* imports
   - Auth libraries: next-auth, @clerk/*/server, lucia, @kinde-oss/*, @stytch/*, @workos/*
   - Email: resend, nodemailer, @sendgrid/*, postmark
   - Payment: stripe, @lemonsqueezy/*, @paddle/*
   - CMS: contentful, @sanity/client, contentlayer, next-mdx-remote/rsc

3. IMPORTS - KEEP these (they work in browser):
   - React, react-dom
   - next/link, next/image
   - next/navigation (but remove redirect, notFound, permanentRedirect)
   - UI libraries: lucide-react, @radix-ui/*, class-variance-authority, clsx, tailwind-merge
   - framer-motion, @tanstack/react-query (client-side)
   - Local components from @/components/*

4. AWAIT CALLS - Replace with realistic mock data:
   - Look at how the variable is USED in the JSX to infer the shape
   - For arrays: provide 2-3 realistic items with all accessed properties
   - For objects: include all properties accessed in JSX
   - Use realistic values (names, dates, numbers, URLs)
   - For dates: use new Date().toISOString() or a realistic date string

5. SERVER FUNCTIONS - Replace:
   - redirect("/path"), notFound(), permanentRedirect() → remove entirely
   - cookies().get("x") → "mock-cookie-value"
   - headers().get("x") → "mock-header-value"
   - revalidatePath(), revalidateTag() → remove entirely
   - auth(), currentUser(), getServerSession() → mock user object
   - draftMode() → { isEnabled: false }

6. NEXT.JS 15 ASYNC PARAMS - Handle:
   - params: Promise<{ id: string }> → const params = { id: "123" }
   - searchParams: Promise<{ q: string }> → const searchParams = { q: "search" }
   - await params, await searchParams → remove await, use mock value directly

7. CONDITIONALS - Handle guards:
   - if (!session) redirect("/") → remove the whole if block
   - if (!user) notFound() → remove the whole if block
   - if (!data) return null → provide mock data so it doesn't trigger

8. KEEP UNCHANGED:
   - All JSX structure exactly as-is
   - All className strings
   - All event handlers (onClick, onChange, etc.)
   - All conditional rendering logic (after removing auth guards)
   - All .map() calls (but use mock arrays)
   - process.env.NEXT_PUBLIC_* variables (these work in browser)

EXAMPLE 1 - Basic Server Component:
Before:
  import { getUser, getOrders } from "@/lib/actions";
  import { redirect } from "next/navigation";

  export default async function Dashboard() {
    const user = await getUser();
    if (!user) redirect("/login");
    const orders = await getOrders(user.id);
    return <div>{orders.map(o => <div key={o.id}>{o.name}</div>)}</div>;
  }

After:
  export default function Dashboard() {
    const user = { id: "1", name: "John Doe", email: "john@example.com" };
    const orders = [
      { id: "1", name: "Order #1001", total: 99.99 },
      { id: "2", name: "Order #1002", total: 149.99 },
    ];
    return <div>{orders.map(o => <div key={o.id}>{o.name}</div>)}</div>;
  }

EXAMPLE 2 - Next.js 15 Async Params:
Before:
  export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getData(id);
    return <div>{data.title}</div>;
  }

After:
  export default function Page() {
    const id = "123";
    const data = { id: "123", title: "Sample Title", description: "A description" };
    return <div>{data.title}</div>;
  }

EXAMPLE 3 - Auth Protected Component:
Before:
  import { auth } from "@/auth";
  import { redirect } from "next/navigation";

  export default async function Profile() {
    const session = await auth();
    if (!session) redirect("/login");
    return <div>Welcome, {session.user.name}</div>;
  }

After:
  export default function Profile() {
    const session = { user: { name: "John Doe", email: "john@example.com", image: "/avatar.jpg" } };
    return <div>Welcome, {session.user.name}</div>;
  }

Return the COMPLETE transformed code that can render in a browser. Make sure all imports used in the code are included.`;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: toJsonSchema(clientCodeSchema) as object,
      },
    });

    const text = response.text;
    if (!text) return null;

    const result = clientCodeSchema.parse(JSON.parse(text));
    if (!result.success) return null;

    // Run cleanup to catch any patterns Gemini might have missed
    const cleanedCode = cleanupTransformedCode(result.code);

    console.log(`[transform] ${componentName}: Server→Client transformation complete`);
    return cleanedCode;
  } catch (error) {
    console.error(`[transform] ${componentName}: transformation failed:`, error);
    return null;
  }
}

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

## CRITICAL: Make content RESPONSIVE
- The root/outermost element MUST have: width: 100%; max-width: 100%; box-sizing: border-box;
- Convert fixed pixel widths to percentage or max-width where sensible:
  - w-96 (384px) -> max-width: 384px; width: 100%
  - w-64 (256px) -> max-width: 256px; width: 100%
  - Large containers should use width: 100% not fixed pixels
- Keep small fixed widths for icons/buttons (e.g., w-8, w-10, w-12)
- Add max-width: 100% to images and media elements
- Use flex-wrap: wrap for flex containers where appropriate

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
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: toJsonSchema(previewHtmlSchema) as object,
      },
    });

    const text = response.text;
    if (!text) return null;

    const parsed = previewHtmlSchema.parse(JSON.parse(text));

    // Wrap in a responsive container that scales content to fit
    const responsiveHtml = `<div style="width: 100%; max-width: 100%; box-sizing: border-box; overflow: hidden;">${parsed.html}</div>`;
    return responsiveHtml;
  } catch (error) {
    console.error(`[style-conversion] Error converting styles:`, error instanceof Error ? error.message : String(error));
    // Instead of failing completely, return the original HTML with minimal inline styles wrapper
    // This allows preview to work even if style conversion fails
    console.log(`[style-conversion] Falling back to original HTML with basic wrapper`);
    return `<div style="width: 100%; max-width: 100%; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${html}</div>`;
  }
}

/**
 * Render a component using the Playwright worker service.
 * Provides highest accuracy by rendering in a real browser with hooks, context, effects.
 *
 * NEW APPROACH: Transform ALL components to "pure React" first using AI.
 * This removes all external dependencies from the source code itself,
 * making bundling simple and reliable.
 */
export async function generatePlaywrightPreviewHtml(
  component: ComponentInfo,
  repoContext: RepoContext,
  sourceCode: string,
  sourceCodeMap: Record<string, string>,
  repoPath: string
): Promise<{ html: string; method: 'playwright' } | null> {
  // Need source code and demo props
  if (!sourceCode || !component.demoProps) {
    console.log(`[playwright-preview] ${component.componentName}: skipped (no source or demoProps)`);
    return null;
  }

  // Check if Playwright worker is configured
  if (!playwrightClient.isConfigured()) {
    console.log(`[playwright-preview] ${component.componentName}: worker not configured`);
    return null;
  }

  // Get AI model from project settings
  const modelId = getModelForContext(repoContext);
  console.log(`[playwright-preview] ${component.componentName}: using AI model: ${modelId}`);

  // Log component details for debugging
  console.log(`[playwright-preview] ${component.componentName}: starting pure React transformation...`);
  console.log(`[playwright-preview] ${component.componentName}: source length: ${sourceCode.length} chars`);
  console.log(`[playwright-preview] ${component.componentName}: demoProps: ${JSON.stringify(component.demoProps, null, 2)}`);

  // NEW APPROACH: Transform ALL components to "pure React" using AI
  // This removes ALL external imports and replaces them with inline equivalents
  // Much more reliable than trying to mock everything in the bundle
  console.log(`[playwright-preview] ${component.componentName}: transforming to pure React...`);

  const pureReactCode = await transformToPureReact(
    sourceCode,
    component.componentName,
    component.demoProps,
    modelId
  );

  if (!pureReactCode) {
    console.log(`[playwright-preview] ${component.componentName}: pure React transformation FAILED, skipping Playwright`);
    return null;
  }

  console.log(`[playwright-preview] ${component.componentName}: pure React transformation SUCCESS`);
  console.log(`[playwright-preview] ${component.componentName}: TRANSFORMED CODE:\n========================================\n${pureReactCode}\n========================================`);

  const codeToBundle = pureReactCode;

  // Update the sourceCodeMap so any self-imports resolve correctly
  const componentPath = Object.keys(sourceCodeMap).find(
    p => sourceCodeMap[p] === sourceCode
  );
  if (componentPath) {
    sourceCodeMap[componentPath] = pureReactCode;
  }

  console.log(`[playwright-preview] ${component.componentName}: bundling for browser...`);

  // Step 1: Bundle the component for browser execution
  const bundleResult = await bundleForBrowser({
    sourceCode: codeToBundle,
    componentName: component.componentName,
    repoPath,
    sourceCodeMap,
  });

  if (!bundleResult.success || !bundleResult.bundledJs) {
    console.log(`[playwright-preview] ${component.componentName}: bundle failed: ${bundleResult.error}`);
    return null;
  }

  console.log(`[playwright-preview] ${component.componentName}: bundle success (${bundleResult.bundledJs.length} chars), rendering...`);

  // Step 2: Render in Playwright worker
  let renderResult = await playwrightClient.renderWithRetry({
    bundledJs: bundleResult.bundledJs,
    componentName: component.componentName,
    props: component.demoProps,
    timeout: 15000,
  });

  // If render failed, use AI to analyze the component holistically and fix it
  // Template already handles most issues, but some components need specific props/data
  // We try up to 4 times (matching render-recovery.ts which only skips after 4+ failures)
  const MAX_RECOVERY_ATTEMPTS = 4;
  let currentProps = { ...component.demoProps };
  let accumulatedSetup = '';

  for (let attempt = 0; attempt < MAX_RECOVERY_ATTEMPTS && !renderResult.success; attempt++) {
    const errorMsg = renderResult.error || 'Unknown render error';
    const consoleLog = renderResult.consoleLog || '';

    console.log(`[playwright-preview] ${component.componentName}: render failed (attempt ${attempt + 1})`);
    console.log(`[playwright-preview] ${component.componentName}: error: ${errorMsg}`);
    if (consoleLog) {
      console.log(`[playwright-preview] ${component.componentName}: browser console:\n    ${consoleLog.split('; ').join('\n    ')}`);
    }

    // Log the full code that failed
    console.log(`[playwright-preview] ${component.componentName}: CODE THAT FAILED:\n========================================\n${codeToBundle}\n========================================`);

    // Ask AI to analyze the whole component and suggest fixes
    const fix = await analyzeAndFix(
      component.componentName,
      codeToBundle,
      errorMsg,
      consoleLog,
      currentProps
    );

    // If AI says skip, give up
    if (fix.shouldSkip) {
      console.log(`[playwright-preview] ${component.componentName}: AI says skip - ${fix.reason}`);
      return null;
    }

    // Check if AI suggested any changes
    const hasChanges = Object.keys(fix.propsToAdd).length > 0 ||
                       fix.propsToRemove.length > 0 ||
                       fix.mockCode.length > 0;

    if (!hasChanges) {
      console.log(`[playwright-preview] ${component.componentName}: AI found no fixes to apply, trying default recovery`);

      // Default recovery: add common props that might be missing
      // For React #130 errors with pure React code, the issue is often in the bundle/runtime
      // Try adding a mock code that ensures window.React is available
      const defaultMockCode = `
        // Default recovery - ensure React is available
        if (typeof window.React === 'undefined') {
          console.error('[recovery] window.React is undefined! This should not happen.');
        }
        // Ensure jsx/jsxs are available
        if (typeof jsx === 'undefined' && typeof window.React !== 'undefined') {
          window.jsx = window.React.createElement;
          window.jsxs = window.React.createElement;
        }
      `;
      accumulatedSetup += defaultMockCode;

      // Continue with the recovery attempt instead of returning null
    }

    // Apply the fixes
    const { newProps, newSetupCode } = applyFix(fix, currentProps, accumulatedSetup);
    currentProps = newProps;
    accumulatedSetup = newSetupCode;

    console.log(`[playwright-preview] ${component.componentName}: applying AI fix - ${fix.reason}`);

    // Rebuild with fixes - wrap mockCode safely to prevent script parse errors
    // AI might generate invalid top-level code like "return null;" which would crash the entire script
    const safeMockCode = accumulatedSetup.trim()
      ? `
// AI Recovery MockCode (wrapped in IIFE for safety)
try {
  (function() {
    ${accumulatedSetup}
  })();
} catch (_mockErr) {
  console.warn('[mockCode] AI recovery code failed:', _mockErr.message);
}
`
      : '';
    const fixedBundle = safeMockCode + bundleResult.bundledJs;

    // Retry render
    renderResult = await playwrightClient.renderWithRetry({
      bundledJs: fixedBundle,
      componentName: component.componentName,
      props: currentProps,
      timeout: 15000,
    });

    if (renderResult.success && renderResult.html) {
      console.log(`[playwright-preview] ${component.componentName}: recovery successful after ${attempt + 1} attempt(s)!`);
      break;
    }
  }

  // Final check
  if (!renderResult.success || !renderResult.html) {
    console.log(`[playwright-preview] ${component.componentName}: all recovery attempts failed, trying AI generation...`);

    // Fallback: Generate preview directly from source code using AI
    const aiPreview = await generatePreviewHtmlFromSource(
      component.componentName,
      sourceCode,
      component.demoProps,
      modelId
    );

    if (aiPreview) {
      console.log(`[playwright-preview] ${component.componentName}: AI fallback succeeded`);
      return { html: aiPreview, method: 'playwright' };
    }

    return null;
  }

  console.log(`[playwright-preview] ${component.componentName}: render success (${renderResult.html.length} chars, ${renderResult.renderTime}ms), verifying content...`);

  // Step 3: Verify the preview content is actually correct (not a loading state, etc.)
  const verification = await verifyPreviewContent(
    component.componentName,
    sourceCode,
    renderResult.html,
    modelId
  );

  // If preview is invalid, regenerate using AI
  if (!verification.isValid) {
    console.log(`[playwright-preview] ${component.componentName}: preview invalid (${verification.reason}), regenerating with AI...`);

    const aiPreview = await generatePreviewHtmlFromSource(
      component.componentName,
      sourceCode,
      component.demoProps,
      modelId
    );

    if (aiPreview) {
      console.log(`[playwright-preview] ${component.componentName}: AI regeneration succeeded`);
      return { html: aiPreview, method: 'playwright' };
    }

    // If AI also fails, use the original (bad) preview as last resort
    console.log(`[playwright-preview] ${component.componentName}: AI regeneration failed, using original preview`);
  }

  // Step 4: Convert Tailwind classes to inline styles
  const convertedHtml = await convertClassNamesToInlineStyles(renderResult.html);
  if (!convertedHtml) {
    console.log(`[playwright-preview] ${component.componentName}: style conversion failed`);
    return null;
  }

  console.log(`[playwright-preview] ${component.componentName}: complete (${convertedHtml.length} chars)`);
  return { html: convertedHtml, method: 'playwright' };
}

/**
 * Check if component has imports that absolutely cannot be handled.
 * With the new pure React transformation, most "problematic" imports are now handled.
 * Only truly unrenderable components (3D, Canvas, etc.) should be skipped.
 */
function hasUnrenderablePatterns(sourceCode: string): boolean {
  const unrenerablePatterns = [
    // 3D/Canvas - these require WebGL context and complex setup
    /import\s+.*from\s+['"]@react-three/,
    /import\s+.*from\s+['"]three['"]/,
    /import\s+.*from\s+['"]@babylonjs/,

    // Real-time communication - require actual connections
    /import\s+.*from\s+['"]socket\.io/,
    /import\s+.*from\s+['"]@liveblocks/,
    /import\s+.*from\s+['"]@ably/,

    // Media capture - requires actual hardware
    /getUserMedia/,
    /navigator\.mediaDevices/,

    // WebRTC
    /RTCPeerConnection/,
    /import\s+.*from\s+['"]simple-peer/,
  ];

  return unrenerablePatterns.some(pattern => pattern.test(sourceCode));
}

/**
 * Hybrid preview generation pipeline.
 * NEW APPROACH: Uses AI to transform components to "pure React" first, then renders in Playwright.
 * This handles ALL components including those with Next.js imports, data fetching, auth, etc.
 * Only truly unrenderable components (3D, WebRTC, etc.) are skipped.
 */
export async function generateHybridPreviewHtml(
  component: ComponentInfo,
  repoContext: RepoContext,
  sourceCode: string,
  relatedSourceCode?: Record<string, string>,
  repoPath?: string
): Promise<{ html: string; method: 'playwright' | 'hybrid' | 'ai-only' } | null> {
  // Need source code and demo props
  if (!sourceCode || !component.demoProps) {
    console.log(`[preview] ${component.componentName}: skipped (no source or demoProps)`);
    return null;
  }

  // Only skip truly unrenderable components (3D, WebRTC, etc.)
  if (hasUnrenderablePatterns(sourceCode)) {
    console.log(`[preview] ${component.componentName}: has unrenderable patterns (3D/WebRTC/etc.) → AI generation`);
    return null; // Will trigger AI-only fallback
  }

  // Step 1: Try Playwright rendering with pure React transformation
  // This now handles ALL components by transforming them to pure React first
  const playwrightConfigured = playwrightClient.isConfigured();
  console.log(`[preview] ${component.componentName}: trying Playwright with pure React transformation (configured: ${playwrightConfigured})`);

  if (repoPath && relatedSourceCode && playwrightConfigured) {
    const playwrightResult = await generatePlaywrightPreviewHtml(
      component,
      repoContext,
      sourceCode,
      relatedSourceCode,
      repoPath
    );

    if (playwrightResult) {
      console.log(`[preview] ${component.componentName}: Playwright SUCCESS`);
      return playwrightResult;
    }
    console.log(`[preview] ${component.componentName}: Playwright failed, trying SSR...`);
  } else {
    console.log(`[preview] ${component.componentName}: skipping Playwright (missing: ${!repoPath ? 'repoPath ' : ''}${!relatedSourceCode ? 'relatedCode ' : ''}${!playwrightConfigured ? 'config ' : ''})`);
  }

  // Step 2: Try SSR rendering (fast, limited compatibility)
  console.log(`[preview] ${component.componentName}: attempting SSR...`);
  const ssrResult = await ssrRenderComponent(
    sourceCode,
    component.componentName,
    component.demoProps
  );

  if (!ssrResult) {
    console.log(`[preview] ${component.componentName}: SSR failed, falling back to AI-only`);
    return null;
  }

  // Check HTML is non-trivial
  if (ssrResult.html.length <= 50) {
    console.log(`[preview] ${component.componentName}: SSR output too short (${ssrResult.html.length} chars), falling back`);
    return null;
  }

  // Check it's more than just a wrapper div
  const stripped = ssrResult.html.replace(/<\/?div[^>]*>/g, '').trim();
  if (stripped.length === 0) {
    console.log(`[preview] ${component.componentName}: SSR output is empty divs, falling back`);
    return null;
  }

  console.log(`[preview] ${component.componentName}: SSR success (${ssrResult.html.length} chars), converting styles...`);

  // Step 3: Convert Tailwind classes to inline styles
  const convertedHtml = await convertClassNamesToInlineStyles(ssrResult.html);
  if (!convertedHtml) {
    console.log(`[preview] ${component.componentName}: style conversion failed, falling back`);
    return null;
  }

  console.log(`[preview] ${component.componentName}: hybrid complete (${convertedHtml.length} chars)`);
  return { html: convertedHtml, method: 'hybrid' };
}
