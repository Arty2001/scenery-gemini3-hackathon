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
import { GLOSSARY, DESIGN_TOKENS, SPRING_CONFIGS } from './shared-constants';
import { getAIClient } from '../client';
import { DEFAULT_MODEL } from '../models';
import type {
  VideoPlan,
  SceneOutline,
  DetailedScene,
  SceneText,
  SceneShape,
  SceneImage,
  SceneCursor,
  SceneKeyframe,
  AgentContext,
  ComponentInfo,
  ProgressCallback,
} from './types';

/**
 * Scene Planner System Prompt
 *
 * Translates Director's scene intents into concrete element positions, animations, and timing.
 * Owns the visual implementation details that Director abstracts away.
 */
const SCENE_PLANNER_SYSTEM_PROMPT = `## ROLE
You are a Motion Graphics Designer. You translate scene intents into precise element positions, animations, and timing.

## RULE #1: FRAME VALUES ARE RELATIVE (READ THIS FIRST!)

**frame: 0 = when THIS element appears, NOT the video start!**

\`\`\`
❌ WRONG: [{frame: 0, opacity: 0}, {frame: 300, opacity: 1}]  // 10 seconds to fade in!
✅ RIGHT: [{frame: 0, opacity: 0}, {frame: 20, opacity: 1}]   // 0.67 seconds to fade in
\`\`\`

Entrance animations: frame 0 → frame 15-30 (max 60 frames)

${GLOSSARY}

## CORE RULES (in priority order)

1. **KEYFRAMES START AT FRAME 0** — Always. The element's offsetFrames handles video timing.

2. **LAYER ORDER IS NUMBERED** — Add elements in this order:
   | Layer | Type | Description |
   |-------|------|-------------|
   | 0 | background | Gradients, solid fills |
   | 1 | shapes | Decorative rectangles, circles |
   | 2 | device-frames | Phone/laptop containers |
   | 3 | components | React UI components |
   | 4 | text | All text overlays |
   | 5 | cursor | Tutorial cursor (always last) |

3. **SAFE ZONES** — Keep elements 60px from edges (normalized: 0.03-0.97 for x, 0.055-0.945 for y)

4. **CANVAS MATH** — 1920×1080 grid:
   - Center: x=0.5, y=0.5 (pixel: 960, 540)
   - Left third: x=0.33 | Right third: x=0.67
   - Top quarter: y=0.25 | Bottom quarter: y=0.75

5. **STAGGER EVERYTHING** — Elements animate 10-20 frames apart, never simultaneously.

6. **SPRING ANIMATIONS ONLY** — Use spring-scale, spring-slide, spring-bounce. Never plain "scale" or "slide".

7. **TEXT ON BLACK ONLY** — Components have light backgrounds. Text goes on black canvas areas.

8. **90-FRAME MINIMUM** — Elements need 90+ frames on screen for readability.

9. **COMPLETE CURSOR FLOWS** — Tutorials show full user journeys: hover → click → type → submit.

10. **MATCH DIRECTOR INTENT** — Use intent.entrance/mood/energy to select animations:
    - dramatic + professional → spring-bounce + smooth
    - subtle + professional → spring-scale + smooth
    - energetic + playful → spring-bounce + bouncy

${DESIGN_TOKENS}

${SPRING_CONFIGS}

## SPRING CONFIGS (Actual Remotion Values)

Copy these EXACTLY into enterAnimation/exitAnimation:

\`\`\`typescript
// Smooth: professional, controlled
{ type: "spring-scale", springPreset: "smooth" }
// Remotion: spring({ damping: 200, stiffness: 100, mass: 1 })

// Snappy: quick, responsive
{ type: "spring-scale", springPreset: "snappy" }
// Remotion: spring({ damping: 200, stiffness: 200, mass: 0.5 })

// Heavy: slow, dramatic
{ type: "spring-scale", springPreset: "heavy" }
// Remotion: spring({ damping: 200, stiffness: 80, mass: 5 })

// Bouncy: playful, overshoot
{ type: "spring-bounce", springPreset: "bouncy" }
// Remotion: spring({ damping: 100, stiffness: 150, mass: 1 })

// Gentle: soft, subtle
{ type: "fade", springPreset: "gentle" }
// Remotion: spring({ damping: 300, stiffness: 60, mass: 2 })
\`\`\`

## LAYOUT PATTERNS

**Centered Showcase (phone component):**
\`\`\`
Title:     x: 0.5, y: 0.10  | staggerDelay: 0
Subtitle:  x: 0.5, y: 0.18  | staggerDelay: 12
Component: x: 0.5, y: 0.50  | staggerDelay: 20, displaySize: "phone"
CTA:       x: 0.5, y: 0.88  | staggerDelay: 35
\`\`\`

**Full-Width Feature (laptop component):**
\`\`\`
Title:     x: 0.5, y: 0.08  | staggerDelay: 0
Component: x: 0.5, y: 0.52  | staggerDelay: 15, displaySize: "laptop"
Label:     x: 0.5, y: 0.92  | staggerDelay: 30, backgroundColor: "rgba(0,0,0,0.7)"
\`\`\`

## CURSOR SELECTORS (Use from interactiveElements)

\`\`\`typescript
// PREFERRED: Use exact selectors from component.interactiveElements
{ frame: 30, target: "button[data-testid='submit']", action: "click" }
{ frame: 60, target: "input[name='email']", action: "type", value: "demo@example.com" }

// FALLBACK: Use coordinates if selectors unavailable
{ frame: 30, x: 0.5, y: 0.6, action: "click" }
\`\`\`

Common selectors:
- Buttons: \`button[type='submit']\`, \`button.primary\`, \`[role='button']\`
- Inputs: \`input[name='email']\`, \`input[type='password']\`
- Links: \`a[href]\`, \`nav a\`

## OUTPUT FORMAT

\`\`\`typescript
interface DetailedScene {
  sceneId: string;
  component?: {
    displaySize: "phone" | "laptop" | "full";
    enterAnimation: { type: string; springPreset: string; staggerDelay: number };
  };
  texts: Array<{
    text: string;
    role: "title" | "subtitle" | "label" | "description" | "cta";
    fontSize: number;
    fontWeight: number;
    color: string;
    position: { x: number; y: number };  // 0-1 normalized
    offsetFrames: number;
    enterAnimation: { type: string; springPreset: string; staggerDelay: number };
  }>;
  shapes: Array<{...}>;
  cursor?: { keyframes: Array<{frame, target?, x?, y?, action?}> };
}
\`\`\`

## FEW-SHOT EXAMPLE

**Input:** Hero scene with title "Build Fast", subtitle "Ship Faster", laptop component

**Output:**
\`\`\`json
{
  "component": {
    "displaySize": "laptop",
    "enterAnimation": { "type": "spring-scale", "springPreset": "smooth", "staggerDelay": 20 }
  },
  "texts": [
    {
      "text": "Build Fast",
      "role": "title",
      "fontSize": 64,
      "fontWeight": 700,
      "color": "#ffffff",
      "position": { "x": 0.5, "y": 0.10 },
      "offsetFrames": 0,
      "enterAnimation": { "type": "spring-scale", "springPreset": "bouncy", "staggerDelay": 0 }
    },
    {
      "text": "Ship Faster",
      "role": "subtitle",
      "fontSize": 32,
      "fontWeight": 500,
      "color": "#a1a1aa",
      "position": { "x": 0.5, "y": 0.18 },
      "offsetFrames": 0,
      "enterAnimation": { "type": "spring-slide", "springPreset": "smooth", "staggerDelay": 12 }
    }
  ],
  "shapes": [
    {
      "shapeType": "gradient",
      "position": { "x": 0.5, "y": 0.5 },
      "width": 1920,
      "height": 1080,
      "gradientFrom": "#1e1b4b",
      "gradientTo": "#000000",
      "offsetFrames": 0
    }
  ]
}
\`\`\`

## ANTI-PATTERNS

| Problem | Fix |
|---------|-----|
| frame: 300 in keyframes | Use frame: 0-30 for entrances |
| type: "scale" or "slide" | Use "spring-scale" or "spring-slide" |
| No staggerDelay | Add 10-20 frame gaps between elements |
| Text at y: 0.5 over component | Move text to y: 0.10 (above) or y: 0.88 (below) |
| White text over white component | Add backgroundColor: "rgba(0,0,0,0.7)" or reposition |

Call create_detailed_scene with your complete specification.`;

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
          enterAnimation: {
            type: Type.OBJECT,
            description: 'Enter animation config (spring-based)',
            properties: {
              type: {
                type: Type.STRING,
                enum: ['none', 'fade', 'slide', 'scale', 'spring-scale', 'spring-slide', 'spring-bounce', 'flip', 'zoom-blur'],
                description: 'Animation type (prefer spring-scale for professional look)',
              },
              direction: { type: Type.STRING, enum: ['left', 'right', 'top', 'bottom'] },
              springPreset: {
                type: Type.STRING,
                enum: ['smooth', 'snappy', 'heavy', 'bouncy', 'gentle'],
                description: 'Spring physics preset (default: smooth)',
              },
              staggerDelay: { type: Type.NUMBER, description: 'Frames to delay start for stagger effect' },
            },
          },
          exitAnimation: {
            type: Type.OBJECT,
            description: 'Exit animation config',
            properties: {
              type: {
                type: Type.STRING,
                enum: ['none', 'fade', 'slide', 'scale', 'spring-scale', 'spring-slide', 'spring-bounce', 'flip', 'zoom-blur'],
              },
              direction: { type: Type.STRING, enum: ['left', 'right', 'top', 'bottom'] },
              springPreset: { type: Type.STRING, enum: ['smooth', 'snappy', 'heavy', 'bouncy', 'gentle'] },
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
            enterAnimation: {
              type: Type.OBJECT,
              description: 'Enter animation config (spring-based)',
              properties: {
                type: {
                  type: Type.STRING,
                  enum: ['none', 'fade', 'slide', 'scale', 'spring-scale', 'spring-slide', 'spring-bounce', 'flip', 'zoom-blur'],
                  description: 'Animation type (prefer spring-scale for professional look)',
                },
                direction: { type: Type.STRING, enum: ['left', 'right', 'top', 'bottom'] },
                springPreset: {
                  type: Type.STRING,
                  enum: ['smooth', 'snappy', 'heavy', 'bouncy', 'gentle'],
                  description: 'Spring physics preset (default: smooth)',
                },
                staggerDelay: { type: Type.NUMBER, description: 'Frames to delay start for stagger effect' },
              },
            },
            exitAnimation: {
              type: Type.OBJECT,
              description: 'Exit animation config',
              properties: {
                type: {
                  type: Type.STRING,
                  enum: ['none', 'fade', 'slide', 'scale', 'spring-scale', 'spring-slide', 'spring-bounce', 'flip', 'zoom-blur'],
                },
                direction: { type: Type.STRING, enum: ['left', 'right', 'top', 'bottom'] },
                springPreset: { type: Type.STRING, enum: ['smooth', 'snappy', 'heavy', 'bouncy', 'gentle'] },
              },
            },
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

      // Image elements (logos, icons, screenshots)
      images: {
        type: Type.ARRAY,
        description: 'External images like logos, icons, or screenshots. Use for branding, tool icons, or visual assets.',
        items: {
          type: Type.OBJECT,
          properties: {
            src: {
              type: Type.STRING,
              description: 'Image URL or path. For logos, suggest using the project\'s uploaded assets.',
            },
            alt: {
              type: Type.STRING,
              description: 'Alt text description for accessibility',
            },
            position: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER, description: 'X position 0-1' },
                y: { type: Type.NUMBER, description: 'Y position 0-1' },
              },
              required: ['x', 'y'],
            },
            width: { type: Type.NUMBER, description: 'Width as fraction of canvas (0-1)' },
            height: { type: Type.NUMBER, description: 'Height as fraction of canvas (0-1)' },
            clipShape: {
              type: Type.STRING,
              enum: ['none', 'circle', 'rounded-rect', 'hexagon', 'diamond'],
              description: 'Clip shape for the image',
            },
            offsetFrames: { type: Type.NUMBER, description: 'Frames after scene start' },
            durationInFrames: { type: Type.NUMBER, description: 'Duration in frames' },
            keyframes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  frame: { type: Type.NUMBER, description: 'Frame relative to element start' },
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
            enterAnimation: {
              type: Type.OBJECT,
              description: 'Enter animation config',
              properties: {
                type: {
                  type: Type.STRING,
                  enum: ['none', 'fade', 'spring-scale', 'spring-slide', 'spring-bounce', 'flip', 'zoom-blur'],
                },
                direction: { type: Type.STRING, enum: ['left', 'right', 'top', 'bottom'] },
                springPreset: { type: Type.STRING, enum: ['smooth', 'snappy', 'heavy', 'bouncy', 'gentle'] },
                staggerDelay: { type: Type.NUMBER, description: 'Frames to delay start for stagger effect' },
              },
            },
            exitAnimation: {
              type: Type.OBJECT,
              description: 'Exit animation config',
              properties: {
                type: {
                  type: Type.STRING,
                  enum: ['none', 'fade', 'spring-scale', 'spring-slide', 'zoom-blur'],
                },
                direction: { type: Type.STRING, enum: ['left', 'right', 'top', 'bottom'] },
                springPreset: { type: Type.STRING, enum: ['smooth', 'snappy', 'heavy', 'bouncy', 'gentle'] },
              },
            },
          },
          required: ['src', 'position', 'width', 'height', 'offsetFrames'],
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

${context.availableAssets?.length ? `## Available Assets (Images/Media)
Use these uploaded images in your scene by referencing their URLs:
${context.availableAssets.filter(a => a.type === 'image').map(a => `- **${a.name}**: ${a.url}`).join('\n') || 'No images available'}

To add an image, include it in the "images" array with the exact URL from above.
` : ''}
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
    model: context.modelId || DEFAULT_MODEL,
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

      // Ensure durationInFrames is a number (AI sometimes returns nested objects)
      let sceneDuration = scene.durationInFrames;
      if (typeof sceneDuration !== 'number') {
        console.warn(`[Scene Planner] Scene ${scene.id} has invalid durationInFrames:`, sceneDuration);
        if (sceneDuration && typeof sceneDuration === 'object' && 'durationInFrames' in sceneDuration) {
          sceneDuration = (sceneDuration as { durationInFrames: number }).durationInFrames;
        } else {
          sceneDuration = 150; // Fallback: 5 seconds at 30fps
        }
      }

      // Build the detailed scene
      const detailedScene: DetailedScene = {
        sceneId: scene.id,
        from: sceneStartFrame,
        durationInFrames: sceneDuration,
        texts: (args.texts as SceneText[]) || [],
        shapes: (args.shapes as SceneShape[]) || [],
        images: (args.images as SceneImage[]) || undefined,
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

      const imageCount = detailedScene.images?.length || 0;
      onProgress?.(
        `✅ Scene Planner: Completed "${scene.id}" with ${detailedScene.texts.length} texts, ${detailedScene.shapes.length} shapes${imageCount > 0 ? `, ${imageCount} images` : ''}`
      );

      return detailedScene;
    }
  }

  // Fallback with minimal scene
  console.warn(`Scene Planner failed to create detailed scene for ${scene.id}, using fallback`);

  // Ensure durationInFrames is a number for fallback too
  let fallbackDuration = scene.durationInFrames;
  if (typeof fallbackDuration !== 'number') {
    console.warn(`[Scene Planner Fallback] Scene ${scene.id} has invalid durationInFrames:`, fallbackDuration);
    if (fallbackDuration && typeof fallbackDuration === 'object' && 'durationInFrames' in fallbackDuration) {
      fallbackDuration = (fallbackDuration as { durationInFrames: number }).durationInFrames;
    } else {
      fallbackDuration = 150; // Fallback: 5 seconds at 30fps
    }
  }

  return {
    sceneId: scene.id,
    from: sceneStartFrame,
    durationInFrames: fallbackDuration,
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
