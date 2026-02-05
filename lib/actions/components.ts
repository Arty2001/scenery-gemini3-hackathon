'use server';

import { readFile } from 'fs/promises';
import path from 'path';
import { createClient } from '@/lib/supabase/server';
import {
  scanRepository,
  analyzeComponent,
  analyzeComponents,
  generatePreviewHtml,
  type ComponentInfo,
  type PropInfo,
  type RepoContext,
  type InteractiveElement,
} from '@/lib/component-discovery';
import { extractInteractiveElements } from '@/lib/component-discovery/extract-interactive-elements';
import { propsToJsonSchema } from '@/lib/component-discovery/props-to-json-schema';
import type { Json } from '@/types/database.types';
import { isDemoProject } from '@/lib/demo-projects';

/**
 * ComponentInfo with database ID
 * Used when returning components from the database
 */
export interface ComponentWithId extends ComponentInfo {
  id: string;
}

interface DiscoveryResult {
  success: boolean;
  componentsFound: number;
  componentsAnalyzed: number;
  errors: Array<{ file: string; error: string }>;
}

export async function discoverComponents(
  repositoryId: string,
  localPath: string,
  repoContext: RepoContext
): Promise<DiscoveryResult> {
  const supabase = await createClient();

  // Get user for auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, componentsFound: 0, componentsAnalyzed: 0, errors: [{ file: '', error: 'Not authenticated' }] };
  }

  // Verify user owns this repository connection
  const { data: repo, error: repoError } = await supabase
    .from('repository_connections')
    .select('id, project_id')
    .eq('id', repositoryId)
    .single();

  if (repoError || !repo) {
    return { success: false, componentsFound: 0, componentsAnalyzed: 0, errors: [{ file: '', error: 'Repository not found' }] };
  }

  try {
    // Step 1: Scan repository for components
    console.log(`[discovery] Starting scan of ${localPath}`);
    const { components, errors: scanErrors } = await scanRepository(localPath);
    console.log(`[discovery] Scan complete: ${components.length} components found, ${scanErrors.length} errors`);

    if (components.length === 0) {
      return { success: true, componentsFound: 0, componentsAnalyzed: 0, errors: scanErrors };
    }

    // Step 2: Clear previous components
    await supabase.from('discovered_components').delete().eq('repository_id', repositoryId);

    // Step 3: Insert shell records immediately so polling sees total count
    const shellRecords = components.map(comp => ({
      repository_id: repositoryId,
      file_path: comp.filePath,
      component_name: comp.componentName,
      display_name: comp.displayName ?? null,
      description: comp.description ?? null,
      props_schema: comp.props as unknown as Json,
      is_compound_child: comp.isCompoundChild ?? false,
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from('discovered_components')
      .insert(shellRecords)
      .select('id, component_name, file_path');

    if (insertError || !insertedRows) {
      console.error('[discovery] Failed to insert shell records:', insertError);
      return { success: false, componentsFound: components.length, componentsAnalyzed: 0, errors: [{ file: '', error: insertError?.message ?? 'Insert failed' }] };
    }
    console.log(`[discovery] ${insertedRows.length} shell records inserted`);

    // Build lookup: componentName::filePath -> database ID
    const dbIdMap = new Map<string, string>();
    for (const row of insertedRows) {
      dbIdMap.set(`${row.component_name}::${row.file_path}`, row.id);
    }

    // Step 4: Read source code
    const sourceCodeMap: Record<string, string> = {};
    const uniqueFilePaths = [...new Set(components.map(c => c.filePath))];
    await Promise.all(
      uniqueFilePaths.map(async (filePath) => {
        try {
          sourceCodeMap[filePath] = await readFile(path.join(localPath, filePath), 'utf-8');
        } catch { /* skip unreadable files */ }
      })
    );

    // Step 5: AI analysis — update DB incrementally
    const analyzedComponents: ComponentInfo[] = [...components];

    if (process.env.GEMINI_API_KEY) {
      const concurrency = 3;

      // Phase A: Categorize + demo props in parallel batches
      for (let i = 0; i < components.length; i += concurrency) {
        const batch = components.slice(i, i + concurrency);
        const batchResults = await Promise.all(
          batch.map((comp) => analyzeComponent(comp, repoContext))
        );

        for (let j = 0; j < batchResults.length; j++) {
          const comp = batchResults[j];
          analyzedComponents[i + j] = comp;
          const dbId = dbIdMap.get(`${comp.componentName}::${comp.filePath}`);
          if (dbId) {
            await supabase.from('discovered_components').update({
              category: comp.category ?? null,
              category_confidence: comp.categoryConfidence ?? null,
              secondary_categories: comp.secondaryCategories ?? null,
              demo_props: (comp.demoProps ?? null) as Json | null,
              demo_props_confidence: comp.demoPropsConfidence ?? null,
              analysis_error: comp.analysisError ?? null,
            }).eq('id', dbId);
          }
        }
        console.log(`[discovery] Categorized ${Math.min(i + concurrency, components.length)}/${components.length}`);
        if (i + concurrency < components.length) await new Promise(r => setTimeout(r, 200));
      }

      // Phase A.5: Extract component relationships from source code
      console.log('[discovery] Extracting component relationships...');
      const componentNames = analyzedComponents.map(c => c.componentName);
      const componentUsesMap = new Map<string, Set<string>>();
      const componentUsedByMap = new Map<string, Set<string>>();

      for (const comp of analyzedComponents) {
        const sourceCode = sourceCodeMap[comp.filePath];
        if (!sourceCode) continue;

        // Find which other components this component imports/uses
        const usesComponents = new Set<string>();

        for (const otherName of componentNames) {
          if (otherName === comp.componentName) continue;
          // Check if component is used in JSX (e.g., <Button> or <Button/>)
          const jsxPattern = new RegExp(`<${otherName}[\\s/>]`, 'g');
          if (jsxPattern.test(sourceCode)) {
            usesComponents.add(otherName);
          }
        }

        if (usesComponents.size > 0) {
          componentUsesMap.set(comp.componentName, usesComponents);
          // Build reverse mapping (usedBy)
          for (const usedComp of usesComponents) {
            if (!componentUsedByMap.has(usedComp)) {
              componentUsedByMap.set(usedComp, new Set());
            }
            componentUsedByMap.get(usedComp)!.add(comp.componentName);
          }
        }
      }

      // Find related components (same directory)
      const dirToComponents = new Map<string, string[]>();
      for (const comp of analyzedComponents) {
        const dir = comp.filePath.split('/').slice(0, -1).join('/');
        if (!dirToComponents.has(dir)) {
          dirToComponents.set(dir, []);
        }
        dirToComponents.get(dir)!.push(comp.componentName);
      }

      // Apply and store relationships
      for (let i = 0; i < analyzedComponents.length; i++) {
        const comp = analyzedComponents[i];
        const uses = componentUsesMap.get(comp.componentName);
        const usedBy = componentUsedByMap.get(comp.componentName);
        const dir = comp.filePath.split('/').slice(0, -1).join('/');
        const sameDir = dirToComponents.get(dir)?.filter(n => n !== comp.componentName);

        analyzedComponents[i] = {
          ...comp,
          usesComponents: uses ? Array.from(uses) : undefined,
          usedByComponents: usedBy ? Array.from(usedBy) : undefined,
          relatedComponents: sameDir?.length ? sameDir : undefined,
        };

        // Update DB with relationships
        const dbId = dbIdMap.get(`${comp.componentName}::${comp.filePath}`);
        if (dbId) {
          await supabase.from('discovered_components').update({
            uses_components: uses ? Array.from(uses) : null,
            used_by_components: usedBy ? Array.from(usedBy) : null,
            related_components: sameDir?.length ? sameDir : null,
          }).eq('id', dbId);
        }
      }
      console.log(`[discovery] Found ${componentUsesMap.size} components with dependencies`);

      // Phase B: Generate preview HTML one-at-a-time
      for (let i = 0; i < analyzedComponents.length; i++) {
        const comp = analyzedComponents[i];
        const sourceCode = sourceCodeMap[comp.filePath];

        const relatedSourceCode: Record<string, string> = {};
        if (sourceCode) {
          const localImportRegex = /import\s+(?:{[^}]+}|[\w$]+)\s+from\s+['"](\.[^'"]+)['"]/g;
          let m;
          while ((m = localImportRegex.exec(sourceCode)) !== null) {
            for (const [fp, code] of Object.entries(sourceCodeMap)) {
              if (fp.includes(m[1].replace('./', '').replace('../', ''))) {
                relatedSourceCode[fp.split('/').pop() ?? fp] = code;
                break;
              }
            }
          }
        }

        try {
          const previewResult = await generatePreviewHtml(comp, repoContext, sourceCode, relatedSourceCode);
          if (previewResult?.html) {
            // Extract interactive elements from the preview HTML
            const interactiveElements = extractInteractiveElements(previewResult.html);

            // Debug: Log what we found
            console.log(`[discovery] ${comp.componentName}: extracted ${interactiveElements.length} interactive elements`);
            if (interactiveElements.length > 0) {
              console.log(`[discovery] ${comp.componentName} elements:`, interactiveElements.map(e => `${e.tag}[${e.selector}]`).join(', '));
            }

            analyzedComponents[i] = {
              ...comp,
              previewHtml: previewResult.html,
              interactiveElements: interactiveElements.length > 0 ? interactiveElements : undefined,
            };

            const dbId = dbIdMap.get(`${comp.componentName}::${comp.filePath}`);
            if (dbId) {
              const { error: updateError } = await supabase.from('discovered_components').update({
                preview_html: previewResult.html,
                interactive_elements: interactiveElements.length > 0 ? (interactiveElements as unknown as Json) : null,
              }).eq('id', dbId);

              if (updateError) {
                console.error(`[discovery] Failed to update ${comp.componentName}:`, updateError);
              }
            }
          }
          console.log(`[discovery] Preview ${i + 1}/${analyzedComponents.length}: ${comp.componentName}`);
        } catch (error) {
          console.error(`Preview HTML generation failed for ${comp.componentName}:`, error);
        }
        if (i < analyzedComponents.length - 1) await new Promise(r => setTimeout(r, 150));
      }
    }

    await linkCompoundComponents(supabase, repositoryId, analyzedComponents);

    const withPreview = analyzedComponents.filter(c => c.previewHtml).length;
    const withCategory = analyzedComponents.filter(c => c.category).length;
    console.log(`[discovery] DONE: ${components.length} found, ${withCategory} categorized, ${withPreview} with preview HTML`);
    return { success: true, componentsFound: components.length, componentsAnalyzed: withCategory, errors: scanErrors };
  } catch (error) {
    console.error('[discovery] Component discovery failed:', error);
    return { success: false, componentsFound: 0, componentsAnalyzed: 0, errors: [{ file: '', error: error instanceof Error ? error.message : 'Unknown error' }] };
  }
}

async function linkCompoundComponents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  repositoryId: string,
  components: ComponentInfo[]
) {
  // Find components that are compound children
  const compoundChildren = components.filter(c => c.isCompoundChild && c.parentComponentName);

  for (const child of compoundChildren) {
    // Find parent component ID
    const { data: parent } = await supabase
      .from('discovered_components')
      .select('id')
      .eq('repository_id', repositoryId)
      .eq('component_name', child.parentComponentName!)
      .single();

    if (parent) {
      await supabase
        .from('discovered_components')
        .update({ parent_component_id: parent.id })
        .eq('repository_id', repositoryId)
        .eq('component_name', child.componentName);
    }
  }
}

