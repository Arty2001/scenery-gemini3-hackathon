/**
 * Extracts structured information about interactive elements from component preview HTML.
 * Used for cursor targeting in tutorials and the element picker UI.
 */

import type { InteractiveElement } from './types';

/**
 * Extract interactive elements from HTML and return structured data.
 * Identifies buttons, inputs, selects, textareas, and links with their attributes.
 */
export function extractInteractiveElements(html: string): InteractiveElement[] {
  const elements: InteractiveElement[] = [];
  const seenSelectors = new Set<string>();

  // Debug: Log input HTML length
  console.log(`[extractInteractiveElements] Parsing HTML (${html?.length ?? 0} chars)`);

  if (!html) {
    console.log('[extractInteractiveElements] No HTML provided');
    return [];
  }

  // Match interactive HTML elements with their attributes
  // This regex captures the opening tag and attributes. For buttons/links, we extract
  // text content separately since they may have nested elements.
  const openTagRegex = /<(input|button|textarea|select|a|label)\b([^>]*)(?:\/?>)/gi;
  let match;
  let count = 0;

  while ((match = openTagRegex.exec(html)) !== null && count < 30) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] || '';
    const matchStart = match.index;

    // For self-closing tags (input), there's no text content
    // For container tags (button, a, etc.), extract text by finding the closing tag
    let textContent = '';
    if (tag !== 'input' && !match[0].endsWith('/>')) {
      // Find the corresponding closing tag and extract text between
      const closingTag = `</${tag}>`;
      const afterOpen = matchStart + match[0].length;
      const closingIndex = html.toLowerCase().indexOf(closingTag, afterOpen);
      if (closingIndex > afterOpen) {
        // Get inner content and strip all HTML tags to get just text
        const innerHtml = html.slice(afterOpen, closingIndex);
        textContent = innerHtml.replace(/<[^>]*>/g, '').trim();
      }
    }

    // Extract attributes
    const type = attrs.match(/type=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const name = attrs.match(/name=["']([^"']+)["']/i)?.[1];
    const id = attrs.match(/id=["']([^"']+)["']/i)?.[1];
    const placeholder = attrs.match(/placeholder=["']([^"']+)["']/i)?.[1];
    const className = attrs.match(/class=["']([^"']+)["']/i)?.[1];
    const role = attrs.match(/role=["']([^"']+)["']/i)?.[1];
    const testId = attrs.match(/data-testid=["']([^"']+)["']/i)?.[1];
    const ariaLabel = attrs.match(/aria-label=["']([^"']+)["']/i)?.[1];
    const value = attrs.match(/value=["']([^"']+)["']/i)?.[1];

    // Skip hidden inputs and labels without for attribute
    if (tag === 'input' && type === 'hidden') continue;
    if (tag === 'label' && !attrs.includes('for=')) continue;

    // Build the most specific selector
    const selector = buildSelector(tag, { type, name, id, className, testId, role });

    // Skip duplicates
    if (seenSelectors.has(selector)) continue;
    seenSelectors.add(selector);

    // Build human-readable label
    const label = buildLabel(tag, {
      type, name, placeholder, textContent, ariaLabel, value, className
    });

    // Determine suggested action based on element type
    const suggestedAction = getSuggestedAction(tag, type);

    // Extract first few classes
    const classes = className
      ? className.split(/\s+/).filter(c => c && !c.includes(':')).slice(0, 3)
      : undefined;

    elements.push({
      tag,
      selector,
      label,
      type: type || undefined,
      name: name || undefined,
      placeholder: placeholder || undefined,
      classes: classes?.length ? classes : undefined,
      role: role || undefined,
      testId: testId || undefined,
      suggestedAction,
    });

    count++;
  }

  // Sort by tag importance: buttons first, then inputs, then others
  const tagOrder: Record<string, number> = {
    button: 0,
    input: 1,
    select: 2,
    textarea: 3,
    a: 4,
    label: 5,
  };

  elements.sort((a, b) => (tagOrder[a.tag] ?? 99) - (tagOrder[b.tag] ?? 99));

  console.log(`[extractInteractiveElements] Found ${elements.length} elements:`, elements.map(e => `${e.tag}[${e.selector}]`));

  return elements;
}

/**
 * Build the most specific CSS selector for an element.
 */
