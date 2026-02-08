'use server';

import { readFile } from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
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
 * Compute SHA-256 hash of content for cache invalidation
 */
function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

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
  componentsCached: number;
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
    return { success: false, componentsFound: 0, componentsAnalyzed: 0, componentsCached: 0, errors: [{ file: '', error: 'Not authenticated' }] };
  }

  // Verify user owns this repository connection
  const { data: repo, error: repoError } = await supabase
    .from('repository_connections')
    .select('id, project_id')
    .eq('id', repositoryId)
    .single();

  if (repoError || !repo) {
    return { success: false, componentsFound: 0, componentsAnalyzed: 0, componentsCached: 0, errors: [{ file: '', error: 'Repository not found' }] };
  }

  try {
    console.log(`\n========================================`);
    console.log(`[discovery] COMPONENT DISCOVERY STARTED`);
    console.log(`[discovery] Repository ID: ${repositoryId}`);
    console.log(`[discovery] Local path: ${localPath}`);
    console.log(`[discovery] Repo: ${repoContext.owner}/${repoContext.name}`);
    console.log(`========================================\n`);

    // Step 1: Scan repository for components
    console.log(`[discovery] Step 1: Scanning for components...`);
    const { components, errors: scanErrors } = await scanRepository(localPath);
    console.log(`[discovery] Scan complete: ${components.length} components found, ${scanErrors.length} errors`);

    if (components.length === 0) {
      // Delete any existing components since repo has none now
      await supabase.from('discovered_components').delete().eq('repository_id', repositoryId);
      return { success: true, componentsFound: 0, componentsAnalyzed: 0, componentsCached: 0, errors: scanErrors };
    }

    // Step 2: Read source code and compute hashes
    const sourceCodeMap: Record<string, string> = {};
    const hashMap: Record<string, string> = {};
    const uniqueFilePaths = [...new Set(components.map(c => c.filePath))];
    await Promise.all(
      uniqueFilePaths.map(async (filePath) => {
        try {
          const content = await readFile(path.join(localPath, filePath), 'utf-8');
          sourceCodeMap[filePath] = content;
          hashMap[filePath] = computeHash(content);
        } catch { /* skip unreadable files */ }
      })
    );

    // Step 3: Fetch existing components with their hashes
    const { data: existingComponents } = await supabase
      .from('discovered_components')
      .select('id, component_name, file_path, content_hash, category, demo_props, preview_html')
      .eq('repository_id', repositoryId);

    // Build lookup: componentName::filePath -> existing DB record
    const existingMap = new Map<string, {
      id: string;
      content_hash: string | null;
      category: string | null;
      demo_props: Json | null;
      preview_html: string | null;
    }>();
    for (const row of existingComponents ?? []) {
      existingMap.set(`${row.component_name}::${row.file_path}`, {
        id: row.id,
        content_hash: row.content_hash,
        category: row.category,
        demo_props: row.demo_props,
        preview_html: row.preview_html,
      });
    }

    // Step 4: Categorize components
    const newComponents: ComponentInfo[] = [];
    const changedComponents: ComponentInfo[] = [];
    const unchangedComponents: ComponentInfo[] = [];
    const seenKeys = new Set<string>();

    for (const comp of components) {
      const key = `${comp.componentName}::${comp.filePath}`;
      seenKeys.add(key);
      const currentHash = hashMap[comp.filePath];
      const existing = existingMap.get(key);

      if (!existing) {
        newComponents.push(comp);
      } else if (existing.content_hash !== currentHash) {
        changedComponents.push(comp);
      } else {
        unchangedComponents.push(comp);
      }
    }

    // Find deleted components (in DB but not in scan)
    const deletedIds: string[] = [];
    for (const [key, existing] of existingMap) {
      if (!seenKeys.has(key)) {
        deletedIds.push(existing.id);
      }
    }

    console.log(`[discovery] Cache analysis: ${newComponents.length} new, ${changedComponents.length} changed, ${unchangedComponents.length} cached, ${deletedIds.length} deleted`);

    // Step 5: Delete removed components
    if (deletedIds.length > 0) {
      await supabase.from('discovered_components').delete().in('id', deletedIds);
      console.log(`[discovery] Deleted ${deletedIds.length} removed components`);
    }

    // Step 6: Insert new components
    const componentsToProcess = [...newComponents, ...changedComponents];
    const dbIdMap = new Map<string, string>();

    if (newComponents.length > 0) {
      const shellRecords = newComponents.map(comp => ({
        repository_id: repositoryId,
        file_path: comp.filePath,
        component_name: comp.componentName,
        display_name: comp.displayName ?? null,
        description: comp.description ?? null,
        props_schema: comp.props as unknown as Json,
        is_compound_child: comp.isCompoundChild ?? false,
        content_hash: hashMap[comp.filePath] ?? null,
      }));

      const { data: insertedRows, error: insertError } = await supabase
        .from('discovered_components')
        .insert(shellRecords)
        .select('id, component_name, file_path');

      if (insertError) {
        console.error('[discovery] Failed to insert new components:', insertError);
      } else if (insertedRows) {
        for (const row of insertedRows) {
          dbIdMap.set(`${row.component_name}::${row.file_path}`, row.id);
        }
        console.log(`[discovery] Inserted ${insertedRows.length} new components`);
      }
    }

    // Step 7: Update changed components (reset analysis, update hash)
    for (const comp of changedComponents) {
      const key = `${comp.componentName}::${comp.filePath}`;
      const existing = existingMap.get(key);
      if (existing) {
        dbIdMap.set(key, existing.id);
        await supabase.from('discovered_components').update({
          props_schema: comp.props as unknown as Json,
          display_name: comp.displayName ?? null,
          description: comp.description ?? null,
          is_compound_child: comp.isCompoundChild ?? false,
          content_hash: hashMap[comp.filePath] ?? null,
          // Reset analysis fields
          category: null,
          category_confidence: null,
          demo_props: null,
          preview_html: null,
          analysis_error: null,
        }).eq('id', existing.id);
      }
    }
    if (changedComponents.length > 0) {
      console.log(`[discovery] Reset ${changedComponents.length} changed components for re-analysis`);
    }

    // Keep track of unchanged component IDs for relationship linking
    for (const comp of unchangedComponents) {
      const key = `${comp.componentName}::${comp.filePath}`;
      const existing = existingMap.get(key);
      if (existing) {
        dbIdMap.set(key, existing.id);
      }
    }

    // Step 8: AI analysis — only process new/changed components
    // Build a map for quick lookup of component index by key
    const componentIndexMap = new Map<string, number>();
    components.forEach((c, i) => componentIndexMap.set(`${c.componentName}::${c.filePath}`, i));

    const analyzedComponents: ComponentInfo[] = [...components];

    if (process.env.GEMINI_API_KEY && componentsToProcess.length > 0) {
      const concurrency = 3;

      // Phase A: Categorize + demo props in parallel batches (only new/changed)
      console.log(`[discovery] Analyzing ${componentsToProcess.length} components (${unchangedComponents.length} cached)`);
      for (let i = 0; i < componentsToProcess.length; i += concurrency) {
        const batch = componentsToProcess.slice(i, i + concurrency);
        const batchResults = await Promise.all(
          batch.map((comp) => analyzeComponent(comp, repoContext))
        );

        for (let j = 0; j < batchResults.length; j++) {
          const comp = batchResults[j];
          const key = `${comp.componentName}::${comp.filePath}`;
          const originalIndex = componentIndexMap.get(key);
          if (originalIndex !== undefined) {
            analyzedComponents[originalIndex] = comp;
          }
          const dbId = dbIdMap.get(key);
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
        console.log(`[discovery] Categorized ${Math.min(i + concurrency, componentsToProcess.length)}/${componentsToProcess.length}`);
        if (i + concurrency < componentsToProcess.length) await new Promise(r => setTimeout(r, 200));
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

      // Phase B: Generate preview HTML one-at-a-time (only new/changed)
      console.log(`[discovery] Generating previews for ${componentsToProcess.length} components`);
      for (let i = 0; i < componentsToProcess.length; i++) {
        const originalComp = componentsToProcess[i];
        const key = `${originalComp.componentName}::${originalComp.filePath}`;
        const originalIndex = componentIndexMap.get(key);
        // Use the ANALYZED component (with demoProps from Phase A), not the original
        const comp = originalIndex !== undefined ? analyzedComponents[originalIndex] : originalComp;
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
          // Pass full sourceCodeMap and localPath for Playwright rendering
          const previewResult = await generatePreviewHtml(comp, repoContext, sourceCode, sourceCodeMap, localPath);
          if (previewResult?.html) {
            // Extract interactive elements from the preview HTML
            const interactiveElements = extractInteractiveElements(previewResult.html);

            // Debug: Log what we found
            console.log(`[discovery] ${comp.componentName}: extracted ${interactiveElements.length} interactive elements`);
            if (interactiveElements.length > 0) {
              console.log(`[discovery] ${comp.componentName} elements:`, interactiveElements.map(e => `${e.tag}[${e.selector}]`).join(', '));
            }

            if (originalIndex !== undefined) {
              analyzedComponents[originalIndex] = {
                ...analyzedComponents[originalIndex],
                previewHtml: previewResult.html,
                interactiveElements: interactiveElements.length > 0 ? interactiveElements : undefined,
              };
            }

            const dbId = dbIdMap.get(key);
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
          console.log(`[discovery] Preview ${i + 1}/${componentsToProcess.length}: ${comp.componentName}`);
        } catch (error) {
          console.error(`Preview HTML generation failed for ${comp.componentName}:`, error);
        }
        if (i < componentsToProcess.length - 1) await new Promise(r => setTimeout(r, 150));
      }
    }

    await linkCompoundComponents(supabase, repositoryId, analyzedComponents);

    const withPreview = analyzedComponents.filter(c => c.previewHtml).length;
    const withCategory = analyzedComponents.filter(c => c.category).length;
    console.log(`[discovery] DONE: ${components.length} found, ${componentsToProcess.length} analyzed, ${unchangedComponents.length} cached, ${withPreview} with preview`);
    return {
      success: true,
      componentsFound: components.length,
      componentsAnalyzed: componentsToProcess.length,
      componentsCached: unchangedComponents.length,
      errors: scanErrors
    };
  } catch (error) {
    console.error('[discovery] Component discovery failed:', error);
    return { success: false, componentsFound: 0, componentsAnalyzed: 0, componentsCached: 0, errors: [{ file: '', error: error instanceof Error ? error.message : 'Unknown error' }] };
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

  // RLS handles access control - demo project components are readable by anyone
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

  // RLS handles access control - demo project components are readable by anyone
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

  // RLS handles access control - demo project components are readable by anyone
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
 * Generate preview HTML with custom props (without saving to DB).
 * Used for live preview updates when editing props in the UI.
 */
export async function generatePreviewWithProps(
  componentId: string,
  customProps: Record<string, unknown>
): Promise<{
  success: boolean;
  error?: string;
  previewHtml?: string;
}> {
  const supabase = await createClient();

  // Demo projects allow anonymous access, regular projects require auth
  const { data: component, error: compError } = await supabase
    .from('discovered_components')
    .select(`
      id,
      component_name,
      file_path,
      props_schema,
      category,
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

  // Build component info with custom props
  const compInfo: ComponentInfo = {
    filePath: component.file_path,
    componentName: component.component_name,
    props: component.props_schema as unknown as PropInfo[],
    category: component.category ?? undefined,
    demoProps: customProps, // Use custom props instead of stored demo_props
    description: component.description ?? undefined,
  };

  // Generate preview HTML
  try {
    const previewResult = await generatePreviewHtml(compInfo, repoContext, sourceCode);

    if (!previewResult?.html) {
      return { success: false, error: 'Preview generation returned empty result' };
    }

    console.log(`[live-preview] ${component.component_name}: generated with custom props`);

    return { success: true, previewHtml: previewResult.html };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get a single component by ID.
 * Used by properties panel to load component schema for props editing.
 */
export async function getComponentById(componentId: string) {
  const supabase = await createClient();

  // RLS handles access control - demo project components are readable by anyone
  const { data, error } = await supabase
    .from('discovered_components')
    .select(`
      id,
      name:component_name,
      file_path,
      props_schema,
      demo_props
    `)
    .eq('id', componentId)
    .single();

  if (error) {
    console.error('Failed to fetch component:', error);
    return null;
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
