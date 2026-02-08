'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface CustomComponent {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  category: string | null;
  originalHtml: string;
  previewHtml: string;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Create a new custom component from processed HTML
 */
export async function createCustomComponent(
  projectId: string,
  data: {
    name: string;
    description: string;
    category: string;
    originalHtml: string;
    previewHtml: string;
  }
): Promise<{ success: boolean; component?: CustomComponent; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Verify user owns the project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    return { success: false, error: 'Project not found or access denied' };
  }

  const { data: component, error } = await supabase
    .from('custom_components')
    .insert({
      project_id: projectId,
      name: data.name,
      description: data.description,
      category: data.category,
      original_html: data.originalHtml,
      preview_html: data.previewHtml,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create custom component:', error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/protected/projects/${projectId}`);

  return {
    success: true,
    component: {
      id: component.id,
      projectId: component.project_id,
      name: component.name,
      description: component.description,
      category: component.category,
      originalHtml: component.original_html,
      previewHtml: component.preview_html,
      createdAt: component.created_at,
      updatedAt: component.updated_at,
    },
  };
}

/**
 * List all custom components for a project
 */
export async function listCustomComponents(
  projectId: string
): Promise<CustomComponent[]> {
  const supabase = await createClient();

  const { data: components, error } = await supabase
    .from('custom_components')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to list custom components:', error);
    return [];
  }

  return components.map((c) => ({
    id: c.id,
    projectId: c.project_id,
    name: c.name,
    description: c.description,
    category: c.category,
    originalHtml: c.original_html,
    previewHtml: c.preview_html,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));
}

/**
 * Delete a custom component
 */
export async function deleteCustomComponent(
  componentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('custom_components')
    .delete()
    .eq('id', componentId);

  if (error) {
    console.error('Failed to delete custom component:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Update a custom component
 */
export async function updateCustomComponent(
  componentId: string,
  data: {
    name?: string;
    description?: string;
    category?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('custom_components')
    .update(data)
    .eq('id', componentId);

  if (error) {
    console.error('Failed to update custom component:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
