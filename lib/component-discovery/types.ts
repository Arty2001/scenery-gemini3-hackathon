// Re-export PropItem from react-docgen-typescript for convenience
export type { PropItem } from 'react-docgen-typescript';

export interface PropInfo {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

/**
 * Structured information about an interactive element in a component.
 * Used for cursor targeting in tutorials.
 */
export interface InteractiveElement {
  /** HTML tag name (button, input, select, textarea, a) */
  tag: string;
  /** CSS selector to target this element */
  selector: string;
  /** Human-readable label for UI display */
  label: string;
  /** Input type (text, email, checkbox, submit, etc.) */
  type?: string;
  /** Element name attribute */
  name?: string;
  /** Placeholder text */
  placeholder?: string;
  /** First few CSS classes */
  classes?: string[];
  /** ARIA role if present */
  role?: string;
  /** Data-testid if present */
  testId?: string;
  /** Suggested interaction action */
  suggestedAction: 'click' | 'hover' | 'focus' | 'type' | 'select' | 'check';
}

export interface ComponentInfo {
  /** Database ID (set after saving to DB) */
  id?: string;
  filePath: string;
  componentName: string;
  displayName?: string;
  description?: string;
  props: PropInfo[];
  // Set after AI analysis
  category?: string;
  categoryConfidence?: number;
  secondaryCategories?: string[];
  demoProps?: Record<string, unknown>;
  demoPropsConfidence?: 'high' | 'medium' | 'low';
  // For compound components
  isCompoundChild?: boolean;
  parentComponentName?: string;
  // Component relationships (for AI context)
  /** Components that this component imports/uses */
  usesComponents?: string[];
  /** Components that import/use this component */
  usedByComponents?: string[];
  /** Related components in the same file or directory */
  relatedComponents?: string[];
  // Visual preview (self-contained HTML/CSS snippet)
  previewHtml?: string;
  // Interactive elements for cursor targeting
  interactiveElements?: InteractiveElement[];
  // Error tracking
  analysisError?: string;
}

export interface AnalysisProgress {
  total: number;
  processed: number;
  currentFile: string;
  errors: Array<{ file: string; error: string }>;
}

export interface AnalysisResult {
  components: ComponentInfo[];
  errors: Array<{ file: string; error: string }>;
  duration: number;
}

export interface RepoContext {
  name: string;
  owner: string;
  description?: string;
}
