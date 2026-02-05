/**
 * Scene Planner Agent - Detailed Scene Design
 *
 * The Scene Planner Agent takes a high-level scene outline from the Director
 * and creates a fully detailed scene specification including:
 * - Exact element positions and sizes
 * - Animation keyframes and timing
 * - Text content and styling
 * - Component display configuration
 * - Cursor movements and interactions (for tutorials)
 * - Narration scripts (if voiceover enabled)
 *
 * Inspired by MovieAgent's shot-level planning and UniVA's detail-oriented approach.
 */

import { Type } from '@google/genai';
import { getAIClient } from '../client';
import type {
  VideoPlan,
  SceneOutline,
  DetailedScene,
  SceneText,
  SceneShape,
  SceneCursor,
  SceneKeyframe,
  AgentContext,
  ComponentInfo,
  ProgressCallback,
} from './types';

const SCENE_PLANNER_SYSTEM_PROMPT = `You are an expert Motion Graphics Designer creating professional video compositions.

Your job is to create visually polished scenes that look like professional motion graphics from a studio.

## Visual Design System

### Canvas & Colors
- **Background:** BLACK (#000000) - all content sits on black
- **Primary text:** WHITE (#ffffff) - ONLY on black areas, not over components!
- **Components:** Have LIGHT/WHITE backgrounds - never place white text over them
- **Accent Palette (use 2-3 max):**
  - Indigo: #6366f1 (professional, tech)
  - Purple: #8b5cf6 (creative, premium)
  - Cyan: #06b6d4 (modern, fresh)
  - Amber: #f59e0b (attention, CTA)
  - Green: #10b981 (success, growth)

### Typography Scale (Golden Ratio: 1.618)

Use this scale for professional hierarchy:

| Role | Font Size | Weight | Color | Letter Spacing |
|------|-----------|--------|-------|----------------|
| **title** | 56-68px | 700 | #ffffff | 1-2px |
| **subtitle** | 28-36px | 500 | #a1a1aa | 0.5px |
| **label** | 16-20px | 600 | accent | 1px (uppercase) |
| **description** | 20-24px | 400 | #d4d4d8 | 0 |
| **cta** | 32-42px | 700 | #ffffff or accent | 1px |

**Positioning by Role:**
- title: y: 0.08-0.12 (top safe zone)
- subtitle: y: 0.16-0.20 (below title)
- component: y: 0.50 (center)
- description: y: 0.80-0.85 (bottom area)
- cta: y: 0.88-0.92 (bottom safe zone)

### Layout Patterns (USE THESE!)

**Pattern 1: Centered Showcase**
\`\`\`
Title:      y: 0.10, x: 0.5 (centered)
Subtitle:   y: 0.18, x: 0.5
Component:  y: 0.50, x: 0.5 (phone or laptop frame)
CTA:        y: 0.88, x: 0.5
\`\`\`

**Pattern 2: Side-by-Side**
\`\`\`
Title:      y: 0.12, x: 0.5
Component:  y: 0.50, x: 0.35 (left side)
Text/List:  y: 0.50, x: 0.72 (right side)
\`\`\`

**Pattern 3: Full-Width Feature**
\`\`\`
Title:      y: 0.08, x: 0.5
Component:  y: 0.52, x: 0.5, displaySize: "laptop"
Label:      y: 0.92, x: 0.5, backgroundColor for visibility
\`\`\`

### Coordinate System
- x: 0 = left, 0.5 = center, 1 = right
- y: 0 = top, 0.5 = center, 1 = bottom
- Keep text in SAFE ZONES: y > 0.05 and y < 0.95

## Keyframe Animation System

### ⚠️ CRITICAL: Frame values are RELATIVE, not absolute! ⚠️

**Frame 0 = the FIRST frame when the element appears. NOT the video start!**

❌ WRONG: frame: 300 (this means 300 frames AFTER the element appears - way too late!)
✅ CORRECT: frame: 0 for start, frame: 15 for entrance animation end

**Frame number guide:**
- frame: 0 → Element just appeared (start of entrance animation)
- frame: 15-30 → Typical entrance animation duration (0.5-1 second at 30fps)
- frame: 0-60 → Most animations should complete within first 2 seconds of element appearing

**Typical animation timing:**
- Entrance animations: frame 0 to frame 15-30 (fast, snappy)
- Hold/visible state: after entrance completes
- Exit animations: near element's durationInFrames (if needed)

**How keyframes work:**
1. Each keyframe specifies {frame, property values, easing}
2. System interpolates between keyframes automatically
3. Before first keyframe → first keyframe's values used
4. After last keyframe → last keyframe's values held

**Animatable Properties:**
- Position: x (0-1), y (0-1) - normalized canvas position
- Transform: scale (1=normal), rotation (degrees)
- Appearance: opacity (0-1)
- Filters: blur (0-50px), brightness (0-3, 1=normal), contrast (0-3), saturate (0-3), hueRotate (0-360°)
- Shadows: shadowBlur (0-100), shadowOffsetX/Y (-100 to 100), shadowOpacity (0-1)

**Easing options:** "linear", "ease-in", "ease-out" (default), "ease-in-out", "spring"

**CORRECT Animation Examples:**
\`\`\`
// Fade in (appears invisible, fades to visible over 15 frames)
[{frame: 0, opacity: 0}, {frame: 15, opacity: 1, easing: "ease-out"}]

// Blur reveal (starts blurry and invisible, reveals over 30 frames)
[{frame: 0, opacity: 0, blur: 20}, {frame: 30, opacity: 1, blur: 0}]

// Bounce entrance (pops in with overshoot)
[{frame: 0, scale: 0, opacity: 0}, {frame: 15, scale: 1.1, opacity: 1}, {frame: 25, scale: 1}]

// Slide from left
[{frame: 0, opacity: 0, x: 0.2}, {frame: 20, opacity: 1, x: 0.5, easing: "ease-out"}]
\`\`\`

**❌ WRONG Examples (DO NOT DO THIS):**
\`\`\`
// WRONG - frame 300 means animation happens 10 seconds after element appears!
[{frame: 0, opacity: 0}, {frame: 300, opacity: 1}]  // ❌ BAD

// CORRECT version:
[{frame: 0, opacity: 0}, {frame: 15, opacity: 1}]   // ✅ GOOD
\`\`\`

## Animation Principles (PROFESSIONAL PATTERNS)

### 1. Spring Physics by Intensity

| Intensity | Feel | Animation Pattern | Timing |
|-----------|------|-------------------|--------|
| **low** | Smooth, corporate | fade-in, blur-in | 20-30 frames |
| **medium** | Balanced, engaging | bounce, spring-pop | 25-35 frames |
| **high** | Energetic, playful | elastic, shake | 30-50 frames |

### 2. Stagger Timing (CRITICAL!)

**Never animate everything at once!** Use these stagger delays:

| Scene Type | Stagger Delay | Example |
|------------|---------------|---------|
| Intro | 10-15 frames | Title → Subtitle → Badge |
| Feature | 15-20 frames | Component → Labels → Description |
| Outro | 10 frames | CTA → Secondary text |

### 3. Easing Rules

- **Entrances:** "ease-out" or "spring" - fast start, smooth stop
- **Exits:** "ease-in" - slow start, fast end
- **Movements:** "ease-in-out" - smooth both ends
- **Emphasis:** "spring" - natural bounce

**NEVER use "linear"** - it looks robotic and amateur!

### 4. Visual Hierarchy Order

Animate elements in this order (each offset by stagger delay):
1. Title (most important, appears first)
2. Subtitle
3. Component/Main content
4. Labels/Annotations
5. Description
6. CTA (last, most actionable)

### 5. Intensity Examples

**Low (Professional/Corporate):**
\`\`\`
[{frame: 0, opacity: 0, blur: 10}, {frame: 25, opacity: 1, blur: 0, easing: "ease-out"}]
\`\`\`

**Medium (Balanced):**
\`\`\`
[{frame: 0, scale: 0.8, opacity: 0}, {frame: 20, scale: 1.05, opacity: 1}, {frame: 30, scale: 1, easing: "ease-out"}]
\`\`\`

**High (Energetic):**
\`\`\`
[{frame: 0, scale: 0, opacity: 0}, {frame: 15, scale: 1.2, opacity: 1}, {frame: 25, scale: 0.95}, {frame: 35, scale: 1, easing: "spring"}]
\`\`\`

## Component Display Modes

- **phone**: Mobile device frame, good for app UIs (containerWidth ~375)
- **laptop**: Laptop screen frame, good for dashboards (containerWidth ~1280)
- **full**: No frame, component fills designated area

## ⚠️ TRACK LAYERING (Z-INDEX MATTERS!)

**Elements render in track order - later tracks appear ON TOP of earlier tracks!**

**Correct creation order (bottom to top):**
1. **Shapes** (backgrounds, gradients, decorations) - render FIRST
2. **Components** (main content) - render on top of shapes
3. **Text** (titles, labels, descriptions) - render on top of components
4. **Cursor** (for tutorials) - render LAST (must be visible over everything)

**CRITICAL:**
- ❌ If you add a shape AFTER a component, the shape will COVER the component!
- ✅ Always add background shapes BEFORE components
- ✅ Cursor should always be the LAST element added

**Example layering for a scene:**
\`\`\`
1. Add gradient shape (background) - offsetFrames: 0
2. Add component (main content) - offsetFrames: 0
3. Add title text (top) - offsetFrames: 5
4. Add subtitle text - offsetFrames: 15
5. Add cursor (if tutorial) - offsetFrames: 30
\`\`\`

## Text Roles

- **title**: Large, prominent (32-64px), appears early, WHITE on black background
- **subtitle**: Medium, supporting (20-28px)
- **description**: Smaller body text (16-20px)
- **label**: Small annotations (12-16px), good for component callouts (use DARK text if over component)
- **cta**: Call-to-action, emphasized (24-32px), consider accent colors

## Cursor Interactions for Tutorials

### Target-based vs Coordinate Positioning

**PREFERRED: Use CSS selectors from interactiveElements!**
When a component has interactiveElements listed, use those exact selectors as targets.
The system auto-positions the cursor to the element center.

**FALLBACK: Use x/y coordinates**
When selectors don't work or aren't available, use explicit coordinates.

### Interaction Actions & Parameters

| Action | Visual Effect | Parameters | Duration Calc |
|--------|---------------|------------|---------------|
| **hover** | Highlight glow | holdDuration (default: 15 frames) | instant |
| **click** | Press animation | holdDuration (default: 8 frames) | instant |
| **focus** | Focus ring | - | until next action |
| **type** | Character typing | value, speed (default: 1 frame/char) | value.length × speed |
| **select** | Dropdown selection | value | instant |
| **check** | Checkbox toggle | - | instant |

### Typing Speed Guide

| speed | Feel | Frames for "hello@test.com" |
|-------|------|----------------------------|
| 1 | Fast/Realistic | 15 frames |
| 2 | Deliberate | 30 frames |
| 3 | Slow/Tutorial | 45 frames |

### ⚠️ CRITICAL: Calculate Cursor Durations!

**Each interaction needs enough time to complete!**

\`\`\`
// BAD: Type action at frame 90, next action at frame 100 - not enough time!
{ frame: 90, action: "type", value: "hello@example.com" }, // 17 chars × 1 = 17 frames
{ frame: 100, action: "click" }  // ❌ Only 10 frames - typing still happening!

// GOOD: Allow type action to complete
{ frame: 90, action: "type", value: "hello@example.com", speed: 1 }, // 17 frames
{ frame: 120, action: "click" }  // ✅ Typing done at frame 107, cursor moves at 108
\`\`\`

### Complete Tutorial Flow Pattern

\`\`\`
// Example: Login form tutorial (180 frames = 6 seconds at 30fps)
keyframes: [
  // 1. Cursor enters from off-screen
  { frame: 0, x: 0.85, y: 0.15 },

  // 2. Move to email field, hover to show intention (30 frames of movement)
  { frame: 30, target: "input[name='email']", action: "hover" },

  // 3. Click to focus (15 frames of hover visible)
  { frame: 45, target: "input[name='email']", action: "click", click: true },

  // 4. Type email (15 chars × 1 speed = 15 frames)
  { frame: 55, target: "input[name='email']", action: "type", value: "demo@example.com", speed: 1 },

  // 5. Move to password field (typing done at ~70, start moving at 75)
  { frame: 80, target: "input[type='password']", action: "focus" },

  // 6. Type password (8 chars × 2 speed = 16 frames - slower for emphasis)
  { frame: 90, target: "input[type='password']", action: "type", value: "********", speed: 2 },

  // 7. Move to submit (typing done at ~106, move at 115)
  { frame: 120, target: "button[type='submit']", action: "hover" },

  // 8. Click submit with visible effect
  { frame: 135, target: "button[type='submit']", action: "click", click: true, holdDuration: 15 },

  // 9. Hold for success state to register
  { frame: 170, x: 0.5, y: 0.5 }
]
\`\`\`

### Fallback Positioning (when targets don't work)

If component is centered (x: 0.5, y: 0.5) with phone display:
- Header area: y: 0.30-0.35
- First input: y: 0.40-0.45
- Second input: y: 0.50-0.55
- Submit button: y: 0.60-0.65
- Footer: y: 0.70-0.75

### Tutorial Quality Rules

1. **Start cursor off-screen** (x: 0.85, y: 0.15 - top-right corner)
2. **30-45 frames between positions** (natural movement speed)
3. **Always hover before click** (shows intention, 15-20 frames)
4. **Calculate typing duration** (chars × speed + 10 frame buffer)
5. **Complete meaningful flows** (don't stop mid-action)
6. **Type realistic values** (real emails like "demo@example.com", not "test")
7. **Show feedback** (hold 15-20 frames on success states)
8. **Use holdDuration** for emphasis on important clicks

## Narration Guidelines

- Keep sentences short and punchy
- Match the tone of the video plan
- Time narration to match visual beats
- 2-3 words per second is comfortable

## ⚠️ ANTI-PATTERNS (DON'T DO THESE!)

### Animation Mistakes
- ❌ **Frame values > 60** for entrance animations (too slow!)
- ❌ **Linear easing** everywhere (looks robotic)
- ❌ **All elements animate at once** (overwhelming)
- ❌ **No stagger delays** between elements
- ❌ **Instant state changes** without interpolation

### Visual Mistakes
- ❌ **White text over white components** (invisible!)
- ❌ **Text outside safe zones** (y < 0.05 or y > 0.95)
- ❌ **More than 4 colors** per video (chaotic)
- ❌ **Inconsistent font sizes** (use the typography scale)

### Timing Mistakes
- ❌ **Animations longer than 60 frames** for entrances
- ❌ **No pause between animations** (needs breathing room)
- ❌ **Exit animations start too early** (element disappears too fast)

## ✅ PROFESSIONAL CHECKLIST

Before generating, verify:
1. [ ] Title uses fontSize 56-68px, fontWeight 700
2. [ ] Stagger delays between ALL elements (10-20 frames)
3. [ ] Easing is "ease-out" or "spring" (not linear!)
4. [ ] Animation frames are 0-30 for entrances (not 0-300!)
5. [ ] Text positioned in safe zones (y: 0.05-0.95)
6. [ ] Component has device frame (phone/laptop)
7. [ ] White text only on black canvas areas

## Output Format

Call the create_detailed_scene function with your complete scene specification.`;

