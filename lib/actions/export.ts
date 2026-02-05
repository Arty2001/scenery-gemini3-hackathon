'use server';

/**
 * Server actions for video export via Remotion Lambda.
 *
 * Handles:
 * - startExport: Initiate Lambda render and create render_jobs row
 * - getRenderJob: Fetch render job by id with ownership check
 */

import { renderMediaOnLambda } from '@remotion/lambda/client';
import { createClient } from '@/lib/supabase/server';
import { getLambdaConfig, QUALITY_PRESETS } from '@/lib/remotion/lambda-config';
import type { QualityPreset } from '@/lib/remotion/lambda-config';
import { getComponentPreviews } from '@/lib/actions/components';

// =============================================
// Types
// =============================================

interface StartExportResult {
  jobId?: string;
  renderId?: string;
  error?: string;
}

interface RenderJobData {
  id: string;
  compositionId: string;
  status: string;
  progress: number;
  quality: string;
  outputUrl: string | null;
  error: string | null;
  createdAt: string;
}

// =============================================
// Actions
// =============================================

/**
 * Start a video export via Remotion Lambda.
 *
 * 1. Auth check
 * 2. Verify user owns the composition
 * 3. Call renderMediaOnLambda
 * 4. Insert render_jobs row
 * 5. Return jobId and renderId
 */
export async function startExport(
  compositionId: string,
  quality: QualityPreset = '1080p'
): Promise<StartExportResult> {
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Fetch composition and verify ownership (compositions -> projects -> user_id)
  const { data: composition, error: compError } = await supabase
    .from('compositions')
    .select('id, project_id, tracks, duration_in_frames, fps, width, height, projects!inner(user_id)')
    .eq('id', compositionId)
    .single();

  if (compError || !composition) {
    return { error: 'Composition not found' };
  }

  // Verify ownership through project
  const project = composition.projects as unknown as { user_id: string };
  if (project.user_id !== user.id) {
    return { error: 'Not authorized' };
  }

  // 3. Fetch preview HTML for components
  const componentItems = (composition.tracks as any[])
    .flatMap((t: any) => t.items || [])
    .filter((item: any) => item.type === 'component');
  const componentIds = [...new Set(componentItems.map((i: any) => i.componentId))] as string[];

  let componentPreviews: Record<string, string> = {};

  if (componentIds.length > 0) {
    componentPreviews = await getComponentPreviews(componentIds);
  }

  // 4. Call renderMediaOnLambda
  const config = getLambdaConfig();
  const preset = QUALITY_PRESETS[quality];

  let renderId: string;
  let bucketName: string;

  try {
    const result = await renderMediaOnLambda({
      region: config.region,
      functionName: config.functionName,
      serveUrl: config.serveUrl,
      composition: 'MainComposition',
      inputProps: {
        tracks: composition.tracks,
        componentPreviews,
        durationInFrames: composition.duration_in_frames,
        fps: composition.fps,
        width: composition.width,
        height: composition.height,
      },
      codec: 'h264',
      scale: preset.scale,
      imageFormat: 'jpeg',
      maxRetries: 1,
      privacy: 'public',
      framesPerLambda: 200, // Reduce concurrency to stay within AWS limits
    });

    renderId = result.renderId;
    bucketName = result.bucketName;
  } catch (err) {
    console.error('renderMediaOnLambda failed:', err);
    return { error: err instanceof Error ? err.message : 'Lambda render failed' };
  }

  // 5. Insert render_jobs row
  const { data: job, error: insertError } = await supabase
    .from('render_jobs')
    .insert({
      composition_id: compositionId,
      user_id: user.id,
      render_id: renderId,
      bucket_name: bucketName,
      quality,
      status: 'rendering',
      progress: 0,
    })
    .select('id')
    .single();

  if (insertError || !job) {
    console.error('Failed to create render job:', insertError);
    return { error: 'Failed to create render job' };
  }

  // 6. Return result
  return { jobId: job.id, renderId };
}

/**
 * Fetch a render job by id, verifying the current user owns it.
 */
export async function getRenderJob(
  jobId: string
): Promise<RenderJobData | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: job } = await supabase
    .from('render_jobs')
    .select('id, composition_id, status, progress, quality, output_url, error, created_at')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single();

  if (!job) return null;

  return {
    id: job.id,
    compositionId: job.composition_id,
    status: job.status,
    progress: job.progress,
    quality: job.quality,
    outputUrl: job.output_url,
    error: job.error,
    createdAt: job.created_at,
  };
}
