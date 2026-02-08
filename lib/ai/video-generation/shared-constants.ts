/**
 * Shared Constants for Video Generation Agents
 *
 * Single source of truth for glossary, design tokens, and spring configs.
 * All agents reference these constants to ensure consistency and avoid duplication.
 */

// =============================================================================
// GLOSSARY - Shared terminology across all agents
// =============================================================================

export const GLOSSARY = `## GLOSSARY

| Term | Definition |
|------|------------|
| **Frame** | Single image at 30fps. 1 second = 30 frames. All timing uses frames, not seconds. |
| **Scene** | A discrete narrative segment with a single purpose (intro, feature, outro). Contains multiple elements. |
| **Track** | A layer in the composition. Later tracks render on top. Order: shapes → components → text → cursor. |
| **Element** | Any visual item: text, shape, component, cursor. Each has position, timing, and animation. |
| **Keyframe** | A point in time defining element state. Frame values are RELATIVE to element start (0 = when element appears). |
| **Stagger** | Delay between element entrances. Creates visual rhythm. Typical: 10-20 frames between elements. |
| **Spring** | Physics-based animation with damping/stiffness. Produces natural motion with overshoot. |
| **Device Frame** | Visual container (phone/laptop) that holds UI components for realistic presentation. |
| **Safe Zone** | Area 60px from canvas edges where text should not be placed. |
| **Intent** | High-level animation goal (e.g., "dramatic", "subtle") vs. specific animation type. |`;

// =============================================================================
// DESIGN TOKENS - Colors, typography, canvas dimensions
// =============================================================================

export const DESIGN_TOKENS = `## DESIGN TOKENS

### Canvas
- Resolution: 1920x1080
- Center: x=960, y=540 (normalized: x=0.5, y=0.5)
- Safe zone: 60px inset (content: x=60-1860, y=60-1020)
- Background: #000000 (BLACK - all content on black)

### Color Palette (max 3-4 per video)
| Name | Hex | Use |
|------|-----|-----|
| Indigo | #6366f1 | Professional, tech |
| Purple | #8b5cf6 | Creative, premium |
| Cyan | #06b6d4 | Modern, fresh |
| Amber | #f59e0b | Attention, CTA |
| Green | #10b981 | Success, growth |
| White | #ffffff | Primary text (on black only) |
| Gray | #a1a1aa | Subtitle text |

### Typography Scale (30fps timing)
| Role | Size | Weight | Position Y | Entrance Frames |
|------|------|--------|------------|-----------------|
| title | 56-68px | 700 | 0.08-0.12 | 0→20 |
| subtitle | 28-36px | 500 | 0.16-0.20 | 10→30 |
| label | 16-20px | 600 | varies | 20→40 |
| description | 20-24px | 400 | 0.80-0.85 | 25→45 |
| cta | 32-42px | 700 | 0.88-0.92 | 30→50 |

### Layer Order (z-index)
| Layer | Track Type | Description |
|-------|------------|-------------|
| 0 | background | Gradients, solid fills |
| 1 | shapes | Decorative rectangles, circles |
| 2 | device-frames | Phone/laptop containers |
| 3 | components | React UI components |
| 4 | text | All text overlays |
| 5 | cursor | Tutorial cursor (always on top) |`;

// =============================================================================
// SPRING CONFIGS - Actual Remotion spring() parameter values
// =============================================================================

export const SPRING_CONFIGS = `## SPRING PHYSICS CONFIGS

All animations use spring physics. These are the ACTUAL Remotion spring() values:

| Preset | damping | stiffness | mass | Feel | Best For |
|--------|---------|-----------|------|------|----------|
| smooth | 200 | 100 | 1 | Controlled, professional | Default for most elements |
| snappy | 200 | 200 | 0.5 | Quick, responsive | UI elements, labels, buttons |
| heavy | 200 | 80 | 5 | Slow, deliberate | Hero reveals, zoom outs |
| bouncy | 100 | 150 | 1 | Playful with overshoot | CTAs, celebrations, playful tone |
| gentle | 300 | 60 | 2 | Soft, subtle | Background elements, fades |

### Animation Types
| Type | Description | Spring Preset |
|------|-------------|---------------|
| spring-scale | Pop-in with physics (signature look) | smooth/bouncy |
| spring-slide | Slide with overshoot | smooth/snappy |
| spring-bounce | Bouncy scale | bouncy |
| fade | Opacity only | gentle |
| zoom-blur | Zoom + motion blur | heavy |
| flip | 3D card flip | smooth |

### Timing Rules (30fps)
- Minimum element duration: 90 frames (3 seconds) for readability
- Entrance animation: 15-30 frames
- Stagger between elements: 10-20 frames
- Scene transition: 15-30 frames
- Never use linear easing (looks robotic)`;

// =============================================================================
// FRAME BUDGET - Duration allocation formulas
// =============================================================================

export const FRAME_BUDGET = `## FRAME BUDGET ALLOCATION

Formula: totalFrames = durationSeconds * 30

### Standard Narrative Structure
| Section | % of Total | 10s Video | 15s Video | 30s Video |
|---------|------------|-----------|-----------|-----------|
| Hook | 15% | 45f | 67f | 135f |
| Setup/Problem | 15% | 45f | 67f | 135f |
| Showcase | 55% | 165f | 248f | 495f |
| CTA | 15% | 45f | 68f | 135f |

### Minimum Durations
- Scene: 90 frames (3s) minimum for comprehension
- Element on screen: 60 frames (2s) minimum for readability
- Component showcase: 120 frames (4s) minimum
- Tutorial interaction: 45 frames (1.5s) per action`;

// =============================================================================
// Combined prompt sections for easy interpolation
// =============================================================================

export const SHARED_AGENT_CONTEXT = `${GLOSSARY}

${DESIGN_TOKENS}

${SPRING_CONFIGS}`;

// TypeScript types for type safety
export interface SpringConfig {
  damping: number;
  stiffness: number;
  mass: number;
}

export const SPRING_PRESETS: Record<string, SpringConfig> = {
  smooth: { damping: 200, stiffness: 100, mass: 1 },
  snappy: { damping: 200, stiffness: 200, mass: 0.5 },
  heavy: { damping: 200, stiffness: 80, mass: 5 },
  bouncy: { damping: 100, stiffness: 150, mass: 1 },
  gentle: { damping: 300, stiffness: 60, mass: 2 },
} as const;

export const ACCENT_COLORS = {
  indigo: '#6366f1',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  amber: '#f59e0b',
  green: '#10b981',
} as const;

export const CANVAS = {
  width: 1920,
  height: 1080,
  fps: 30,
  centerX: 960,
  centerY: 540,
  safeZone: 60,
} as const;

export const LAYER_ORDER = {
  background: 0,
  shapes: 1,
  deviceFrames: 2,
  components: 3,
  text: 4,
  cursor: 5,
} as const;