const DETAILED_SCENE_TOOL = {
  name: 'create_detailed_scene',
  description: 'Create a detailed scene specification with all elements',
  parameters: {
    type: Type.OBJECT,
    properties: {
      // Component configuration
      component: {
        type: Type.OBJECT,
        properties: {
          displaySize: {
            type: Type.STRING,
            enum: ['phone', 'laptop', 'full'],
          },
          containerWidth: { type: Type.NUMBER },
          containerHeight: { type: Type.NUMBER },
          objectPosition: { type: Type.STRING },
          props: { type: Type.OBJECT },
          keyframes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                frame: { type: Type.NUMBER, description: 'Frame relative to element start (0 = when element appears)' },
                opacity: { type: Type.NUMBER, description: 'Opacity 0-1' },
                scale: { type: Type.NUMBER, description: 'Scale factor' },
                x: { type: Type.NUMBER, description: 'X position 0-1' },
                y: { type: Type.NUMBER, description: 'Y position 0-1' },
                rotation: { type: Type.NUMBER, description: 'Rotation in degrees' },
                easing: { type: Type.STRING, description: 'Easing function' },
              },
              required: ['frame'],
            },
          },
        },
        required: ['displaySize'],
      },

      // Text overlays
      texts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            role: {
              type: Type.STRING,
              enum: ['title', 'subtitle', 'description', 'label', 'cta'],
            },
            fontSize: { type: Type.NUMBER },
            fontWeight: { type: Type.NUMBER },
            color: { type: Type.STRING },
            backgroundColor: { type: Type.STRING },
            position: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
              },
              required: ['x', 'y'],
            },
            offsetFrames: { type: Type.NUMBER, description: 'Frames after scene start' },
            durationInFrames: { type: Type.NUMBER },
            keyframes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  frame: { type: Type.NUMBER, description: 'Frame relative to element start (0 = when element appears)' },
                  opacity: { type: Type.NUMBER, description: 'Opacity 0-1' },
                  scale: { type: Type.NUMBER, description: 'Scale factor' },
                  x: { type: Type.NUMBER, description: 'X position 0-1' },
                  y: { type: Type.NUMBER, description: 'Y position 0-1' },
                  rotation: { type: Type.NUMBER, description: 'Rotation in degrees' },
                  easing: { type: Type.STRING, description: 'Easing function' },
                },
                required: ['frame'],
              },
            },
            letterSpacing: { type: Type.NUMBER },
            lineHeight: { type: Type.NUMBER },
            textAlign: { type: Type.STRING, enum: ['left', 'center', 'right'] },
          },
          required: ['text', 'role', 'fontSize', 'color', 'position', 'offsetFrames'],
        },
      },

      // Shape elements
      shapes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            shapeType: {
              type: Type.STRING,
              enum: ['rectangle', 'circle', 'gradient', 'line', 'badge', 'svg'],
            },
            width: { type: Type.NUMBER },
            height: { type: Type.NUMBER },
            position: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
              },
            },
            fill: { type: Type.STRING },
            stroke: { type: Type.STRING },
            strokeWidth: { type: Type.NUMBER },
            borderRadius: { type: Type.NUMBER },
            opacity: { type: Type.NUMBER },
            gradientFrom: { type: Type.STRING },
            gradientTo: { type: Type.STRING },
            gradientDirection: { type: Type.NUMBER },
            text: { type: Type.STRING },
            fontSize: { type: Type.NUMBER },
            color: { type: Type.STRING },
            offsetFrames: { type: Type.NUMBER },
            durationInFrames: { type: Type.NUMBER },
            keyframes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  frame: { type: Type.NUMBER, description: 'Frame relative to element start (0 = when element appears)' },
                  opacity: { type: Type.NUMBER, description: 'Opacity 0-1' },
                  scale: { type: Type.NUMBER, description: 'Scale factor' },
                  x: { type: Type.NUMBER, description: 'X position 0-1' },
                  y: { type: Type.NUMBER, description: 'Y position 0-1' },
                  rotation: { type: Type.NUMBER, description: 'Rotation in degrees' },
                  easing: { type: Type.STRING, description: 'Easing function' },
                },
                required: ['frame'],
              },
            },
          },
          required: ['shapeType', 'width', 'height', 'position', 'offsetFrames'],
        },
      },

      // Cursor for tutorials
      cursor: {
        type: Type.OBJECT,
        properties: {
          cursorStyle: {
            type: Type.STRING,
            enum: ['default', 'pointer', 'hand'],
          },
          clickEffect: {
            type: Type.STRING,
            enum: ['ripple', 'highlight', 'none'],
          },
          keyframes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                frame: { type: Type.NUMBER, description: 'Frame relative to cursor start (0 = when cursor appears)' },
                target: { type: Type.STRING, description: 'CSS selector for target element (PREFERRED - use interactiveElements selectors)' },
                x: { type: Type.NUMBER, description: 'Fallback x position (0-1) if target not found' },
                y: { type: Type.NUMBER, description: 'Fallback y position (0-1) if target not found' },
                click: { type: Type.BOOLEAN, description: 'Show visual click effect at this position' },
                action: {
                  type: Type.STRING,
                  enum: ['click', 'hover', 'focus', 'type', 'select', 'check'],
                  description: 'Interaction to perform on target element',
                },
                value: { type: Type.STRING, description: 'For type: text to type. For select: option value.' },
                speed: { type: Type.NUMBER, description: 'For type: frames per character (1=fast, 2=deliberate, 3=slow). Default: 1' },
                holdDuration: { type: Type.NUMBER, description: 'Frames to hold visual effect (click: default 8, hover: default 15)' },
              },
              required: ['frame'],
            },
          },
        },
        required: ['cursorStyle', 'clickEffect', 'keyframes'],
      },

      // Narration script
      narrationScript: {
        type: Type.STRING,
        description: 'Voiceover script for this scene (if voiceover enabled)',
      },
    },
    required: ['texts', 'shapes'],
  },
};

