'use client';

import { useState } from 'react';
import { X, Download, AlertTriangle } from 'lucide-react';

export type ExportQuality = '720p' | '1080p' | '4K';

interface QualityOption {
  value: ExportQuality;
  label: string;
  resolution: string;
  description: string;
}

const QUALITY_OPTIONS: QualityOption[] = [
  { value: '720p', label: '720p', resolution: '1280 x 720', description: 'Fastest render, smaller file' },
  { value: '1080p', label: '1080p', resolution: '1920 x 1080', description: 'Recommended for most uses' },
  { value: '4K', label: '4K', resolution: '3840 x 2160', description: 'Highest quality, larger file' },
];

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (quality: ExportQuality) => void;
  isExporting: boolean;
  hasComponentItems?: boolean;
}

export function ExportDialog({
  open,
  onOpenChange,
  onExport,
  isExporting,
  hasComponentItems = false,
}: ExportDialogProps) {
  const [selectedQuality, setSelectedQuality] = useState<ExportQuality>('1080p');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !isExporting && onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-background p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Export Video</h2>
          <button
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            className="rounded p-1 hover:bg-muted disabled:opacity-50"
            aria-label="Close export dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Component items warning */}
        {hasComponentItems && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
            <span>
              Some timeline items use React components. These will be rendered
              server-side which may affect interactive elements.
            </span>
          </div>
        )}

        {/* Quality selection */}
        <div className="space-y-2 mb-6">
          <label className="text-sm font-medium text-muted-foreground">Quality</label>
          <div className="space-y-2">
            {QUALITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedQuality(option.value)}
                disabled={isExporting}
                className={`w-full rounded-md border p-3 text-left transition-colors ${
                  selectedQuality === option.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground/30'
                } disabled:opacity-50`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.resolution}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Export button */}
        <button
          onClick={() => onExport(selectedQuality)}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          {isExporting
            ? hasComponentItems
              ? 'Preparing components...'
              : 'Exporting...'
            : 'Export MP4'}
        </button>
      </div>
    </div>
  );
}
