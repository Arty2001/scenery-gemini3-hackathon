'use client';

import { useCallback, useState } from 'react';
import type { CursorItem, CursorKeyframe, CursorInteraction } from '@/lib/composition/types';
import { useCompositionStore } from '@/lib/composition/store';
import { useInteractiveElements } from '@/lib/hooks/use-interactive-elements';
import { Plus, Trash2, ChevronDown, ChevronRight, Sparkles, Target, MousePointer } from 'lucide-react';

const INTERACTION_ACTIONS: CursorInteraction['action'][] = ['click', 'hover', 'focus', 'type', 'select', 'check'];

interface CursorPropertiesProps {
  item: CursorItem;
  onUpdate: (updates: Partial<CursorItem>) => void;
}

export function CursorProperties({ item, onUpdate }: CursorPropertiesProps) {
  const keyframes = item.keyframes ?? [];
  const compWidth = useCompositionStore((s) => s.width);
  const compHeight = useCompositionStore((s) => s.height);

  // Get interactive elements from components in the composition
  const { activeElements, isLoading } = useInteractiveElements();

  // Track which keyframe's selector dropdown is open
  const [openSelectorIdx, setOpenSelectorIdx] = useState<number | null>(null);

  const updateKeyframe = useCallback(
    (index: number, updates: Partial<CursorKeyframe>) => {
      const updated = keyframes.map((k, i) =>
        i === index ? { ...k, ...updates } : k
      );
      onUpdate({ keyframes: updated });
    },
    [keyframes, onUpdate]
  );

  const addKeyframe = useCallback(() => {
    const lastFrame = keyframes.length > 0 ? keyframes[keyframes.length - 1].frame + 30 : 0;
    onUpdate({
      keyframes: [...keyframes, {
        frame: lastFrame,
        // Don't set x/y - will be resolved from target or default to center
      }],
    });
  }, [keyframes, onUpdate]);

  const removeKeyframe = useCallback(
    (index: number) => {
      onUpdate({ keyframes: keyframes.filter((_, i) => i !== index) });
    },
    [keyframes, onUpdate]
  );

  const updateInteraction = useCallback(
    (index: number, interaction: CursorInteraction | undefined) => {
      updateKeyframe(index, { interaction });
    },
    [updateKeyframe]
  );

  // Select an element - sets both target AND interaction
  const selectElement = useCallback(
    (keyframeIndex: number, selector: string, suggestedAction: CursorInteraction['action']) => {
      const currentKf = keyframes[keyframeIndex];
      const currentInteraction = currentKf?.interaction;

      // Set target for auto-positioning AND interaction for visual effects
      updateKeyframe(keyframeIndex, {
        target: selector,
        interaction: {
          selector,
          action: currentInteraction?.action ?? suggestedAction,
          value: currentInteraction?.value,
        },
      });
      setOpenSelectorIdx(null);
    },
    [keyframes, updateKeyframe]
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Cursor Settings</h3>

      {/* Cursor Style */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Cursor Style</label>
        <select
          className="w-full rounded border bg-background px-2 py-1 text-sm"
          value={item.cursorStyle ?? 'default'}
          onChange={(e) =>
            onUpdate({ cursorStyle: e.target.value as CursorItem['cursorStyle'] })
          }
        >
          <option value="default">Default (Arrow)</option>
          <option value="pointer">Pointer</option>
          <option value="hand">Hand</option>
        </select>
      </div>

      {/* Click Effect */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Click Effect</label>
        <select
          className="w-full rounded border bg-background px-2 py-1 text-sm"
          value={item.clickEffect ?? 'ripple'}
          onChange={(e) =>
            onUpdate({ clickEffect: e.target.value as CursorItem['clickEffect'] })
          }
        >
          <option value="ripple">Ripple</option>
          <option value="highlight">Highlight</option>
          <option value="none">None</option>
        </select>
      </div>

      {/* Scale */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Scale</label>
        <input
          type="number"
          className="w-full rounded border bg-background px-2 py-1 text-sm"
          value={item.scale ?? 1}
          min={0.5}
          max={3}
          step={0.1}
          onChange={(e) => onUpdate({ scale: parseFloat(e.target.value) || 1 })}
        />
      </div>

      {/* Keyframes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Keyframes</h3>
          <button
            onClick={addKeyframe}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs hover:bg-accent"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>

        {keyframes.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No keyframes. Add one to define cursor position.
          </p>
        )}

        <div className="space-y-2">
          {keyframes.map((kf, i) => (
            <div key={i} className="rounded border p-2 text-xs space-y-2">
              {/* Header row with frame and click */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">Frame</label>
                  <input
                    type="number"
                    className="w-full rounded border bg-background px-1 py-0.5 text-xs"
                    value={kf.frame}
                    min={0}
                    onChange={(e) =>
                      updateKeyframe(i, { frame: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <label className="flex items-center gap-1 text-[10px] pt-3">
                  <input
                    type="checkbox"
                    checked={kf.click ?? false}
                    onChange={(e) => updateKeyframe(i, { click: e.target.checked })}
                  />
                  Click
                </label>
                <button
                  onClick={() => removeKeyframe(i)}
                  className="p-0.5 hover:text-destructive pt-3"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {/* Target Element - Main input */}
              <div className="relative">
                <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Target Element
                  {activeElements.length > 0 && (
                    <span className="text-primary">
                      <Sparkles className="h-2.5 w-2.5" />
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full rounded border bg-background px-2 py-1 text-xs pr-6"
                    value={kf.target || kf.interaction?.selector || ''}
                    placeholder="Select an element or enter CSS selector"
                    onChange={(e) => {
                      const selector = e.target.value;
                      updateKeyframe(i, {
                        target: selector || undefined,
                        interaction: selector ? {
                          selector,
                          action: kf.interaction?.action ?? 'click',
                          value: kf.interaction?.value,
                        } : undefined,
                      });
                    }}
                    onFocus={() => setOpenSelectorIdx(i)}
                  />
                  {activeElements.length > 0 && (
                    <button
                      type="button"
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setOpenSelectorIdx(openSelectorIdx === i ? null : i)}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Element Dropdown */}
                {openSelectorIdx === i && activeElements.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded border bg-popover shadow-lg">
                    {isLoading ? (
                      <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
                        Loading elements...
                      </div>
                    ) : (
                      <>
                        <div className="px-2 py-1 text-[10px] text-muted-foreground border-b bg-muted/50">
                          Select an element - cursor will auto-position to it
                        </div>
                        {activeElements.map((el, idx) => (
                          <button
                            key={`${el.componentId}-${idx}`}
                            type="button"
                            className="w-full px-2 py-1.5 text-left text-[10px] hover:bg-accent flex flex-col gap-0.5"
                            onClick={() => selectElement(i, el.selector, el.suggestedAction)}
                          >
                            <span className="font-medium truncate flex items-center gap-1">
                              <MousePointer className="h-2.5 w-2.5 text-primary" />
                              {el.label}
                            </span>
                            <span className="text-muted-foreground flex items-center gap-1 pl-3.5">
                              <code className="bg-muted px-1 rounded text-[9px]">{el.selector}</code>
                              <span className="text-primary/70">{el.suggestedAction}</span>
                            </span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Interaction Settings - Show when target is set */}
              {(kf.target || kf.interaction) && (
                <div className="space-y-1 pl-3 border-l-2 border-primary/20">
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className="text-[10px] text-muted-foreground">Action</label>
                      <select
                        className="w-full rounded border bg-background px-1 py-0.5 text-xs"
                        value={kf.interaction?.action ?? 'click'}
                        onChange={(e) =>
                          updateKeyframe(i, {
                            interaction: {
                              selector: kf.target || kf.interaction?.selector || 'button',
                              action: e.target.value as CursorInteraction['action'],
                              value: kf.interaction?.value,
                              speed: kf.interaction?.speed,
                              holdDuration: kf.interaction?.holdDuration,
                            },
                          })
                        }
                      >
                        {INTERACTION_ACTIONS.map((action) => (
                          <option key={action} value={action}>{action}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Value</label>
                      <input
                        type="text"
                        className="w-full rounded border bg-background px-1 py-0.5 text-xs"
                        value={kf.interaction?.value ?? ''}
                        placeholder={
                          kf.interaction?.action === 'type' ? 'Text to type...' :
                          kf.interaction?.action === 'select' ? 'Option value' : ''
                        }
                        disabled={!['type', 'select'].includes(kf.interaction?.action ?? '')}
                        onChange={(e) =>
                          updateKeyframe(i, {
                            interaction: {
                              selector: kf.target || kf.interaction?.selector || 'button',
                              action: kf.interaction?.action ?? 'click',
                              value: e.target.value || undefined,
                              speed: kf.interaction?.speed,
                              holdDuration: kf.interaction?.holdDuration,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Speed control for typing */}
                  {kf.interaction?.action === 'type' && (
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Speed (frames/char)</label>
                        <select
                          className="w-full rounded border bg-background px-1 py-0.5 text-xs"
                          value={kf.interaction?.speed ?? 1}
                          onChange={(e) =>
                            updateKeyframe(i, {
                              interaction: {
                                ...kf.interaction!,
                                speed: parseInt(e.target.value),
                              },
                            })
                          }
                        >
                          <option value={1}>1 - Fast</option>
                          <option value={2}>2 - Deliberate</option>
                          <option value={3}>3 - Slow</option>
                        </select>
                      </div>
                      <div className="text-[10px] text-muted-foreground pt-4">
                        ~{(kf.interaction?.value?.length ?? 0) * (kf.interaction?.speed ?? 1)} frames
                      </div>
                    </div>
                  )}

                  {/* Hold duration for click/hover */}
                  {['click', 'hover'].includes(kf.interaction?.action ?? '') && (
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Hold Duration</label>
                        <input
                          type="number"
                          className="w-full rounded border bg-background px-1 py-0.5 text-xs"
                          value={kf.interaction?.holdDuration ?? (kf.interaction?.action === 'click' ? 8 : 15)}
                          min={1}
                          max={60}
                          onChange={(e) =>
                            updateKeyframe(i, {
                              interaction: {
                                ...kf.interaction!,
                                holdDuration: parseInt(e.target.value) || undefined,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground pt-4">
                        frames visible
                      </div>
                    </div>
                  )}

                  {/* Interaction preview indicator */}
                  <div className="text-[10px] flex items-center gap-1 pt-1 text-muted-foreground">
                    {kf.interaction?.action === 'hover' && (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-400">
                        ✨ Highlight glow
                      </span>
                    )}
                    {kf.interaction?.action === 'click' && (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-400">
                        👆 Press effect
                      </span>
                    )}
                    {kf.interaction?.action === 'focus' && (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-400">
                        🔲 Focus ring
                      </span>
                    )}
                    {kf.interaction?.action === 'type' && (
                      <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-1.5 py-0.5 text-green-400">
                        ⌨️ Typing animation
                      </span>
                    )}
                    {kf.interaction?.action === 'select' && (
                      <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-purple-400">
                        📋 Select option
                      </span>
                    )}
                    {kf.interaction?.action === 'check' && (
                      <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-1.5 py-0.5 text-green-400">
                        ☑️ Toggle check
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Manual Position Override (collapsed by default) */}
              {!kf.target && !kf.interaction && (
                <div className="text-[10px] text-muted-foreground italic">
                  No target set. Select an element above or set manual coordinates.
                </div>
              )}
              {(kf.x != null || kf.y != null) && (
                <div className="grid grid-cols-2 gap-1 pt-1 border-t border-dashed">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Manual X (px)</label>
                    <input
                      type="number"
                      className="w-full rounded border bg-background px-1 py-0.5 text-xs"
                      value={kf.x ?? ''}
                      placeholder="Auto"
                      onChange={(e) =>
                        updateKeyframe(i, { x: e.target.value ? parseInt(e.target.value) : undefined })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Manual Y (px)</label>
                    <input
                      type="number"
                      className="w-full rounded border bg-background px-1 py-0.5 text-xs"
                      value={kf.y ?? ''}
                      placeholder="Auto"
                      onChange={(e) =>
                        updateKeyframe(i, { y: e.target.value ? parseInt(e.target.value) : undefined })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Click outside to close dropdown */}
      {openSelectorIdx !== null && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenSelectorIdx(null)}
        />
      )}
    </div>
  );
}