function buildSelector(
  tag: string,
  attrs: {
    type?: string;
    name?: string;
    id?: string;
    className?: string;
    testId?: string;
    role?: string;
  }
): string {
  // Prefer data-testid for stability
  if (attrs.testId) {
    return `[data-testid="${attrs.testId}"]`;
  }

  // Prefer ID for uniqueness
  if (attrs.id) {
    return `#${attrs.id}`;
  }

  // Build selector from tag + attributes
  let selector = tag;

  if (attrs.type && tag === 'input') {
    selector += `[type="${attrs.type}"]`;
  }

  if (attrs.name) {
    selector += `[name="${attrs.name}"]`;
  }

  if (attrs.role) {
    selector += `[role="${attrs.role}"]`;
  }

  // Add first meaningful class if no name/type
  if (!attrs.name && !attrs.type && attrs.className) {
    const firstClass = attrs.className
      .split(/\s+/)
      .find(c => c && !c.includes(':') && !c.match(/^(w-|h-|p-|m-|flex|grid|text-|bg-|border)/));
    if (firstClass) {
      selector += `.${firstClass}`;
    }
  }

  return selector;
}

/**
 * Build a human-readable label for display in the UI.
 */
function buildLabel(
  tag: string,
  attrs: {
    type?: string;
    name?: string;
    placeholder?: string;
    textContent?: string;
    ariaLabel?: string;
    value?: string;
    className?: string;
  }
): string {
  // For buttons, use text content or aria-label
  if (tag === 'button' || (tag === 'input' && attrs.type === 'submit')) {
    if (attrs.textContent) return `"${truncate(attrs.textContent, 30)}" button`;
    if (attrs.ariaLabel) return `"${truncate(attrs.ariaLabel, 30)}" button`;
    if (attrs.value) return `"${truncate(attrs.value, 30)}" button`;

    // Try to get a meaningful class name
    if (attrs.className) {
      const meaningfulClass = attrs.className
        .split(/\s+/)
        .find(c => c.match(/btn|button|submit|primary|secondary|cta/i));
      if (meaningfulClass) return `${meaningfulClass} button`;
    }

    return 'Button';
  }

  // For inputs, describe by type and name/placeholder
  if (tag === 'input') {
    const inputType = attrs.type || 'text';

    if (inputType === 'checkbox') {
      if (attrs.name) return `"${attrs.name}" checkbox`;
      return 'Checkbox';
    }

    if (inputType === 'radio') {
      if (attrs.name) return `"${attrs.name}" radio`;
      return 'Radio button';
    }

    // Text-like inputs
    if (attrs.placeholder) return `${inputType} input "${truncate(attrs.placeholder, 20)}"`;
    if (attrs.name) return `${inputType} input "${attrs.name}"`;
    if (attrs.ariaLabel) return `${inputType} input "${truncate(attrs.ariaLabel, 20)}"`;

    return `${inputType} input`;
  }

  // For select
  if (tag === 'select') {
    if (attrs.name) return `"${attrs.name}" dropdown`;
    if (attrs.ariaLabel) return `"${truncate(attrs.ariaLabel, 20)}" dropdown`;
    return 'Dropdown';
  }

  // For textarea
  if (tag === 'textarea') {
    if (attrs.placeholder) return `"${truncate(attrs.placeholder, 20)}" textarea`;
    if (attrs.name) return `"${attrs.name}" textarea`;
    return 'Text area';
  }

  // For links
  if (tag === 'a') {
    if (attrs.textContent) return `"${truncate(attrs.textContent, 25)}" link`;
    if (attrs.ariaLabel) return `"${truncate(attrs.ariaLabel, 25)}" link`;
    return 'Link';
  }

  return tag;
}

/**
 * Determine the suggested interaction action based on element type.
 */
function getSuggestedAction(
  tag: string,
  type?: string
): InteractiveElement['suggestedAction'] {
  if (tag === 'button') return 'click';
  if (tag === 'a') return 'click';
  if (tag === 'select') return 'select';
  if (tag === 'textarea') return 'type';

  if (tag === 'input') {
    switch (type) {
      case 'checkbox':
        return 'check';
      case 'radio':
        return 'click';
      case 'submit':
      case 'button':
      case 'reset':
        return 'click';
      case 'text':
      case 'email':
      case 'password':
      case 'search':
      case 'tel':
      case 'url':
      case 'number':
      default:
        return 'type';
    }
  }

  return 'click';
}

/**
 * Truncate a string to a maximum length.
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Convert interactive elements to a simple string summary (for AI context).
 * This is the same format as the old extractInteractiveElements in use-chat.ts.
 */
export function interactiveElementsToString(elements: InteractiveElement[]): string {
  if (!elements || elements.length === 0) return '';

  return elements
    .map(el => {
      let desc = el.selector;
      if (el.placeholder) desc += ` placeholder="${el.placeholder}"`;
      if (el.classes?.length) desc += ` .${el.classes.join('.')}`;
      return desc;
    })
    .join(', ');
}
