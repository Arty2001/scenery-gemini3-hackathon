/**
 * Director Agent - High-Level Video Planning
 *
 * The Director Agent analyzes the user's request and available components
 * to create a structured video plan. It determines:
 * - Overall narrative arc and pacing
 * - Scene breakdown and sequencing
 * - Tone and visual style
 * - Duration allocation per scene
 *
 * Inspired by MovieAgent's hierarchical CoT planning approach.
 */

import { Type } from '@google/genai';
import { getAIClient } from '../client';
import type {
  VideoPlan,
  SceneOutline,
  AgentContext,
  ComponentInfo,
  ProgressCallback,
} from './types';

const DIRECTOR_SYSTEM_PROMPT = `You are an expert Video Director creating professional motion graphics videos.

## Your Goal
Create videos that look like they were made by a professional motion graphics studio. Every video tells a compelling story with polished visuals, precise timing, and smooth spring-based animations inspired by the Remotion Lambda trailer.

## Narrative Structure (REQUIRED!)

Every video MUST follow this proven structure:

**1. HOOK (first 2-3 seconds)**
- Bold title with attention-grabbing animation (spring-scale or spring-bounce entrance)
- One-line value proposition as subtitle
- Sets the visual tone immediately
- Animation: Use "spring-scale" with "bouncy" spring preset for high energy

**2. PROBLEM/CONTEXT (3-5 seconds)**
- Brief setup text of what this product/component solves
- Optional: show a pain point or challenge
- Animation: Use "fade" or "spring-scale" with "smooth" spring preset

**3. SHOWCASE (main content - 50-70% of video)**
- Feature the component prominently with device frame
- Show it in action with smooth animations
- For tutorials: demonstrate key interactions step-by-step
- Animation: Use "spring-scale" with "smooth" spring preset and stagger delays

**4. CALL-TO-ACTION (last 2-3 seconds)**
- Strong closing message with emphasis animation
- Clear next step for viewers
- Animation: Use "spring-bounce" or "zoom-blur" for emphasis

## Visual Design System

**Canvas:** BLACK (#000000) background - all content on black
**Components:** Have WHITE/LIGHT backgrounds - position text on black areas!
**Primary Accent Colors:**
- Indigo: #6366f1 (professional, tech)
- Purple: #8b5cf6 (creative, premium)
- Cyan: #06b6d4 (modern, fresh)
- Amber: #f59e0b (attention, energy)
- Green: #10b981 (success, growth)

**Color Harmony Rule:** Use max 3-4 colors per video for cohesion.

## Spring-Based Animation System (Remotion Trailer Inspired)

### Available Animation Types

| Type | Description | Best For |
|------|-------------|----------|
| **spring-scale** | Pop-in with spring physics (THE signature animation) | Most entrances, components, titles |
| **spring-slide** | Slide with spring overshoot | Text reveals, labels |
| **spring-bounce** | Bouncy scale with playful feel | CTAs, emphasis, celebrations |
| **flip** | 3D card flip effect | Dramatic transitions, reveals |
| **zoom-blur** | Zoom with motion blur | Dramatic entrances/exits |
| **fade** | Simple opacity transition | Subtle background elements |
| **slide** | Linear slide (less professional) | Avoid unless specifically needed |

### Spring Presets (from Remotion trailer analysis)

The Remotion trailer consistently uses damping: 200 for controlled, professional motion:

| Preset | Feel | Use For |
|--------|------|---------|
| **smooth** | Controlled, professional (damping: 200, mass: 1) | Default for most animations |
| **snappy** | Quick, responsive (damping: 200, mass: 0.5) | UI elements, labels |
| **heavy** | Slow, deliberate (damping: 200, mass: 5) | Dramatic reveals, zoom outs |
| **bouncy** | Playful with overshoot (damping: 100, mass: 1) | Celebrations, CTAs, playful tone |
| **gentle** | Soft, subtle (damping: 300, mass: 2) | Background elements |

### Animation Intensity by Tone

| Tone | Spring Preset | Animation Type | Stagger |
|------|---------------|----------------|---------|
| **professional** | smooth | spring-scale | 10-15 frames |
| **playful** | bouncy | spring-bounce | 8-12 frames |
| **technical** | snappy | spring-scale | 12-18 frames |
| **inspirational** | smooth | spring-scale, zoom-blur | 15-20 frames |

### Scene Types & Timing

| Type | Purpose | Duration | Stagger Delay |
|------|---------|----------|---------------|
| **intro** | Hook + title | 2-4s (60-120 frames) | 10-15 frames |
| **feature** | Show component | 4-8s per component | 15-20 frames |
| **tutorial** | Interactive demo | 6-12s minimum | 30-45 frames |
| **transition** | Scene connector | 0.5-1s (15-30 frames) | - |
| **outro** | CTA + closing | 2-3s (60-90 frames) | 10 frames |

### Staggered Animation Rules (CRITICAL!)
- **Never** animate all elements at once (looks amateur)
- **Always** stagger by 10-20 frames between elements
- Hierarchy order: Title → Subtitle → Component → Labels → CTA
- Each element should have staggerDelay in its animation config
- Creates visual rhythm and guides viewer attention

## Professional Pacing Guidelines

**Short videos (15-20s):**
- 2-3 scenes max
- Fast cuts, quick reveals
- 1 component focus

**Medium videos (30-45s):**
- 4-5 scenes
- Comfortable pacing
- 2-3 component showcase

**Long videos (60s+):**
- 6-8 scenes
- Room for tutorials
- Multiple features with transitions

## Quality Checklist

**DO:**
- Feature 1-3 components max (quality over quantity)
- Give each component 4-8 seconds of screen time
- Use spring-based animations (spring-scale, spring-slide, spring-bounce)
- Use staggered animations (10-15 frame delays between elements)
- Include text overlays that explain what's happening
- Make tutorials show COMPLETE user flows
- Add subtle camera movements (ken-burns, drift) for cinematic feel
- Use device frames (phone/laptop) for UI components
- End with clear call-to-action

**DON'T:**
- Rush through components (< 3 seconds each)
- Show more than 3 components in a 30s video
- Skip the intro/outro (they frame the content)
- Use linear easing (looks robotic) - use spring presets instead!
- Use basic "scale" or "slide" - use spring-scale or spring-slide instead!
- Animate everything at once (overwhelming)
- Make tutorials that don't complete a meaningful action
- Place white text over white components
- Add shapes/backgrounds AFTER components (they'll cover the component!)

**LAYERING ORDER (tracks render bottom-to-top):**
1. Background shapes → 2. Components → 3. Text → 4. Cursor

## Tutorial Quality Standards

For tutorial scenes, plan COMPLETE user journeys:

**Good tutorial flow:**
1. Show empty/initial state (0.5s)
2. Cursor enters frame smoothly (0.5s)
3. Hover over first interactive element (0.5s pause)
4. Click/interact with purpose (0.5s)
5. Wait for result/feedback (1s)
6. Move to next logical step
7. Complete the flow with visible outcome

**Example: Login Form Tutorial**
- Cursor enters from right edge → moves to "Sign In" button
- Hover effect visible → Click with ripple
- Focus email input → Type email progressively
- Tab to password → Type password
- Hover submit → Click → Show success state

## Camera Movement Suggestions

Add these for cinematic quality:
- **Intro:** Subtle zoom-in (0.05 scale) over scene duration
- **Feature:** Ken Burns (slow zoom + drift)
- **Tutorial:** Keep stable (no movement during interactions)
- **Outro:** Zoom-out or drift for closure

## Output Format

You must call the create_video_plan function with your complete plan.`;

