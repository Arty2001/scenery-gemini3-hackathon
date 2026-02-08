import { NextRequest, NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import { Type } from '@google/genai';

/**
 * Process pasted HTML through Gemini AI to:
 * 1. Clean and make self-contained (inline all styles)
 * 2. Remove scripts and event handlers for security
 * 3. Categorize the component
 * 4. Generate a description
 */

const processHtmlSchema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: 'A short, descriptive name for this component (e.g., "Pricing Card", "Navigation Menu")',
    },
    description: {
      type: Type.STRING,
      description: 'A brief description of what this component does or displays',
    },
    category: {
      type: Type.STRING,
      description: 'Category: "button", "card", "form", "navigation", "hero", "pricing", "testimonial", "footer", "header", "modal", "table", "list", "badge", "alert", "other"',
    },
    cleanedHtml: {
      type: Type.STRING,
      description: 'The cleaned, self-contained HTML with all styles inlined. Must be valid HTML that renders correctly in isolation.',
    },
  },
  required: ['name', 'description', 'category', 'cleanedHtml'],
};

export async function POST(request: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'AI service unavailable. GEMINI_API_KEY not configured.' },
      { status: 503 }
    );
  }

  try {
    const { html, css } = await request.json();

    if (!html || typeof html !== 'string') {
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      );
    }

    const totalSize = html.length + (css?.length || 0);
    const maxSize = 500000; // 500KB limit
    if (totalSize > maxSize) {
      const sizeKB = Math.round(totalSize / 1024);
      return NextResponse.json(
        { error: `Content too large (${sizeKB}KB). Maximum 500KB allowed. Try copying a smaller section of the page.` },
        { status: 400 }
      );
    }

    const ai = getAIClient();

    // Build the prompt with optional CSS
    const cssSection = css ? `
Here's the CSS that defines the styles for the classes used in the HTML:

\`\`\`css
${css}
\`\`\`

IMPORTANT: Apply these CSS rules to the matching elements by converting them to inline styles.
` : '';

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `You are an expert at processing HTML snippets to make them self-contained and reusable.

Given this HTML (likely copied from a website's inspect element), process it:

1. **Clean the HTML - IMPORTANT: Process ALL elements including nested children:**
   - Convert ALL Tailwind CSS classes to inline styles (you know Tailwind well - flex, p-4, text-lg, bg-blue-500, etc.)
   - Convert any external CSS classes to inline styles${css ? ' (use the provided CSS rules)' : ''}
   - For EVERY element (parent AND all children), convert class-based styles to inline styles
   - Common patterns to recognize:
     * Tailwind: flex, grid, p-*, m-*, text-*, bg-*, border-*, rounded-*, shadow-*, etc.
     * Bootstrap: btn, card, container, row, col-*, etc.
     * Common names: header, nav, sidebar, card, button, etc. - use sensible defaults
   - Remove all <script> tags and inline event handlers (onclick, onmouseover, etc.)
   - Remove class attributes after converting to inline styles
   - Remove any data-* attributes that aren't needed for display
   - Fix relative URLs to use placeholder URLs or remove them
   - Keep the structure and visual appearance intact
   - Ensure colors, fonts, spacing, borders, shadows are all preserved as inline styles

2. **Analyze and categorize:**
   - Give it a short, descriptive name
   - Write a brief description
   - Assign a category

3. **Output requirements:**
   - The cleanedHtml must be valid, self-contained HTML
   - It should render identically to the original (visually)
   - No external dependencies (no Tailwind classes, no external CSS, no class attributes)
   - Every element must have its styles inlined
   - Safe to render in an iframe
${cssSection}
Here's the HTML to process:

\`\`\`html
${html}
\`\`\`

Return the processed result as JSON.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: processHtmlSchema as object,
        maxOutputTokens: 16384, // Increase for large HTML responses
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return NextResponse.json(
        { error: 'AI failed to process HTML' },
        { status: 500 }
      );
    }

    // Clean the response - sometimes Gemini includes markdown code fences
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.slice(7);
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.slice(3);
    }
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.slice(0, -3);
    }
    cleanedResponse = cleanedResponse.trim();

    let result;
    try {
      result = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('JSON parse error. Response was:', cleanedResponse.slice(0, 500));
      return NextResponse.json(
        { error: 'AI returned malformed response. Try with a simpler HTML snippet.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      name: result.name,
      description: result.description,
      category: result.category,
      previewHtml: result.cleanedHtml,
    });
  } catch (error) {
    console.error('Process HTML error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to process HTML: ${message}` },
      { status: 500 }
    );
  }
}
