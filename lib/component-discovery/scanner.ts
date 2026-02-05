import { glob } from 'glob';
import { join } from 'path';
import type { ComponentInfo, AnalysisProgress } from './types';
import { parseComponents } from './parser';

const COMPONENT_FILE_PATTERNS = ['**/*.tsx', '**/*.jsx'];

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.stories.*',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
];

export async function getComponentFiles(repoPath: string): Promise<string[]> {
  const files = await glob(COMPONENT_FILE_PATTERNS, {
    cwd: repoPath,
    ignore: IGNORE_PATTERNS,
    absolute: false,
    nodir: true,
  });

  return files.map(f => join(repoPath, f));
}

export interface ScanOptions {
  onProgress?: (progress: AnalysisProgress) => void;
}

export async function scanRepository(
  repoPath: string,
  options: ScanOptions = {}
): Promise<{ components: ComponentInfo[]; errors: Array<{ file: string; error: string }> }> {
  const files = await getComponentFiles(repoPath);

  const progress: AnalysisProgress = {
    total: files.length,
    processed: 0,
    currentFile: '',
    errors: [],
  };

  const allComponents: ComponentInfo[] = [];

  for (const filePath of files) {
    progress.currentFile = filePath.replace(repoPath, '').replace(/^[\/\\]/, '');
    options.onProgress?.(progress);

    try {
      const components = parseComponents(filePath, repoPath);
      allComponents.push(...components);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      progress.errors.push({ file: progress.currentFile, error: errorMessage });
    }

    progress.processed++;
  }

  // Final progress update
  options.onProgress?.(progress);

  return {
    components: allComponents,
    errors: progress.errors,
  };
}