const VIDEO_PLAN_TOOL = {
  name: 'create_video_plan',
  description: 'Create a structured video plan with scenes',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'Video title that captures the essence',
      },
      audience: {
        type: Type.STRING,
        description: 'Target audience description (e.g., "developers evaluating UI libraries")',
      },
      coreMessage: {
        type: Type.STRING,
        description: 'The main value proposition or takeaway',
      },
      tone: {
        type: Type.STRING,
        enum: ['professional', 'playful', 'technical', 'inspirational'],
        description: 'Overall tone of the video',
      },
      style: {
        type: Type.STRING,
        enum: ['minimal', 'motion-rich', 'cinematic', 'energetic'],
        description: 'Visual style approach',
      },
      scenes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: ['intro', 'feature', 'transition', 'tutorial', 'outro'],
            },
            purpose: {
              type: Type.STRING,
              description: 'What this scene accomplishes',
            },
            durationPercentage: {
              type: Type.NUMBER,
              description: 'Percentage of total duration (1-100)',
            },
            componentName: {
              type: Type.STRING,
              description: 'Component to showcase (if applicable)',
            },
            keyPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Key messages to communicate',
            },
            interactionGoals: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'For tutorials: what interactions to demonstrate',
            },
            animationIntensity: {
              type: Type.STRING,
              enum: ['low', 'medium', 'high'],
            },
          },
          required: ['type', 'purpose', 'durationPercentage', 'keyPoints', 'animationIntensity'],
        },
        description: 'Ordered list of scenes',
      },
    },
    required: ['title', 'audience', 'coreMessage', 'tone', 'style', 'scenes'],
  },
};