export async function getProjectComponents(projectId: string): Promise<ComponentWithId[]> {
  const supabase = await createClient();

  // Demo projects (in DEMO_PROJECT_IDS) allow anonymous read
  // Regular projects require authentication
  if (!isDemoProject(projectId)) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return [];
  }

  // Get repository for this project (works for both real demo and regular projects)
  const { data: repo } = await supabase
    .from('repository_connections')
    .select('id')
    .eq('project_id', projectId)
    .single();

  if (!repo) return [];

  // Get components
  const { data: components, error } = await supabase
    .from('discovered_components')
    .select('*')
    .eq('repository_id', repo.id)
    .order('file_path')
    .order('component_name');

  if (error || !components) return [];

  return components.map(c => ({
    id: c.id,
    filePath: c.file_path,
    componentName: c.component_name,
    displayName: c.display_name ?? undefined,
    description: c.description ?? undefined,
    props: c.props_schema as unknown as PropInfo[],
    category: c.category ?? undefined,
    categoryConfidence: c.category_confidence ?? undefined,
    secondaryCategories: c.secondary_categories ?? undefined,
    demoProps: (c.demo_props as Record<string, unknown> | null) ?? undefined,
    demoPropsConfidence: (c.demo_props_confidence as 'high' | 'medium' | 'low' | null) ?? undefined,
    isCompoundChild: c.is_compound_child ?? undefined,
    previewHtml: c.preview_html ?? undefined,
    interactiveElements: (c.interactive_elements as InteractiveElement[] | null) ?? undefined,
    // Component relationships
    usesComponents: (c.uses_components as string[] | null) ?? undefined,
    usedByComponents: (c.used_by_components as string[] | null) ?? undefined,
    relatedComponents: (c.related_components as string[] | null) ?? undefined,
    analysisError: c.analysis_error ?? undefined,
  }));
}