function buildScenePlannerPrompt(
  scene: SceneOutline,
  videoPlan: VideoPlan,
  context: AgentContext,
  sceneStartFrame: number
): string {
  const component = scene.componentId
    ? context.components.find((c) => c.id === scene.componentId)
    : context.components.find(
        (c) => c.name.toLowerCase() === scene.componentName?.toLowerCase()
      );

  const componentInfo = component
    ? `
## Component to Feature
- Name: ${component.name}
- Category: ${component.category}
- Description: ${component.description || 'No description'}
- Props: ${component.props.join(', ') || 'None'}
- Demo Props: ${JSON.stringify(component.demoProps || {}, null, 2)}

### Interactive Elements (USE THESE FOR CURSOR TARGETING!)
${component.interactiveElements || 'None identified - use fallback x/y positioning'}

### Component Relationships
${component.usesComponents?.length ? `- Uses: [${component.usesComponents.join(', ')}]` : ''}
${component.usedByComponents?.length ? `- Used by: [${component.usedByComponents.join(', ')}]` : ''}
${component.relatedComponents?.length ? `- Related: [${component.relatedComponents.join(', ')}]` : ''}

**REMEMBER:** This component likely has a WHITE/LIGHT background. If placing text over it:
- Use DARK text color (#1a1a2e) OR add backgroundColor to text ("rgba(0,0,0,0.7)")
- Better yet: position text beside/below the component on the black canvas
`
    : '';

  return `## Video Context
- Title: "${videoPlan.title}"
- Tone: ${videoPlan.tone}
- Style: ${videoPlan.style}
- Target Audience: ${videoPlan.audience}
- Core Message: ${videoPlan.coreMessage}

## Scene to Detail
- Scene ID: ${scene.id}
- Type: ${scene.type}
- Purpose: ${scene.purpose}
- Start Frame: ${sceneStartFrame}
- Duration: ${scene.durationInFrames} frames (${(scene.durationInFrames / context.composition.fps).toFixed(1)}s)
- Animation Intensity: ${scene.animationIntensity}

## Key Points to Communicate
${scene.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

${scene.interactionGoals ? `## Interaction Goals (Tutorial)
${scene.interactionGoals.map((g, i) => `${i + 1}. ${g}`).join('\n')}` : ''}

${componentInfo}

## Composition Dimensions
- Width: ${context.composition.width}px
- Height: ${context.composition.height}px
- FPS: ${context.composition.fps}

## Voiceover
${context.includeVoiceover ? 'Enabled - Write a narration script that matches the scene duration and key points.' : 'Disabled - No narration needed.'}

## Your Task
Create a detailed scene specification that:
1. Positions elements to create visual hierarchy and flow
2. Uses animations matching the "${scene.animationIntensity}" intensity level
3. Communicates all key points effectively
4. ${scene.type === 'tutorial' ? 'Creates realistic cursor interactions demonstrating the component' : 'Showcases the component attractively'}
5. Maintains the ${videoPlan.tone} tone and ${videoPlan.style} style

Remember:
- Positions are 0-1 normalized coordinates
- Keyframe frame values are relative to element start (0 = when element appears after offsetFrames)
- Stagger element entrances for visual interest
- Use easing functions for smooth animations

Call create_detailed_scene with your complete specification.`;
}

