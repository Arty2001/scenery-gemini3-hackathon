// Types
export type {
  ComponentInfo,
  PropInfo,
  AnalysisProgress,
  AnalysisResult,
  RepoContext,
  PropItem,
  InteractiveElement,
} from './types';

// Interactive element extraction
export { extractInteractiveElements, interactiveElementsToString } from './extract-interactive-elements';

// Schemas
export {
  COMPONENT_CATEGORIES,
  categorySchema,
  demoPropsSchema,
  toJsonSchema,
  type ComponentCategory,
  type CategoryResult,
  type DemoPropsResult,
} from './schemas';

// Parser
export { parseComponents } from './parser';

// Scanner
export { getComponentFiles, scanRepository, type ScanOptions } from './scanner';

// Analyzer
export {
  categorizeComponent,
  generateDemoProps,
  generatePreviewHtml,
  analyzeComponent,
  analyzeComponents,
} from './analyzer';
