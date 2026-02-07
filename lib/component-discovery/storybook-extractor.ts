/**
 * Storybook Story Extractor
 *
 * Detects and extracts args from .stories.tsx files to use as high-quality
 * demo props. Story args are defined by component authors and represent
 * canonical usage examples.
 */

export interface StoryMetadata {
  storyName: string;
  args: Record<string, unknown>;
  isDefault: boolean;
}

export interface StorybookExtractionResult {
  hasStorybook: boolean;
  stories: StoryMetadata[];
  defaultArgs?: Record<string, unknown>;
}

/**
 * Find the corresponding stories file for a component
 */
function findStoriesFile(
  componentFilePath: string,
  sourceCodeMap: Record<string, string>
): { path: string; content: string } | null {
  // Normalize the component path
  const basePath = componentFilePath.replace(/\.(tsx?|jsx?)$/, '');
  const componentDir = componentFilePath.split('/').slice(0, -1).join('/');
  const componentName = componentFilePath.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '');

  // Possible story file locations (in order of preference)
  const storyPatterns = [
    `${basePath}.stories.tsx`,
    `${basePath}.stories.ts`,
    `${basePath}.stories.jsx`,
    `${basePath}.stories.js`,
    `${componentDir}/stories/${componentName}.stories.tsx`,
    `${componentDir}/stories/${componentName}.stories.ts`,
    `${componentDir}/__stories__/${componentName}.stories.tsx`,
    `${componentDir}/__stories__/${componentName}.stories.ts`,
  ];

  for (const pattern of storyPatterns) {
    for (const [filePath, content] of Object.entries(sourceCodeMap)) {
      const normalizedPath = filePath.replace(/\\/g, '/');
      if (normalizedPath.endsWith(pattern) || normalizedPath === pattern) {
        return { path: filePath, content };
      }
    }
  }

  return null;
}

/**
 * Extract args from a story file using regex patterns
 * Handles CSF2 and CSF3 formats
 */
function extractArgsFromStoryCode(storyCode: string): StoryMetadata[] {
  const stories: StoryMetadata[] = [];

  // CSF3 format: export const Primary: Story = { args: { ... } }
  const csf3Pattern = /export\s+const\s+(\w+)\s*:\s*Story\s*=\s*\{([^}]*args\s*:\s*(\{[^}]+\}))?/g;

  // CSF2 format: export const Primary = Template.bind({}); Primary.args = { ... }
  // Using [\s\S] instead of . with 's' flag for ES compatibility
  const csf2Pattern = /export\s+const\s+(\w+)\s*=[\s\S]*?;\s*\1\.args\s*=\s*(\{[^}]+\})/g;

  // Default export with args: export default { args: { ... } }
  // Using [\s\S] instead of . with 's' flag for ES compatibility
  const defaultArgsPattern = /export\s+default\s*\{[\s\S]*?args\s*:\s*(\{[^}]+\})/;

  // Try CSF3 pattern
  let match;
  while ((match = csf3Pattern.exec(storyCode)) !== null) {
    const storyName = match[1];
    const argsStr = match[3];

    if (argsStr) {
      try {
        // Try to parse the args object (simplified parsing)
        const args = parseArgsObject(argsStr);
        stories.push({
          storyName,
          args,
          isDefault: storyName === 'Default' || storyName === 'Primary',
        });
      } catch {
        // Skip malformed args
      }
    }
  }

  // Try CSF2 pattern
  while ((match = csf2Pattern.exec(storyCode)) !== null) {
    const storyName = match[1];
    const argsStr = match[2];

    try {
      const args = parseArgsObject(argsStr);
      stories.push({
        storyName,
        args,
        isDefault: storyName === 'Default' || storyName === 'Primary',
      });
    } catch {
      // Skip malformed args
    }
  }

  // Try default export args
  const defaultMatch = defaultArgsPattern.exec(storyCode);
  if (defaultMatch) {
    try {
      const args = parseArgsObject(defaultMatch[1]);
      // Add as a special "Default" story if no other default exists
      if (!stories.some(s => s.isDefault)) {
        stories.push({
          storyName: 'Default',
          args,
          isDefault: true,
        });
      }
    } catch {
      // Skip malformed args
    }
  }

  return stories;
}