export async function runScenePlannerAgent(
  scene: SceneOutline,
  videoPlan: VideoPlan,
  context: AgentContext,
  sceneStartFrame: number,
  onProgress?: ProgressCallback
): Promise<DetailedScene> {
  onProgress?.(
    `🎨 Scene Planner: Designing "${scene.type}" scene - ${scene.purpose.slice(0, 50)}...`
  );

  const client = getAIClient();

  const prompt = buildScenePlannerPrompt(scene, videoPlan, context, sceneStartFrame);

  const response = await client.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    config: {
      systemInstruction: SCENE_PLANNER_SYSTEM_PROMPT,
      tools: [{ functionDeclarations: [DETAILED_SCENE_TOOL] }],
      temperature: 0.7,
    },
  });

  // Extract function call from response
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  for (const part of parts) {
    if (part.functionCall && part.functionCall.name === 'create_detailed_scene') {
      const args = part.functionCall.args as Record<string, unknown>;

      // Find the component for this scene
      const component = scene.componentId
        ? context.components.find((c) => c.id === scene.componentId)
        : context.components.find(
            (c) => c.name.toLowerCase() === scene.componentName?.toLowerCase()
          );

      // Build the detailed scene
      const detailedScene: DetailedScene = {
        sceneId: scene.id,
        from: sceneStartFrame,
        durationInFrames: scene.durationInFrames,
        texts: (args.texts as SceneText[]) || [],
        shapes: (args.shapes as SceneShape[]) || [],
        narrationScript: args.narrationScript as string | undefined,
      };

      // Add component config if present
      if (component && args.component) {
        const compConfig = args.component as {
          displaySize: string;
          containerWidth?: number;
          containerHeight?: number;
          objectPosition?: string;
          props?: Record<string, unknown>;
          keyframes?: SceneKeyframe[];
        };

        detailedScene.component = {
          componentId: component.id,
          displaySize: compConfig.displaySize as 'phone' | 'laptop' | 'full',
          containerWidth: compConfig.containerWidth,
          containerHeight: compConfig.containerHeight,
          objectPosition: compConfig.objectPosition,
          props: compConfig.props,
          keyframes: compConfig.keyframes,
        };
      }

      // Add cursor config if present (for tutorials)
      if (args.cursor) {
        detailedScene.cursor = args.cursor as SceneCursor;
      }

      onProgress?.(
        `✅ Scene Planner: Completed "${scene.id}" with ${detailedScene.texts.length} texts, ${detailedScene.shapes.length} shapes`
      );

      return detailedScene;
    }
  }

  // Fallback with minimal scene
  console.warn(`Scene Planner failed to create detailed scene for ${scene.id}, using fallback`);
  return {
    sceneId: scene.id,
    from: sceneStartFrame,
    durationInFrames: scene.durationInFrames,
    texts: [
      {
        text: scene.purpose,
        role: 'title',
        fontSize: 48,
        color: '#ffffff',
        position: { x: 0.5, y: 0.5 },
        offsetFrames: 0,
        textAlign: 'center',
      },
    ],
    shapes: [],
  };
}

/**
 * Plan all scenes in parallel for efficiency.
 */
export async function planAllScenes(
  videoPlan: VideoPlan,
  context: AgentContext,
  onProgress?: ProgressCallback
): Promise<DetailedScene[]> {
  onProgress?.(`🎨 Scene Planner: Planning ${videoPlan.scenes.length} scenes in parallel...`);

  // Calculate start frames for each scene
  let currentFrame = 0;
  const sceneStarts: number[] = [];
  for (const scene of videoPlan.scenes) {
    sceneStarts.push(currentFrame);
    currentFrame += scene.durationInFrames;
  }

  // Plan all scenes in parallel
  const detailedScenes = await Promise.all(
    videoPlan.scenes.map((scene, index) =>
      runScenePlannerAgent(scene, videoPlan, context, sceneStarts[index], onProgress)
    )
  );

  onProgress?.(`✅ Scene Planner: All ${detailedScenes.length} scenes planned`);

  return detailedScenes;
}
