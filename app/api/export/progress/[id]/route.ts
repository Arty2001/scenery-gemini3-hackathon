/**
 * GET /api/export/progress/[id]
 *
 * Polls Remotion Lambda for render progress, updates render_jobs table,
 * and returns current progress to the client.
 *
 * The render_jobs table update triggers Supabase Realtime notifications
 * for clients subscribed to the job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRenderProgress } from '@remotion/lambda/client';
import { createClient } from '@/lib/supabase/server';
import { getLambdaConfig } from '@/lib/remotion/lambda-config';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Fetch job, verify ownership
  const { data: job, error: jobError } = await supabase
    .from('render_jobs')
    .select('id, render_id, bucket_name, status, progress, output_url, error, user_id')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.user_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  // If already complete or failed, return current state without polling Lambda
  if (job.status === 'complete' || job.status === 'failed') {
    return NextResponse.json({
      progress: job.progress,
      status: job.status,
      outputUrl: job.output_url,
      error: job.error,
      done: job.status === 'complete',
    });
  }

  // Poll Lambda for progress
  if (!job.render_id || !job.bucket_name) {
    return NextResponse.json({ error: 'Missing render metadata' }, { status: 500 });
  }

  const config = getLambdaConfig();

  let progress;
  try {
    progress = await getRenderProgress({
      renderId: job.render_id,
      bucketName: job.bucket_name,
      functionName: config.functionName,
      region: config.region,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // Rate limited — return last known state instead of 502
    if (errMsg.includes('TooManyRequests') || errMsg.includes('Rate Exceeded')) {
      return NextResponse.json({
        progress: job.progress,
        status: job.status,
        outputUrl: job.output_url,
        error: null,
        done: false,
        rateLimited: true,
      });
    }
    console.error('getRenderProgress failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch render progress' },
      { status: 502 }
    );
  }

  // Determine new status
  const newStatus = progress.done
    ? 'complete'
    : progress.fatalErrorEncountered
      ? 'failed'
      : 'rendering';

  const errorMessage = progress.fatalErrorEncountered
    ? (progress.errors?.[0]?.message ?? 'Unknown render error')
    : null;

  // Update render_jobs table (triggers Realtime for subscribed clients)
  await supabase
    .from('render_jobs')
    .update({
      progress: progress.overallProgress,
      status: newStatus,
      output_url: progress.outputFile ?? null,
      error: errorMessage,
    })
    .eq('id', jobId);

  return NextResponse.json({
    progress: progress.overallProgress,
    status: newStatus,
    outputUrl: progress.outputFile ?? null,
    error: errorMessage,
    done: progress.done,
  });
}
