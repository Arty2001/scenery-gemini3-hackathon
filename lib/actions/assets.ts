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