export async function retryFailedComponents(repositoryId: string): Promise<{
  success: boolean;
  retried: number;
  errors: string[];
}> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, retried: 0, errors: ['Not authenticated'] };
  }

  // Get failed components
  const { data: failed } = await supabase
    .from('discovered_components')
    .select('id, component_name, file_path, props_schema')
    .eq('repository_id', repositoryId)
    .not('analysis_error', 'is', null);

  if (!failed || failed.length === 0) {
    return { success: true, retried: 0, errors: [] };
  }

  // Get repo context
  const { data: repo } = await supabase
    .from('repository_connections')
    .select('owner, name')
    .eq('id', repositoryId)
    .single();

  if (!repo) {
    return { success: false, retried: 0, errors: ['Repository not found'] };
  }

  const repoContext: RepoContext = { name: repo.name, owner: repo.owner };

  // Re-analyze failed components
  const componentsToRetry: ComponentInfo[] = failed.map(c => ({
    filePath: c.file_path,
    componentName: c.component_name,
    props: c.props_schema as unknown as PropInfo[],
  }));

  const reanalyzed = await analyzeComponents(componentsToRetry, repoContext);

  // Update components with new analysis
  const errors: string[] = [];
  let retried = 0;

  for (const comp of reanalyzed) {
    const original = failed.find(f => f.component_name === comp.componentName);
    if (!original) continue;

    const { error } = await supabase
      .from('discovered_components')
      .update({
        category: comp.category ?? null,
        category_confidence: comp.categoryConfidence ?? null,
        secondary_categories: comp.secondaryCategories ?? null,
        demo_props: (comp.demoProps ?? null) as Json | null,
        demo_props_confidence: comp.demoPropsConfidence ?? null,
        analysis_error: comp.analysisError ?? null,
      })
      .eq('id', original.id);

    if (error) {
      errors.push(`Failed to update ${comp.componentName}: ${error.message}`);
    } else {
      retried++;
    }
  }

  return { success: errors.length === 0, retried, errors };
}

