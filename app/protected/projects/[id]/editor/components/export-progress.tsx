'use client';

import { useEffect, useState } from 'react';
import { X, Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type RenderStatus = 'pending' | 'rendering' | 'complete' | 'failed';

interface RenderJob {
  id: string;
  status: RenderStatus;
  progress: number;
  output_url: string | null;
  error: string | null;
}

interface ExportProgressProps {
  jobId: string | null;
  onClose: () => void;
  onRetry?: () => void;
}

export function ExportProgress({ jobId, onClose, onRetry }: ExportProgressProps) {
  const [job, setJob] = useState<RenderJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const supabase = createClient();

    // Fetch initial state
    // Note: render_jobs table will be created in 10-01 migration.
    // Using type assertion since table may not be in generated types yet.
    (supabase
      .from('render_jobs' as any)
      .select('id, status, progress, output_url, error')
      .eq('id', jobId)
      .single() as any)
      .then(({ data, error: fetchError }: { data: any; error: any }) => {
        if (fetchError) {
          setError(fetchError.message);
        } else if (data) {
          setJob(data as RenderJob);
        }
      });

    // Poll progress API every 3 seconds as fallback
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/export/progress/${jobId}`);
        if (res.ok) {
          const data = await res.json();
          setJob({
            id: jobId,
            status: data.status,
            progress: data.progress ?? 0,
            output_url: data.outputUrl ?? null,
            error: data.error ?? null,
          });
          // Stop polling when terminal
          if (data.status === 'complete' || data.status === 'failed') {
            clearInterval(pollInterval);
          }
        }
      } catch {
        // Ignore poll errors, realtime is primary
      }
    }, 5000);

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`render-job-${jobId}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'render_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload: any) => {
          const updated = payload.new as RenderJob;
          setJob(updated);
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  if (!jobId) return null;

  const status = job?.status ?? 'pending';
  const progress = job?.progress ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-sm rounded-lg border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Export Progress</h2>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-muted"
            aria-label="Close progress"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Pending */}
        {status === 'pending' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Preparing render...</p>
          </div>
        )}

        {/* Rendering */}
        {status === 'rendering' && (
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Rendering</span>
              <span className="font-medium">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Complete */}
        {status === 'complete' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="text-sm text-muted-foreground">Export complete!</p>
            {job?.output_url && (
              <a
                href={job.output_url}
                download
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download MP4
              </a>
            )}
          </div>
        )}

        {/* Failed */}
        {status === 'failed' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="text-sm text-red-400">{job?.error || error || 'Export failed'}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Retry Export
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
