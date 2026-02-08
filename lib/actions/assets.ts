'use server';

/**
 * Server actions for asset upload management.
 * Generates signed upload URLs for Supabase Storage.
 */

import { createClient } from '@/lib/supabase/server';

/**
 * Create a signed upload URL for a project asset.
 * Verifies authentication before generating the URL.
 */
export async function createSignedUploadUrl(
  projectId: string,
  fileName: string
): Promise<{
  signedUrl: string;
  path: string;
  token: string;
} | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const path = `${projectId}/${crypto.randomUUID()}-${fileName}`;

  const { data, error } = await supabase.storage
    .from('project-assets')
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error('Failed to create signed upload URL:', error);
    return null;
  }

  return {
    signedUrl: data.signedUrl,
    path: data.path,
    token: data.token,
  };
}

/**
 * Get the public URL for an uploaded asset.
 */
export async function getAssetPublicUrl(path: string): Promise<string> {
  const supabase = await createClient();

  const { data } = supabase.storage
    .from('project-assets')
    .getPublicUrl(path);

  return data.publicUrl;
}

export interface ProjectAsset {
  name: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'other';
  size: number;
}

/**
 * List all assets for a project.
 * Returns array of assets with public URLs.
 */
export async function listProjectAssets(projectId: string): Promise<ProjectAsset[]> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return [];

  const { data: files, error } = await supabase.storage
    .from('project-assets')
    .list(projectId, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error || !files) {
    console.error('Failed to list project assets:', error);
    return [];
  }

  // Get public URLs and determine types
  const assets: ProjectAsset[] = files
    .filter(file => !file.name.startsWith('.')) // Skip hidden files
    .map(file => {
      const path = `${projectId}/${file.name}`;
      const { data } = supabase.storage
        .from('project-assets')
        .getPublicUrl(path);

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let type: ProjectAsset['type'] = 'other';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
        type = 'image';
      } else if (['mp4', 'webm', 'mov'].includes(ext)) {
        type = 'video';
      } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
        type = 'audio';
      }

      return {
        name: file.name,
        url: data.publicUrl,
        type,
        size: file.metadata?.size || 0,
      };
    });

  return assets;
}
