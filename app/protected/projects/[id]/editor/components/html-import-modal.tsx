'use client';

import { useState } from 'react';
import { Code, Loader2, Sparkles, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { createCustomComponent } from '@/lib/actions/custom-components';

interface HtmlImportModalProps {
  projectId: string;
  onImported?: () => void;
}

type ImportMode = 'ai' | 'direct';

export function HtmlImportModal({ projectId, onImported }: HtmlImportModalProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ImportMode>('ai');
  const [html, setHtml] = useState('');
  const [css, setCss] = useState('');
  const [showCss, setShowCss] = useState(false);
  const [directName, setDirectName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    name: string;
    description: string;
    category: string;
    previewHtml: string;
  } | null>(null);

  const handleProcess = async () => {
    if (!html.trim()) {
      setError('Please paste some HTML');
      return;
    }

    setProcessing(true);
    setError(null);
    setPreview(null);

    try {
      const res = await fetch('/api/ai/process-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, css: css.trim() || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to process HTML');
        return;
      }

      setPreview({
        name: data.name,
        description: data.description,
        category: data.category,
        previewHtml: data.previewHtml,
      });
    } catch (err) {
      setError('Failed to process HTML. Please try again.');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!preview) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await createCustomComponent(projectId, {
        name: preview.name,
        description: preview.description,
        category: preview.category,
        originalHtml: html,
        previewHtml: preview.previewHtml,
      });

      if (!result.success) {
        setError(result.error || 'Failed to save component');
        return;
      }

      // Success - close modal and reset
      setOpen(false);
      setHtml('');
      setPreview(null);
      onImported?.();
    } catch (err) {
      setError('Failed to save component. Please try again.');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  // Direct import - skip AI, use HTML as-is
  const handleDirectImport = () => {
    if (!html.trim()) {
      setError('Please paste some HTML');
      return;
    }
    if (!directName.trim()) {
      setError('Please enter a component name');
      return;
    }

    setError(null);
    setPreview({
      name: directName.trim(),
      description: 'Directly imported HTML component',
      category: 'other',
      previewHtml: html.trim(),
    });
  };

  const handleClose = () => {
    setOpen(false);
    setHtml('');
    setCss('');
    setShowCss(false);
    setDirectName('');
    setMode('ai');
    setPreview(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-2">
          <Code className="h-3.5 w-3.5" />
          Import HTML
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Import HTML Component
          </DialogTitle>
          <DialogDescription>
            {mode === 'ai'
              ? 'Paste HTML from inspect element. AI converts Tailwind/CSS classes to inline styles.'
              : 'Paste ready-to-render HTML with inline styles. No AI processing needed.'}
          </DialogDescription>
        </DialogHeader>

        {/* Mode Toggle */}
        {!preview && (
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setMode('ai')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === 'ai'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              AI Process
            </button>
            <button
              type="button"
              onClick={() => setMode('direct')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === 'direct'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Zap className="h-3 w-3" />
              Direct Import
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4">
          {!preview ? (
            <>
              {/* Component Name - only for direct mode */}
              {mode === 'direct' && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Component Name
                  </label>
                  <Input
                    value={directName}
                    onChange={(e) => setDirectName(e.target.value)}
                    placeholder="e.g., Pricing Card, Hero Section"
                    className="h-9 text-sm"
                    disabled={processing}
                  />
                </div>
              )}

              {/* HTML Input */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {mode === 'ai' ? 'Paste HTML' : 'Paste Ready HTML'}
                </label>
                <textarea
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  placeholder={mode === 'ai'
                    ? "<div class='...'> ... </div>"
                    : "<div style='padding: 16px; ...'> ... </div>"}
                  className="w-full h-36 rounded-md border bg-background p-3 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  disabled={processing}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {mode === 'ai'
                    ? <>Right-click element → Inspect → right-click in Elements → <strong>Copy outerHTML</strong></>
                    : 'Paste HTML with inline styles - will be used exactly as provided'}
                </p>
              </div>

              {/* CSS Input (optional) - only for AI mode */}
              {mode === 'ai' && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowCss(!showCss)}
                    className="text-sm font-medium mb-1.5 flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className={`transition-transform ${showCss ? 'rotate-90' : ''}`}>▶</span>
                    Add CSS (optional)
                  </button>
                  {showCss && (
                    <>
                      <textarea
                        value={css}
                        onChange={(e) => setCss(e.target.value)}
                        placeholder={`.card {\n  padding: 16px;\n  border-radius: 8px;\n}`}
                        className="w-full h-28 rounded-md border bg-background p-3 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                        disabled={processing}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        <strong>Easy way:</strong> Right-click element → Copy → <strong>Copy styles</strong> (gets all computed CSS)
                      </p>
                    </>
                  )}
                </div>
              )}

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
                  {error}
                </div>
              )}

              {mode === 'ai' ? (
                <Button
                  onClick={handleProcess}
                  disabled={processing || !html.trim()}
                  className="w-full gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Process HTML
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleDirectImport}
                  disabled={!html.trim() || !directName.trim()}
                  className="w-full gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Preview Component
                </Button>
              )}
            </>
          ) : (
            <>
              {/* Preview area */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{preview.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {preview.category} • {preview.description}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreview(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden bg-white">
                  <div className="p-1 bg-muted/50 border-b text-[10px] text-muted-foreground">
                    Preview
                  </div>
                  <div className="p-4 min-h-[200px] max-h-[300px] overflow-auto">
                    <div
                      dangerouslySetInnerHTML={{ __html: preview.previewHtml }}
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPreview(null)}
                    disabled={processing}
                    className="flex-1"
                  >
                    Edit HTML
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={processing}
                    className="flex-1 gap-2"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Component'
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