/**
 * Regenerate preview HTML for a single component.
 * Useful when the initial generation failed or produced poor results.
 */
export async function regenerateComponentPreview(componentId: string): Promise<{
  success: boolean;
  error?: string;
  previewHtml?: string;
}> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get component with repository info
  const { data: component, error: compError } = await supabase
    .from('discovered_components')
    .select(`
      id,
      component_name,
      file_path,
      props_schema,
      category,
      demo_props,
      description,
      repository:repository_connections!inner(
        id,
        owner,
        name,
        local_path
      )
    `)
    .eq('id', componentId)
    .single();

  if (compError || !component) {
    return { success: false, error: 'Component not found' };
  }

  const repo = component.repository as unknown as { id: string; owner: string; name: string; local_path: string | null };
  if (!repo?.local_path) {
    return { success: false, error: 'Repository local path not found' };
  }

  const repoContext: RepoContext = { name: repo.name, owner: repo.owner };

  // Read source code
  let sourceCode: string | undefined;
  try {
    sourceCode = await readFile(path.join(repo.local_path, component.file_path), 'utf-8');
  } catch {
    return { success: false, error: 'Could not read component source file' };
  }

  // Build component info
  const compInfo: ComponentInfo = {
    filePath: component.file_path,
    componentName: component.component_name,
    props: component.props_schema as unknown as PropInfo[],
    category: component.category ?? undefined,
    demoProps: (component.demo_props as Record<string, unknown> | null) ?? undefined,
    description: component.description ?? undefined,
  };

  // Generate new preview HTML
  try {
    const previewResult = await generatePreviewHtml(compInfo, repoContext, sourceCode);

    if (!previewResult?.html) {
      return { success: false, error: 'Preview generation returned empty result' };
    }

    // Extract interactive elements
    const interactiveElements = extractInteractiveElements(previewResult.html);

    // Update database
    const { error: updateError } = await supabase
      .from('discovered_components')
      .update({
        preview_html: previewResult.html,
        interactive_elements: interactiveElements.length > 0 ? (interactiveElements as unknown as Json) : null,
      })
      .eq('id', componentId);

    if (updateError) {
      return { success: false, error: `Database update failed: ${updateError.message}` };
    }

    console.log(`[regenerate] ${component.component_name}: preview regenerated, ${interactiveElements.length} interactive elements`);

    return { success: true, previewHtml: previewResult.html };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get a single component by its database ID
 * @param componentId - The component's database ID
 * @returns The component info with ID, or null if not found
 */
export async function getComponent(componentId: string): Promise<ComponentWithId | null> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  // Get the component - RLS will ensure user owns the project
  const { data: component, error } = await supabase
    .from('discovered_components')
    .select('*')
    .eq('id', componentId)
    .single();

  if (error || !component) return null;

  return {
    id: component.id,
    filePath: component.file_path,
    componentName: component.component_name,
    displayName: component.display_name ?? undefined,
    description: component.description ?? undefined,
    props: component.props_schema as unknown as PropInfo[],
    category: component.category ?? undefined,
    categoryConfidence: component.category_confidence ?? undefined,
    secondaryCategories: component.secondary_categories ?? undefined,
    demoProps: (component.demo_props as Record<string, unknown> | null) ?? undefined,
    demoPropsConfidence: (component.demo_props_confidence as 'high' | 'medium' | 'low' | null) ?? undefined,
    isCompoundChild: component.is_compound_child ?? undefined,
    previewHtml: component.preview_html ?? undefined,
    interactiveElements: (component.interactive_elements as InteractiveElement[] | null) ?? undefined,
    analysisError: component.analysis_error ?? undefined,
  };
}

