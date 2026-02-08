'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { X, FileCode, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PropsForm } from '@/components/props-editor';
import type { ComponentInfo } from '@/lib/component-discovery/types';
import { propsToJsonSchema } from '@/lib/component-discovery/props-to-json-schema';
import { generatePreviewWithProps } from '@/lib/actions/components';

interface ComponentDetailPanelProps {
  component: (ComponentInfo & { id?: string }) | null;
  currentProps: Record<string, unknown>;
  onPropsChange: (props: Record<string, unknown>) => void;
  onClose: () => void;
}

/**
 * ComponentDetailPanel - Sidebar panel showing selected component details
 *
 * Displays component metadata, description, and a PropsForm for editing.
 * Shows AI-suggested demo props with confidence badge.
 * Live preview updates when props change.
 */
export function ComponentDetailPanel({
  component,
  currentProps,
  onPropsChange,
  onClose,
}: ComponentDetailPanelProps) {
  // Custom preview HTML state (generated from edited props)
  const [customPreviewHtml, setCustomPreviewHtml] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Debounce timer ref
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Track if props have been modified from original
  const [propsModified, setPropsModified] = useState(false);

  // Convert PropInfo[] to JSON Schema for PropsForm
  const propsSchema = useMemo(() => {
    if (!component?.props || component.props.length === 0) {
      return null;
    }
    return propsToJsonSchema(component.props);
  }, [component?.props]);

  // Reset custom preview when component changes
  useEffect(() => {
    setCustomPreviewHtml(null);
    setPreviewError(null);
    setPropsModified(false);
  }, [component?.componentName]);

  // Generate preview with custom props (debounced)
  const regeneratePreview = useCallback(async (props: Record<string, unknown>) => {
    if (!component?.id) {
      console.log('[live-preview] No component ID, skipping');
      return;
    }

    // Don't regenerate if props are empty
    if (Object.keys(props).length === 0) {
      setCustomPreviewHtml(null);
      return;
    }

    setIsGeneratingPreview(true);
    setPreviewError(null);

    try {
      const result = await generatePreviewWithProps(component.id, props);

      if (result.success && result.previewHtml) {
        setCustomPreviewHtml(result.previewHtml);
      } else {
        setPreviewError(result.error ?? 'Failed to generate preview');
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [component?.id]);

  // Handle props change with debounce
  const handlePropsChange = useCallback((newProps: Record<string, unknown>) => {
    onPropsChange(newProps);
    setPropsModified(true);

    // Clear existing debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the preview regeneration (800ms)
    debounceRef.current = setTimeout(() => {
      regeneratePreview(newProps);
    }, 800);
  }, [onPropsChange, regeneratePreview]);

  // Apply demo props and regenerate preview
  const handleApplyDemoProps = useCallback(() => {
    if (!component?.demoProps) return;
    onPropsChange(component.demoProps);
    setPropsModified(true);
    regeneratePreview(component.demoProps);
  }, [component?.demoProps, onPropsChange, regeneratePreview]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Determine which preview HTML to show
  const displayPreviewHtml = propsModified && customPreviewHtml
    ? customPreviewHtml
    : component?.previewHtml;

  // Empty state - no component selected
  if (!component) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <FileCode className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-lg font-medium text-muted-foreground">
          Select a component
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a component from the grid to view details and edit props.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold truncate" title={component.componentName}>
          {component.componentName}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Preview */}
        <div className="rounded-lg border bg-white aspect-video overflow-hidden relative">
          {isGeneratingPreview && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Updating preview...</span>
              </div>
            </div>
          )}
          {previewError && !isGeneratingPreview && (
            <div className="absolute inset-0 bg-destructive/10 flex items-center justify-center z-10">
              <div className="text-center p-4">
                <p className="text-sm text-destructive font-medium">Preview Error</p>
                <p className="text-xs text-destructive/80 mt-1">{previewError}</p>
              </div>
            </div>
          )}
          {displayPreviewHtml ? (
            <DetailPreviewIframe html={displayPreviewHtml} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <FileCode className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
          {/* Live preview indicator */}
          {propsModified && customPreviewHtml && !isGeneratingPreview && (
            <div className="absolute top-2 left-2 z-10">
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 border-green-200">
                Live Preview
              </Badge>
            </div>
          )}
        </div>

        {/* File path */}
        <p className="text-sm text-muted-foreground truncate" title={component.filePath}>
          {component.filePath}
        </p>

        {/* Category badge */}
        {component.category && (
          <div>
            <Badge variant="secondary">{component.category}</Badge>
            {component.categoryConfidence !== undefined && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({Math.round(component.categoryConfidence * 100)}% confidence)
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {component.description && (
          <p className="text-sm text-muted-foreground">{component.description}</p>
        )}

        {/* Divider */}
        <hr className="border-border" />

        {/* Props Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Props</h3>
            {propsModified && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => regeneratePreview(currentProps)}
                disabled={isGeneratingPreview}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isGeneratingPreview ? 'animate-spin' : ''}`} />
                Refresh Preview
              </Button>
            )}
          </div>
          <PropsForm
            propsSchema={propsSchema}
            currentProps={currentProps}
            onPropsChange={handlePropsChange}
          />
        </div>

        {/* Divider */}
        {component.demoProps && (
          <>
            <hr className="border-border" />

            {/* Demo Props Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-medium">AI Demo Props</h3>
                {component.demoPropsConfidence && (
                  <ConfidenceBadge confidence={component.demoPropsConfidence} />
                )}
              </div>
              <div className="rounded-md border bg-muted/50 p-3">
                <pre className="text-xs text-muted-foreground overflow-auto max-h-48">
                  {JSON.stringify(component.demoProps, null, 2)}
                </pre>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={handleApplyDemoProps}
                disabled={isGeneratingPreview}
              >
                {isGeneratingPreview ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  'Apply Demo Props'
                )}
              </Button>
            </div>
          </>
        )}

        {/* Secondary Categories */}
        {component.secondaryCategories && component.secondaryCategories.length > 0 && (
          <>
            <hr className="border-border" />
            <div>
              <h3 className="text-sm font-medium mb-2">Related Categories</h3>
              <div className="flex flex-wrap gap-1">
                {component.secondaryCategories.map((cat) => (
                  <Badge key={cat} variant="outline" className="text-xs">
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Analysis Error */}
        {component.analysisError && (
          <>
            <hr className="border-border" />
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">Analysis Error</p>
              <p className="mt-1 text-xs text-destructive/80">{component.analysisError}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Preview iframe component
 */
function DetailPreviewIframe({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      html, body { margin: 0; padding: 16px; overflow: hidden; background: white;
        display: flex; align-items: center; justify-content: center; min-height: 100%; }
      * { box-sizing: border-box; }
    </style></head><body>${html}</body></html>`);
    doc.close();
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      className="absolute inset-0 w-full h-full border-0"
      sandbox="allow-same-origin"
      title="Component preview"
    />
  );
}

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const variants: Record<typeof confidence, 'default' | 'secondary' | 'outline'> = {
    high: 'default',
    medium: 'secondary',
    low: 'outline',
  };

  return (
    <Badge variant={variants[confidence]} className="text-xs">
      {confidence}
    </Badge>
  );
}
