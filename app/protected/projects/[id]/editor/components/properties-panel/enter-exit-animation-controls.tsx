'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Zap,
} from 'lucide-react';
import type {
  TimelineItem,
  AnimationType,
  AnimationConfig,
  SlideDirection,
  SpringPreset,
} from '@/lib/composition/types';
import {
  ANIMATION_PRESETS,
  SPRING_PRESET_OPTIONS,
} from '@/components/remotion/animation/spring-presets';

// =============================================
// Types
// =============================================

interface EnterExitAnimationControlsProps {
  item: TimelineItem;
  onUpdate: (updates: Partial<TimelineItem>) => void;
}

// Animation type options with categories
const ANIMATION_TYPE_OPTIONS: {
  value: AnimationType;
  label: string;
  description: string;
  category: 'basic' | 'spring' | 'advanced';
  recommended?: boolean;
}[] = [
  // Basic
  { value: 'none', label: 'None', description: 'No animation', category: 'basic' },
  { value: 'fade', label: 'Fade', description: 'Simple opacity fade', category: 'basic' },
  { value: 'slide', label: 'Slide', description: 'Slide from edge', category: 'basic' },
  { value: 'scale', label: 'Scale', description: 'Scale up from small', category: 'basic' },

  // Spring-based (the good stuff from Remotion trailer)
  {
    value: 'spring-scale',
    label: 'Spring Scale',
    description: 'Pop in with spring physics',
    category: 'spring',
    recommended: true,
  },
  {
    value: 'spring-slide',
    label: 'Spring Slide',
    description: 'Slide with spring overshoot',
    category: 'spring',
  },
  {
    value: 'spring-bounce',
    label: 'Bounce',
    description: 'Bouncy scale effect',
    category: 'spring',
  },

  // Advanced
  { value: 'flip', label: '3D Flip', description: 'Card flip effect', category: 'advanced' },
  { value: 'zoom-blur', label: 'Zoom Blur', description: 'Zoom with blur', category: 'advanced' },
];

const DIRECTION_OPTIONS: { value: SlideDirection; label: string; icon: typeof ArrowRight }[] = [
  { value: 'left', label: 'Left', icon: ArrowLeft },
  { value: 'right', label: 'Right', icon: ArrowRight },
  { value: 'top', label: 'Top', icon: ArrowUp },
  { value: 'bottom', label: 'Bottom', icon: ArrowDown },
];

// =============================================
// Component
// =============================================

