'use server';

/**
 * Server actions for composition CRUD operations.
 *
 * Handles:
 * - getOrCreateComposition: Get existing or create new composition for a project
 * - saveComposition: Persist composition state to database
 */

import { createClient } from '@/lib/supabase/server';
import type { Track, Scene } from '@/lib/composition/types';
import type { Json } from '@/types/database.types';
import { isDemoProject } from '@/lib/demo-projects';

// =============================================
// Types
// =============================================

export interface CompositionData {
  id: string;
  projectId: string;
  name: string;
  tracks: Track[];
  scenes: Scene[];
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

// =============================================
// Actions
// =============================================

/**
 * Get existing composition for project or create a new one.
 * Each project has at most one composition (enforced by unique constraint).
 */
export async function getOrCreateComposition(
  projectId: string
): Promise<CompositionData | null> {
  const supabase = await createClient();
  const isDemo = isDemoProject(projectId);

  // Demo projects allow anonymous read/write of compositions
  if (isDemo) {
    // Try to get existing composition
    const { data: existing } = await supabase
      .from('compositions')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (existing) {
      return {
        id: existing.id,
        projectId: existing.project_id,
        name: existing.name,
        tracks: (existing.tracks as unknown as Track[]) ?? [],
        scenes: (existing.scenes as unknown as Scene[]) ?? [],
        durationInFrames: existing.duration_in_frames,
        fps: existing.fps,
        width: existing.width,
        height: existing.height,
      };
    }

    // No composition exists - create one (RLS allows INSERT for demo projects)
    const { data: created, error } = await supabase
      .from('compositions')
      .insert({
        project_id: projectId,
        name: 'Demo Composition',
        tracks: [] as unknown as Json,
        scenes: [] as unknown as Json,
        duration_in_frames: 900,
        fps: 30,
        width: 1920,
        height: 1080,
      })
      .select()
      .single();

    if (error || !created) {
      console.error('Failed to create demo composition:', error);
      // Fallback to in-memory composition if insert fails
      return {
        id: `demo-comp-${projectId}`,
        projectId,
        name: 'Demo Composition',
        tracks: [],
        scenes: [],
        durationInFrames: 900,
        fps: 30,
        width: 1920,
        height: 1080,
      };
    }

    return {
      id: created.id,
      projectId: created.project_id,
      name: created.name,
      tracks: (created.tracks as unknown as Track[]) ?? [],
      scenes: (created.scenes as unknown as Scene[]) ?? [],
      durationInFrames: created.duration_in_frames,
      fps: created.fps,
      width: created.width,
      height: created.height,
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  // Try to get existing composition
  const { data: existing } = await supabase
    .from('compositions')
    .select('*')
    .eq('project_id', projectId)
    .single();

  if (existing) {
    return {
      id: existing.id,
      projectId: existing.project_id,
      name: existing.name,
      tracks: (existing.tracks as unknown as Track[]) ?? [],
      scenes: (existing.scenes as unknown as Scene[]) ?? [],
      durationInFrames: existing.duration_in_frames,
      fps: existing.fps,
      width: existing.width,
      height: existing.height,
    };
  }

  // Create new composition with default settings
  const { data: created, error } = await supabase
    .from('compositions')
    .insert({
      project_id: projectId,
      name: 'Untitled Composition',
      tracks: [] as unknown as Json,
      scenes: [] as unknown as Json,
      duration_in_frames: 900, // 30 seconds at 30fps
      fps: 30,
      width: 1920,
      height: 1080,
    })
    .select()
    .single();

  if (error || !created) {
    console.error('Failed to create composition:', error);
    return null;
  }

  return {
    id: created.id,
    projectId: created.project_id,
    name: created.name,
    tracks: (created.tracks as unknown as Track[]) ?? [],
    scenes: (created.scenes as unknown as Scene[]) ?? [],
    durationInFrames: created.duration_in_frames,
    fps: created.fps,
    width: created.width,
    height: created.height,
  };
}

/**
 * Save composition state to database.
 * Partial updates supported - only provided fields are updated.
 */
export async function saveComposition(
  compositionId: string,
  data: {
    name?: string;
    tracks?: Track[];
    scenes?: Scene[];
    durationInFrames?: number;
    fps?: number;
    width?: number;
    height?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  // In-memory demo compositions (fallback) cannot be saved
  if (compositionId.startsWith('demo-comp-')) {
    return { success: true };
  }

  const supabase = await createClient();

  // RLS handles permission:
  // - Authenticated users can update their own project compositions
  // - Anyone can update demo project compositions

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.tracks !== undefined) updateData.tracks = data.tracks as unknown as Json;
  if (data.scenes !== undefined) updateData.scenes = data.scenes as unknown as Json;
  if (data.durationInFrames !== undefined) updateData.duration_in_frames = data.durationInFrames;
  if (data.fps !== undefined) updateData.fps = data.fps;
  if (data.width !== undefined) updateData.width = data.width;
  if (data.height !== undefined) updateData.height = data.height;

  const { error } = await supabase
    .from('compositions')
    .update(updateData)
    .eq('id', compositionId);

  if (error) {
    console.error('Failed to save composition:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
