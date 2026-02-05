import { withCompilerOptions, PropItem } from 'react-docgen-typescript';
import { join } from 'path';
import { existsSync } from 'fs';
import type { ComponentInfo, PropInfo } from './types';

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

    return parsed.map(comp => {
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
  } catch (error) {
    // Return empty array on parse error - caller should track the error
    console.error(`Failed to parse ${filePath}:`, error);
    return [];
  }
}