export function EnterExitAnimationControls({
  item,
  onUpdate,
}: EnterExitAnimationControlsProps) {
  const [expandedSection, setExpandedSection] = useState<'enter' | 'exit' | null>('enter');

  const enterAnimation = item.enterAnimation ?? { type: 'none' as AnimationType };
  const exitAnimation = item.exitAnimation ?? { type: 'none' as AnimationType };

  const updateEnterAnimation = (updates: Partial<AnimationConfig>) => {
    onUpdate({
      enterAnimation: { ...enterAnimation, ...updates } as AnimationConfig,
    });
  };

  const updateExitAnimation = (updates: Partial<AnimationConfig>) => {
    onUpdate({
      exitAnimation: { ...exitAnimation, ...updates } as AnimationConfig,
    });
  };

  const needsDirection = (type: AnimationType) =>
    type === 'slide' || type === 'spring-slide';

  const needsSpringPreset = (type: AnimationType) =>
    type.startsWith('spring-') || type === 'flip' || type === 'zoom-blur';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Enter/Exit Animation</h3>
      </div>

      {/* Quick preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant={enterAnimation.type === 'spring-scale' ? 'secondary' : 'outline'}
          size="sm"
          className={cn(
            'h-7 text-xs gap-1',
            enterAnimation.type === 'spring-scale' && 'ring-1 ring-ring'
          )}
          onClick={() => updateEnterAnimation({ type: 'spring-scale', springPreset: 'smooth' })}
        >
          <Zap className="h-3 w-3" />
          Spring Scale
        </Button>
        <Button
          variant={enterAnimation.type === 'fade' ? 'secondary' : 'outline'}
          size="sm"
          className={cn('h-7 text-xs', enterAnimation.type === 'fade' && 'ring-1 ring-ring')}
          onClick={() => updateEnterAnimation({ type: 'fade' })}
        >
          Fade
        </Button>
        <Button
          variant={enterAnimation.type === 'slide' ? 'secondary' : 'outline'}
          size="sm"
          className={cn('h-7 text-xs', enterAnimation.type === 'slide' && 'ring-1 ring-ring')}
          onClick={() => updateEnterAnimation({ type: 'slide', direction: 'left' })}
        >
          Slide
        </Button>
        <Button
          variant={enterAnimation.type === 'none' ? 'secondary' : 'outline'}
          size="sm"
          className={cn('h-7 text-xs', enterAnimation.type === 'none' && 'ring-1 ring-ring')}
          onClick={() => updateEnterAnimation({ type: 'none' })}
        >
          None
        </Button>
      </div>

      {/* Enter Animation Section */}
      <div className="border rounded-md overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50"
          onClick={() => setExpandedSection(expandedSection === 'enter' ? null : 'enter')}
        >
          {expandedSection === 'enter' ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <span className="font-medium">Enter Animation</span>
          <span className="text-muted-foreground ml-auto">
            {ANIMATION_TYPE_OPTIONS.find((o) => o.value === enterAnimation.type)?.label ?? 'None'}
          </span>
        </button>

        {expandedSection === 'enter' && (
          <div className="px-3 pb-3 space-y-3 border-t pt-3">
            {/* Animation Type */}
            <div>
              <Label className="text-[10px] text-muted-foreground">Type</Label>
              <select
                value={enterAnimation.type}
                onChange={(e) => updateEnterAnimation({ type: e.target.value as AnimationType })}
                className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs mt-1"
              >
                <optgroup label="Basic">
                  {ANIMATION_TYPE_OPTIONS.filter((o) => o.category === 'basic').map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Spring (Recommended)">
                  {ANIMATION_TYPE_OPTIONS.filter((o) => o.category === 'spring').map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} {opt.recommended ? '⭐' : ''}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Advanced">
                  {ANIMATION_TYPE_OPTIONS.filter((o) => o.category === 'advanced').map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">
                {ANIMATION_TYPE_OPTIONS.find((o) => o.value === enterAnimation.type)?.description}
              </p>
            </div>

            {/* Direction (for slide animations) */}
            {needsDirection(enterAnimation.type) && (
              <div>
                <Label className="text-[10px] text-muted-foreground">Direction</Label>
                <div className="flex gap-1 mt-1">
                  {DIRECTION_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <Button
                      key={value}
                      variant={enterAnimation.direction === value ? 'secondary' : 'ghost'}
                      size="sm"
                      className={cn(
                        'h-7 w-7 p-0',
                        enterAnimation.direction === value && 'ring-1 ring-ring'
                      )}
                      onClick={() => updateEnterAnimation({ direction: value })}
                      title={label}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Spring Preset */}
            {needsSpringPreset(enterAnimation.type) && (
              <div>
                <Label className="text-[10px] text-muted-foreground">Spring Feel</Label>
                <select
                  value={enterAnimation.springPreset ?? 'smooth'}
                  onChange={(e) =>
                    updateEnterAnimation({ springPreset: e.target.value as SpringPreset })
                  }
                  className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs mt-1"
                >
                  {SPRING_PRESET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} - {opt.description}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Duration */}
            <div>
              <Label className="text-[10px] text-muted-foreground">Duration (frames)</Label>
              <Input
                type="number"
                min={1}
                max={120}
                defaultValue={enterAnimation.durationInFrames ?? 15}
                key={`enterDuration-${item.id}-${enterAnimation.durationInFrames}`}
                onBlur={(e) =>
                  updateEnterAnimation({
                    durationInFrames: Math.max(1, parseInt(e.target.value) || 15),
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateEnterAnimation({
                      durationInFrames: Math.max(1, parseInt(e.currentTarget.value) || 15),
                    });
                    e.currentTarget.blur();
                  }
                }}
                className="h-7 text-xs mt-1"
              />
            </div>

            {/* Stagger Delay */}
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Stagger Delay (frames)
                <span className="text-muted-foreground/70 ml-1">
                  - delay animation start
                </span>
              </Label>
              <Input
                type="number"
                min={0}
                max={120}
                defaultValue={enterAnimation.staggerDelay ?? 0}
                key={`enterStagger-${item.id}-${enterAnimation.staggerDelay}`}
                onBlur={(e) =>
                  updateEnterAnimation({
                    staggerDelay: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateEnterAnimation({
                      staggerDelay: Math.max(0, parseInt(e.currentTarget.value) || 0),
                    });
                    e.currentTarget.blur();
                  }
                }}
                className="h-7 text-xs mt-1"
              />
            </div>
          </div>
        )}
      </div>

      {/* Exit Animation Section */}
      <div className="border rounded-md overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50"
          onClick={() => setExpandedSection(expandedSection === 'exit' ? null : 'exit')}
        >
          {expandedSection === 'exit' ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <span className="font-medium">Exit Animation</span>
          <span className="text-muted-foreground ml-auto">
            {ANIMATION_TYPE_OPTIONS.find((o) => o.value === exitAnimation.type)?.label ?? 'None'}
          </span>
        </button>

        {expandedSection === 'exit' && (
          <div className="px-3 pb-3 space-y-3 border-t pt-3">
            {/* Animation Type */}
            <div>
              <Label className="text-[10px] text-muted-foreground">Type</Label>
              <select
                value={exitAnimation.type}
                onChange={(e) => updateExitAnimation({ type: e.target.value as AnimationType })}
                className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs mt-1"
              >
                <optgroup label="Basic">
                  {ANIMATION_TYPE_OPTIONS.filter((o) => o.category === 'basic').map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Spring">
                  {ANIMATION_TYPE_OPTIONS.filter((o) => o.category === 'spring').map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Advanced">
                  {ANIMATION_TYPE_OPTIONS.filter((o) => o.category === 'advanced').map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Direction (for slide animations) */}
            {needsDirection(exitAnimation.type) && (
              <div>
                <Label className="text-[10px] text-muted-foreground">Direction</Label>
                <div className="flex gap-1 mt-1">
                  {DIRECTION_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <Button
                      key={value}
                      variant={exitAnimation.direction === value ? 'secondary' : 'ghost'}
                      size="sm"
                      className={cn(
                        'h-7 w-7 p-0',
                        exitAnimation.direction === value && 'ring-1 ring-ring'
                      )}
                      onClick={() => updateExitAnimation({ direction: value })}
                      title={label}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Spring Preset */}
            {needsSpringPreset(exitAnimation.type) && (
              <div>
                <Label className="text-[10px] text-muted-foreground">Spring Feel</Label>
                <select
                  value={exitAnimation.springPreset ?? 'smooth'}
                  onChange={(e) =>
                    updateExitAnimation({ springPreset: e.target.value as SpringPreset })
                  }
                  className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs mt-1"
                >
                  {SPRING_PRESET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} - {opt.description}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Duration */}
            <div>
              <Label className="text-[10px] text-muted-foreground">Duration (frames)</Label>
              <Input
                type="number"
                min={1}
                max={120}
                defaultValue={exitAnimation.durationInFrames ?? 10}
                key={`exitDuration-${item.id}-${exitAnimation.durationInFrames}`}
                onBlur={(e) =>
                  updateExitAnimation({
                    durationInFrames: Math.max(1, parseInt(e.target.value) || 10),
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateExitAnimation({
                      durationInFrames: Math.max(1, parseInt(e.currentTarget.value) || 10),
                    });
                    e.currentTarget.blur();
                  }
                }}
                className="h-7 text-xs mt-1"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