/**
 * Parse a JavaScript object literal string into a Record
 * Handles common patterns but not all edge cases
 */
function parseArgsObject(argsStr: string): Record<string, unknown> {
  // Clean up the string
  let cleaned = argsStr.trim();

  // Remove trailing comma
  cleaned = cleaned.replace(/,\s*}$/, '}');

  // Handle simple cases by converting to JSON-like format
  // Replace single quotes with double quotes
  cleaned = cleaned.replace(/'/g, '"');

  // Handle unquoted keys: { foo: "bar" } -> { "foo": "bar" }
  cleaned = cleaned.replace(/(\{|\,)\s*(\w+)\s*:/g, '$1"$2":');

  // Handle boolean and null values
  cleaned = cleaned.replace(/:\s*true\b/g, ':true');
  cleaned = cleaned.replace(/:\s*false\b/g, ':false');
  cleaned = cleaned.replace(/:\s*null\b/g, ':null');
  cleaned = cleaned.replace(/:\s*undefined\b/g, ':null');

  // Remove function expressions (replace with null)
  cleaned = cleaned.replace(/:\s*\([^)]*\)\s*=>\s*[^,}]+/g, ':null');
  cleaned = cleaned.replace(/:\s*function\s*\([^)]*\)\s*\{[^}]*\}/g, ':null');

  // Remove variable references (replace with null)
  // This handles cases like: { icon: ChevronDown }
  cleaned = cleaned.replace(/:\s*([A-Z][a-zA-Z0-9]*)\s*([,}])/g, ':null$2');

  try {
    return JSON.parse(cleaned);
  } catch {
    // If JSON parsing fails, try a more lenient approach
    const result: Record<string, unknown> = {};

    // Extract key-value pairs with a simple regex
    const kvPattern = /"?(\w+)"?\s*:\s*("([^"]+)"|(\d+(?:\.\d+)?)|true|false|null)/g;
    let kvMatch;

    while ((kvMatch = kvPattern.exec(argsStr)) !== null) {
      const key = kvMatch[1];
      const value = kvMatch[2];

      if (value === 'true') {
        result[key] = true;
      } else if (value === 'false') {
        result[key] = false;
      } else if (value === 'null') {
        result[key] = null;
      } else if (kvMatch[3]) {
        result[key] = kvMatch[3]; // String value
      } else if (kvMatch[4]) {
        result[key] = parseFloat(kvMatch[4]); // Number value
      }
    }

    return result;
  }
}

/**
 * Extract Storybook story args for a component
 *
 * @param componentFilePath - Path to the component file
 * @param sourceCodeMap - Map of all source files in the repo
 * @returns Extraction result with stories and default args
 */
export function extractStorybookArgs(
  componentFilePath: string,
  sourceCodeMap: Record<string, string>
): StorybookExtractionResult {
  const storyFile = findStoriesFile(componentFilePath, sourceCodeMap);

  if (!storyFile) {
    return {
      hasStorybook: false,
      stories: [],
    };
  }

  const stories = extractArgsFromStoryCode(storyFile.content);

  // Find the default story's args (prefer "Default", then "Primary", then first story)
  let defaultArgs: Record<string, unknown> | undefined;

  const defaultStory = stories.find(s => s.storyName === 'Default');
  const primaryStory = stories.find(s => s.storyName === 'Primary');
  const firstStory = stories[0];

  if (defaultStory) {
    defaultArgs = defaultStory.args;
  } else if (primaryStory) {
    defaultArgs = primaryStory.args;
  } else if (firstStory) {
    defaultArgs = firstStory.args;
  }

  return {
    hasStorybook: true,
    stories,
    defaultArgs,
  };
}

/**
 * Check if a repo has Storybook configuration
 */
export function hasStorybookConfig(sourceCodeMap: Record<string, string>): boolean {
  const storybookPatterns = [
    '.storybook/main.ts',
    '.storybook/main.js',
    '.storybook/main.tsx',
    '.storybook/preview.ts',
    '.storybook/preview.js',
  ];

  for (const pattern of storybookPatterns) {
    for (const filePath of Object.keys(sourceCodeMap)) {
      if (filePath.includes(pattern)) {
        return true;
      }
    }
  }

  return false;
}
