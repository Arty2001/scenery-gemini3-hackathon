import { getAIClient } from '@/lib/ai/client';
import { previewHtmlSchema, toJsonSchema } from './schemas';
import type { ComponentInfo, RepoContext } from './types';
import { createMockRequire } from './mock-registry';
import { playwrightClient } from './playwright-client';
import { bundleForBrowser } from './browser-bundler';
import { analyzeAndFix, applyFix } from './render-recovery';
import * as esbuild from 'esbuild';
import { z } from 'zod';

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
      model: 'gemini-3-flash-preview',
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
      model: 'gemini-3-flash-preview',
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
  } catch {
    return null;
  }
}

/**
 * Render a component using the Playwright worker service.
 * Provides highest accuracy by rendering in a real browser with hooks, context, effects.
 */
export async function generatePlaywrightPreviewHtml(
  component: ComponentInfo,
  _repoContext: RepoContext,
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

  // Check if this is a Server Component and transform it
  let codeToBundle = sourceCode;
  if (isServerComponent(sourceCode)) {
    console.log(`[playwright-preview] ${component.componentName}: detected Server Component, transforming...`);
    const transformedCode = await transformServerToClient(
      sourceCode,
      component.componentName,
      component.demoProps
    );
    if (transformedCode) {
      codeToBundle = transformedCode;
      // Also update the sourceCodeMap so imports resolve correctly
      const componentPath = Object.keys(sourceCodeMap).find(
        p => sourceCodeMap[p] === sourceCode
      );
      if (componentPath) {
        sourceCodeMap[componentPath] = transformedCode;
      }
    } else {
      console.log(`[playwright-preview] ${component.componentName}: transformation failed, skipping Playwright`);
      return null;
    }
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
  const MAX_RECOVERY_ATTEMPTS = 2;
  let currentProps = { ...component.demoProps };
  let accumulatedSetup = '';

  for (let attempt = 0; attempt < MAX_RECOVERY_ATTEMPTS && !renderResult.success; attempt++) {
    const errorMsg = renderResult.error || 'Unknown render error';
    const consoleLog = renderResult.consoleLog || '';

    console.log(`[playwright-preview] ${component.componentName}: render failed (attempt ${attempt + 1}): ${errorMsg}`);

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
      console.log(`[playwright-preview] ${component.componentName}: AI found no fixes to apply`);
      return null;
    }

    // Apply the fixes
    const { newProps, newSetupCode } = applyFix(fix, currentProps, accumulatedSetup);
    currentProps = newProps;
    accumulatedSetup = newSetupCode;

    console.log(`[playwright-preview] ${component.componentName}: applying AI fix - ${fix.reason}`);

    // Rebuild with fixes
    const fixedBundle = accumulatedSetup + '\n' + bundleResult.bundledJs;

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
    console.log(`[playwright-preview] ${component.componentName}: all recovery attempts failed`);
    return null;
  }

  console.log(`[playwright-preview] ${component.componentName}: render success (${renderResult.html.length} chars, ${renderResult.renderTime}ms), converting styles...`);

  // Step 3: Convert Tailwind classes to inline styles
  const convertedHtml = await convertClassNamesToInlineStyles(renderResult.html);
  if (!convertedHtml) {
    console.log(`[playwright-preview] ${component.componentName}: style conversion failed`);
    return null;
  }

  console.log(`[playwright-preview] ${component.componentName}: complete (${convertedHtml.length} chars)`);
  return { html: convertedHtml, method: 'playwright' };
}

/**
 * Hybrid preview generation pipeline.
 * Tries Playwright first (highest accuracy), then SSR, then falls back to null for AI-only.
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

  // Step 1: Try Playwright rendering (highest accuracy)
  if (repoPath && relatedSourceCode && playwrightClient.isConfigured()) {
    console.log(`[preview] ${component.componentName}: trying Playwright...`);
    const playwrightResult = await generatePlaywrightPreviewHtml(
      component,
      repoContext,
      sourceCode,
      relatedSourceCode,
      repoPath
    );

    if (playwrightResult) {
      return playwrightResult;
    }
    console.log(`[preview] ${component.componentName}: Playwright failed, trying SSR...`);
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