function buildDirectorPrompt(context: AgentContext): string {
  const { userRequest, composition, components, targetDurationSeconds } = context;

  const componentSummary = components
    .map((c) => {
      let desc = `- **${c.name}** (${c.category})`;
      if (c.description) desc += `: ${c.description}`;
      if (c.interactiveElements) desc += `\n  Interactive elements (for cursor): ${c.interactiveElements}`;
      if (c.props.length > 0) desc += `\n  Props: ${c.props.slice(0, 5).join(', ')}`;
      // Component relationships for narrative planning
      if (c.usesComponents?.length) desc += `\n  Uses: [${c.usesComponents.join(', ')}]`;
      if (c.usedByComponents?.length) desc += `\n  Used by: [${c.usedByComponents.join(', ')}]`;
      if (c.relatedComponents?.length) desc += `\n  Related: [${c.relatedComponents.join(', ')}]`;
      return desc;
    })
    .join('\n');

  return `## User Request
"${userRequest}"

## Video Specifications
- Duration: ${targetDurationSeconds} seconds (${composition.fps} fps = ${composition.durationInFrames} frames)
- Resolution: ${composition.width}x${composition.height}
- Voiceover: ${context.includeVoiceover ? 'Yes' : 'No'}

## Available Components
${componentSummary || 'No components discovered yet.'}

## Your Task
Create a compelling video plan that:
1. Addresses the user's request directly
2. Showcases the available components effectively
3. Maintains good pacing for a ${targetDurationSeconds}s video
4. Uses appropriate scene types and transitions
5. Considers the component relationships and interactions

Think step-by-step about the best narrative flow, then call create_video_plan with your complete plan.`;
}

export async function runDirectorAgent(
  context: AgentContext,
  onProgress?: ProgressCallback
): Promise<VideoPlan> {
  onProgress?.('🎬 Director Agent: Analyzing request and planning video structure...');

  const client = getAIClient();

  const prompt = buildDirectorPrompt(context);

  const response = await client.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    config: {
      systemInstruction: DIRECTOR_SYSTEM_PROMPT,
      tools: [{ functionDeclarations: [VIDEO_PLAN_TOOL] }],
      temperature: 0.7,
    },
  });

  // Extract function call from response
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  for (const part of parts) {
    if (part.functionCall && part.functionCall.name === 'create_video_plan') {
      const args = part.functionCall.args as Record<string, unknown>;

      // Convert percentage-based durations to frames
      const totalFrames = context.composition.durationInFrames;
      const scenesRaw = args.scenes as Array<{
        type: string;
        purpose: string;
        durationPercentage: number;
        componentName?: string;
        keyPoints: string[];
        interactionGoals?: string[];
        animationIntensity: string;
      }>;

      const scenes: SceneOutline[] = scenesRaw.map((s, i) => {
        // Find matching component by name
        const component = s.componentName
          ? context.components.find(
              (c) => c.name.toLowerCase() === s.componentName?.toLowerCase()
            )
          : undefined;

        return {
          id: `scene-${i + 1}`,
          type: s.type as SceneOutline['type'],
          purpose: s.purpose,
          durationInFrames: Math.round((s.durationPercentage / 100) * totalFrames),
          componentId: component?.id,
          componentName: s.componentName,
          keyPoints: s.keyPoints,
          interactionGoals: s.interactionGoals,
          animationIntensity: s.animationIntensity as SceneOutline['animationIntensity'],
        };
      });

      const plan: VideoPlan = {
        title: args.title as string,
        audience: args.audience as string,
        coreMessage: args.coreMessage as string,
        tone: args.tone as VideoPlan['tone'],
        style: args.style as VideoPlan['style'],
        durationInFrames: totalFrames,
        scenes,
      };

      onProgress?.(
        `✅ Director Agent: Created plan with ${scenes.length} scenes - "${plan.title}"`
      );

      return plan;
    }
  }

  // Fallback if no function call was made
  throw new Error('Director Agent failed to create a video plan');
}

/**
 * Validate that a video plan is well-formed and feasible.
 */
export function validateVideoPlan(plan: VideoPlan): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check total duration adds up
  const totalSceneDuration = plan.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
  const durationDiff = Math.abs(totalSceneDuration - plan.durationInFrames);
  if (durationDiff > plan.durationInFrames * 0.1) {
    issues.push(
      `Scene durations (${totalSceneDuration}) don't match total (${plan.durationInFrames})`
    );
  }

  // Check scene count
  if (plan.scenes.length < 2) {
    issues.push('Video should have at least 2 scenes');
  }
  if (plan.scenes.length > 15) {
    issues.push('Too many scenes (>15) may make the video feel rushed');
  }

  // Check for intro and outro
  const hasIntro = plan.scenes.some((s) => s.type === 'intro');
  const hasOutro = plan.scenes.some((s) => s.type === 'outro');
  if (!hasIntro) {
    issues.push('Missing intro scene');
  }
  if (!hasOutro) {
    issues.push('Missing outro scene');
  }

  // Check scene durations
  const fps = 30; // Assume 30fps
  for (const scene of plan.scenes) {
    const durationSec = scene.durationInFrames / fps;
    if (durationSec < 1) {
      issues.push(`Scene "${scene.id}" is too short (${durationSec.toFixed(1)}s)`);
    }
    if (scene.type === 'tutorial' && durationSec < 3) {
      issues.push(`Tutorial scene "${scene.id}" needs more time for interactions`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
