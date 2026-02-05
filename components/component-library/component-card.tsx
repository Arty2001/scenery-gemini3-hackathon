'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ImageIcon, Download, Monitor, Smartphone, Maximize, RefreshCw } from 'lucide-react';
import { regenerateComponentPreview } from '@/lib/actions/components';

const DEVICE_PRESETS = {
  laptop: { label: 'Laptop', icon: Monitor, width: 1440, height: 900 },
  phone: { label: 'Phone', icon: Smartphone, width: 390, height: 844 },
  full: { label: 'Full', icon: Maximize, width: 1920, height: 1080 },
} as const;

type DeviceType = keyof typeof DEVICE_PRESETS;

interface ComponentCardProps {
  component: {
    id: string;
    componentName: string;
    category?: string;
    description?: string;
    thumbnailUrl?: string;
    previewHtml?: string;
  };
  isSelected?: boolean;
  onSelect: () => void;
  onPreviewUpdate?: (componentId: string, newHtml: string) => void;
}

function PreviewIframe({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      html, body { margin: 0; padding: 12px; overflow: hidden; background: white;
        display: flex; align-items: center; justify-content: center; min-height: 100%; }
      * { box-sizing: border-box; }
    </style></head><body>${html}</body></html>`);
    doc.close();
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      className="absolute inset-0 w-full h-full border-0 pointer-events-none"
      sandbox="allow-same-origin"
      title="Component preview"
    />
  );
}

function renderToIframe(html: string, width: number, height: number): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;left:-9999px;width:${width}px;height:${height}px`;
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><style>
    html, body { margin: 0; padding: 24px; background: white;
      display: flex; align-items: center; justify-content: center; min-height: 100%; }
    * { box-sizing: border-box; }
  </style></head><body>${html}</body></html>`);
  doc.close();
  return iframe;
}

export function ComponentCard({ component, isSelected = false, onSelect, onPreviewUpdate }: ComponentCardProps) {
  const { componentName, category, description, thumbnailUrl, previewHtml } = component;
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleRegenerate = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRegenerating(true);
    try {
      const result = await regenerateComponentPreview(component.id);
      if (result.success && result.previewHtml) {
        onPreviewUpdate?.(component.id, result.previewHtml);
      } else {
        console.error('Regenerate failed:', result.error);
      }
    } catch (err) {
      console.error('Regenerate error:', err);
    } finally {
      setRegenerating(false);
    }
  }, [component.id, onPreviewUpdate]);

  // Close menu on outside click
  useEffect(() => {
    if (!showExport) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExport]);

  const doExport = useCallback(async (device: DeviceType, format: 'png' | 'svg') => {
    if (!previewHtml) return;
    setExporting(true);
    const { width, height } = DEVICE_PRESETS[device];
    const suffix = `${device}-${width}x${height}`;

    try {
      if (format === 'svg') {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:center;min-height:${height}px;padding:24px;background:white">
${previewHtml}
    </div>
  </foreignObject>
</svg>`;
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${componentName}-${suffix}.svg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const iframe = renderToIframe(previewHtml, width, height);
        await new Promise(r => setTimeout(r, 400));
        try {
          const { default: html2canvas } = await import('html2canvas');
          const canvas = await html2canvas(iframe.contentDocument!.body, {
            backgroundColor: '#ffffff',
            width,
            height,
            scale: 2,
          });
          const link = document.createElement('a');
          link.download = `${componentName}-${suffix}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        } finally {
          document.body.removeChild(iframe);
        }
      }
    } catch {
      console.error(`${format.toUpperCase()} export failed`);
    } finally {
      setExporting(false);
      setShowExport(false);
    }
  }, [previewHtml, componentName]);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/50 group',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Thumbnail area */}
      <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-white">
        {previewHtml ? (
          <PreviewIframe html={previewHtml} />
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${componentName} preview`}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted relative">
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 shadow-sm"
              onClick={handleRegenerate}
              disabled={regenerating}
              title="Generate preview"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', regenerating && 'animate-spin')} />
            </Button>
          </div>
        )}

        {/* Action buttons on hover */}
        {previewHtml && (
          <div className="absolute top-2 right-2 z-10 flex gap-1" ref={menuRef}>
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 shadow-sm"
              onClick={handleRegenerate}
              disabled={regenerating}
              title="Regenerate preview"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', regenerating && 'animate-spin')} />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className={cn(
                'h-7 w-7 shadow-sm transition-opacity',
                showExport ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
              onClick={(e) => { e.stopPropagation(); setShowExport(!showExport); }}
              title="Export"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>

            {/* Export menu */}
            {showExport && (
              <div
                className="absolute top-9 right-0 w-48 rounded-lg border bg-popover p-1.5 shadow-lg text-popover-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Export as</p>
                {(Object.keys(DEVICE_PRESETS) as DeviceType[]).map((device) => {
                  const preset = DEVICE_PRESETS[device];
                  const Icon = preset.icon;
                  return (
                    <div key={device} className="flex items-center gap-1">
                      <button
                        className="flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                        onClick={() => doExport(device, 'png')}
                        disabled={exporting}
                      >
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{preset.label}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">{preset.width}x{preset.height}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">PNG</Badge>
                      </button>
                      <button
                        className="rounded-md px-1.5 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                        onClick={() => doExport(device, 'svg')}
                        disabled={exporting}
                        title="Export as SVG"
                      >
                        <Badge variant="outline" className="text-[9px] px-1 py-0">SVG</Badge>
                      </button>
                    </div>
                  );
                })}
                {exporting && (
                  <p className="px-2 py-1 text-xs text-muted-foreground animate-pulse">Exporting...</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <h3 className="font-medium truncate" title={componentName}>
          {componentName}
        </h3>

        {category && (
          <Badge variant="secondary" className="mt-2 text-xs">
            {category}
          </Badge>
        )}

        {description && (
          <p
            className="mt-2 text-sm text-muted-foreground line-clamp-2"
            title={description}
          >
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