/**
 * Fetches preview HTML for components by their IDs.
 * Used by the Remotion preview to render components as static HTML in iframes.
 *
 * @param componentIds - Array of component IDs
 * @returns Map of componentId -> preview HTML string
 */
export async function getComponentPreviews(
  componentIds: string[]
): Promise<Record<string, string>> {
  if (componentIds.length === 0) return {};

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return {};

  const { data: components, error } = await supabase
    .from('discovered_components')
    .select('id, preview_html')
    .in('id', componentIds)
    .not('preview_html', 'is', null);

  if (error || !components) return {};

  const map: Record<string, string> = {};
  for (const c of components) {
    if (c.preview_html) map[c.id] = c.preview_html;
  }
  return map;
}

/**
 * Fetches component source codes for bundling.
 * Reads source code from the local filesystem using file_path and repository's local_path.
 *
 * @param componentIds - Array of component IDs to fetch source code for
 * @returns Map of componentId -> source code
 */
export async function getComponentCodes(
  componentIds: string[]
): Promise<Record<string, string>> {
  if (componentIds.length === 0) {
    return {};
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('getComponentCodes: Not authenticated');
    return {};
  }

  // Get components with their repository's local_path
  const { data: components, error } = await supabase
    .from('discovered_components')
    .select(
      `
      id,
      file_path,
      repository:repository_connections!inner(local_path)
    `
    )
    .in('id', componentIds);

  if (error || !components) {
    console.error('Failed to fetch component paths:', error);
    return {};
  }

  // Read source code from filesystem for each component
  const codeMap: Record<string, string> = {};

  for (const component of components) {
    const repo = component.repository as unknown as { local_path: string | null };
    if (!repo?.local_path) {
      console.warn(`No local_path for component ${component.id}`);
      continue;
    }

    const fullPath = `${repo.local_path}/${component.file_path}`;

    try {
      const { readFile } = await import('fs/promises');
      const code = await readFile(fullPath, 'utf-8');
      codeMap[component.id] = code;
    } catch (err) {
      console.error(`Failed to read source code for ${component.id}:`, err);
    }
  }

  return codeMap;
}

/**
 * Get a single component by ID.
 * Used by properties panel to load component schema for props editing.
 */
export async function getComponentById(componentId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('discovered_components')
    .select(`
      id,
      name:component_name,
      file_path,
      props_schema,
      demo_props,
      repository_connections!inner (
        projects!inner (
          user_id
        )
      )
    `)
    .eq('id', componentId)
    .single();

  if (error) {
    console.error('Failed to fetch component:', error);
    return null;
  }

  // Verify ownership through the join
  const repoConn = data?.repository_connections as { projects: { user_id: string } } | null;
  if (repoConn?.projects?.user_id !== user.id) {
    throw new Error('Unauthorized');
  }

  // props_schema is stored as PropInfo[] — convert to JSON Schema for PropsForm
  const rawSchema = data.props_schema;
  let jsonSchema: Record<string, unknown> | null = null;
  if (Array.isArray(rawSchema) && rawSchema.length > 0) {
    jsonSchema = propsToJsonSchema(rawSchema as unknown as PropInfo[]);
  }

  return {
    id: data.id,
    name: data.name,
    filePath: data.file_path,
    propsSchema: jsonSchema,
    demoProps: data.demo_props as Record<string, unknown> | null,
  };
}
