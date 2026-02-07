import { withCompilerOptions, PropItem } from 'react-docgen-typescript';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import type { ComponentInfo, PropInfo } from './types';

/**
 * Fallback parser for components that react-docgen-typescript can't detect.
 * This handles:
 * - Async Server Components (Next.js)
 * - Functions without typed props
 * - Arrow function components
 */
function fallbackParseComponents(filePath: string, repoPath: string): ComponentInfo[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const components: ComponentInfo[] = [];
    const relativePath = filePath.replace(repoPath, '').replace(/^[\/\\]/, '');

    // Pattern 1: export default async? function ComponentName
    const defaultFnMatch = content.match(
      /export\s+default\s+(async\s+)?function\s+(\w+)/
    );
    if (defaultFnMatch) {
      const name = defaultFnMatch[2];
      // Verify it returns JSX (has < in the function body)
      if (content.includes('return') && (content.includes('<div') || content.includes('<') && content.includes('/>'))) {
        components.push({
          filePath: relativePath,
          componentName: name,
          displayName: name,
          props: [],
          isCompoundChild: false,
        });
      }
    }

    // Pattern 2: export default ComponentName (reference to function defined above)
    if (components.length === 0) {
      const defaultExportMatch = content.match(/export\s+default\s+(\w+)\s*;?\s*$/m);
      if (defaultExportMatch) {
        const name = defaultExportMatch[1];
        // Check if this name is defined as a function/const in the file
        const fnDefRegex = new RegExp(`(async\\s+)?function\\s+${name}\\s*\\(`);
        const constDefRegex = new RegExp(`const\\s+${name}\\s*=`);
        if (fnDefRegex.test(content) || constDefRegex.test(content)) {
          if (content.includes('<div') || content.includes('<') && content.includes('/>')) {
            components.push({
              filePath: relativePath,
              componentName: name,
              displayName: name,
              props: [],
              isCompoundChild: false,
            });
          }
        }
      }
    }

    // Pattern 3: export const ComponentName = (props) => JSX
    const namedExportMatches = content.matchAll(
      /export\s+(?:const|function)\s+(\w+)\s*[=:]/g
    );
    for (const match of namedExportMatches) {
      const name = match[1];
      // Skip if already added as default
      if (components.some(c => c.componentName === name)) continue;
      // Skip lowercase names (not components) and common non-component exports
      if (name[0] === name[0].toLowerCase()) continue;
      if (['dynamic', 'metadata', 'generateMetadata', 'generateStaticParams'].includes(name)) continue;

      components.push({
        filePath: relativePath,
        componentName: name,
        displayName: name,
        props: [],
        isCompoundChild: false,
      });
    }

    return components;
  } catch {
    return [];
  }
}

// Configure parser with sensible defaults
function createParser(repoPath: string) {
  // Try to find tsconfig.json in repo
  const tsconfigPath = join(repoPath, 'tsconfig.json');
  const hasTsconfig = existsSync(tsconfigPath);

  const compilerOptions = hasTsconfig
    ? undefined // Let it use the repo's tsconfig
    : { esModuleInterop: true, jsx: 2 }; // JSX.React

  return withCompilerOptions(
    compilerOptions ?? {},
    {
      savePropValueAsString: true,
      shouldExtractLiteralValuesFromEnum: true,
      shouldExtractValuesFromUnion: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop: PropItem) => {
        // Exclude HTML attributes inherited from node_modules
        if (prop.declarations?.some(d => d.fileName.includes('node_modules'))) {
          return false;
        }
        // Exclude internal React props
        if (['key', 'ref', 'children'].includes(prop.name) && !prop.description) {
          return false;
        }
        return true;
      },
    }
  );
}

function convertProps(props: Record<string, PropItem>): PropInfo[] {
  return Object.entries(props).map(([name, prop]) => ({
    name,
    type: prop.type.name,
    required: prop.required,
    defaultValue: prop.defaultValue?.value,
    description: prop.description || undefined,
  }));
}

function detectCompoundComponent(displayName: string): { isCompound: boolean; parent?: string } {
  // Detect patterns like Card.Header, Accordion.Item
  if (displayName.includes('.')) {
    const parts = displayName.split('.');
    return { isCompound: true, parent: parts[0] };
  }
  // Detect ForwardRef wrapping
  if (displayName.startsWith('ForwardRef(') || displayName.startsWith('Memo(')) {
    const inner = displayName.match(/\((.+)\)/)?.[1];
    if (inner?.includes('.')) {
      const parts = inner.split('.');
      return { isCompound: true, parent: parts[0] };
    }
  }
  return { isCompound: false };
}

export function parseComponents(filePath: string, repoPath: string): ComponentInfo[] {
  const parser = createParser(repoPath);

  try {
    const parsed = parser.parse(filePath);

    const components = parsed.map(comp => {
      const compound = detectCompoundComponent(comp.displayName);

      return {
        filePath: filePath.replace(repoPath, '').replace(/^[\/\\]/, ''),
        componentName: comp.displayName,
        displayName: comp.displayName,
        description: comp.description || undefined,
        props: convertProps(comp.props),
        isCompoundChild: compound.isCompound,
        parentComponentName: compound.parent,
      };
    });

    // If react-docgen-typescript found nothing, try fallback parser
    // This handles async Server Components, untyped functions, etc.
    if (components.length === 0) {
      const fallbackComponents = fallbackParseComponents(filePath, repoPath);
      if (fallbackComponents.length > 0) {
        console.log(`[parser] ${filePath}: using fallback parser, found ${fallbackComponents.length} component(s)`);
        return fallbackComponents;
      }
    }

    return components;
  } catch (error) {
    // Try fallback parser on error
    const fallbackComponents = fallbackParseComponents(filePath, repoPath);
    if (fallbackComponents.length > 0) {
      console.log(`[parser] ${filePath}: react-docgen failed, fallback found ${fallbackComponents.length} component(s)`);
      return fallbackComponents;
    }

    console.error(`Failed to parse ${filePath}:`, error);
    return [];
  }
}
