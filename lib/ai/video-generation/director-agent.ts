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
import { GLOSSARY, FRAME_BUDGET } from './shared-constants';
import { getAIClient } from '../client';
import { DEFAULT_MODEL } from '../models';
import type {
  VideoPlan,
  SceneOutline,
  AgentContext,
  ComponentInfo,
  ProgressCallback,
} from './types';

/**
 * Director Agent System Prompt
 *
 * The Director creates high-level video plans with narrative structure and timing.
 * It outputs SCENE INTENTS (what should happen), not animation specifics (how it animates).
 * Scene Planner translates intents into concrete animation configs.
 */
const DIRECTOR_SYSTEM_PROMPT = `## ROLE
You are a Video Director creating narrative-driven motion graphics. You plan WHAT happens and WHEN, not HOW it animates.

${GLOSSARY}

## CORE RULES (in priority order)

1. **ALL TIMING IN FRAMES** — 30fps. Never use seconds. Conversion: seconds × 30 = frames.

2. **FRAME BUDGET FORMULA** — totalFrames = durationSeconds × 30. Allocate:
   - Hook: 15% of frames
   - Setup: 15% of frames
   - Showcase: 55% of frames
   - CTA: 15% of frames

3. **MINIMUM 90 FRAMES PER SCENE** — Anything shorter is unreadable.

4. **OUTPUT INTENTS, NOT ANIMATIONS** — Say "dramatic entrance" not "spring-scale bouncy". Scene Planner decides animation type.

5. **1-3 COMPONENTS MAX** — Each needs 120+ frames (4s) of screen time. Quality over quantity.

6. **NARRATIVE ARC REQUIRED** — Every video has Hook → Setup → Showcase → CTA. No exceptions.

7. **TUTORIALS NEED COMPLETE FLOWS** — Don't stop mid-action. Plan full user journeys.

8. **STAGGER ALL ENTRANCES** — Never animate elements simultaneously. 15-frame gaps minimum.

9. **DEVICE FRAMES FOR UI** — Components render in phone/laptop frames, not floating.

10. **TEXT ON BLACK ONLY** — Components have light backgrounds. Text goes on black canvas areas.

${FRAME_BUDGET}

## SCENE INTENT SYSTEM

Instead of specifying animations, output intents that Scene Planner interprets:

| Intent | Meaning | Scene Planner Translates To |
|--------|---------|----------------------------|
| entrance: "dramatic" | Big, attention-grabbing | spring-bounce, bouncy preset |
| entrance: "subtle" | Smooth, professional | spring-scale, smooth preset |
| entrance: "energetic" | Fast, playful | spring-scale, snappy preset |
| mood: "professional" | Clean, controlled motion | smooth/gentle springs |
| mood: "playful" | Bouncy, fun motion | bouncy springs, overshoot |
| mood: "cinematic" | Slow, dramatic reveals | heavy springs, blur effects |
| energy: "high" | Fast stagger (10f), quick entrances | snappy preset |
| energy: "medium" | Standard stagger (15f) | smooth preset |
| energy: "low" | Slow stagger (20f+), deliberate | gentle preset |

## SCENE TYPES & FRAME ALLOCATION

| Type | Purpose | Min Frames | Max Frames |
|------|---------|------------|------------|
| intro | Hook + title + value prop | 60 | 120 |
| feature | Showcase component | 120 | 240 |
| tutorial | Interactive demo | 180 | 360 |
| transition | Scene connector | 15 | 30 |
| outro | CTA + closing | 60 | 90 |

## OUTPUT FORMAT (TypeScript)

\`\`\`typescript
interface VideoPlan {
  title: string;
  audience: string;
  coreMessage: string;
  tone: "professional" | "playful" | "technical" | "inspirational";
  style: "minimal" | "motion-rich" | "cinematic" | "energetic";
  scenes: SceneOutline[];
}

interface SceneOutline {
  type: "intro" | "feature" | "tutorial" | "transition" | "outro";
  purpose: string;
  durationInFrames: number;  // FRAMES not seconds!
  componentName?: string;
  keyPoints: string[];
  interactionGoals?: string[];  // For tutorials
  intent: {
    entrance: "dramatic" | "subtle" | "energetic";
    mood: "professional" | "playful" | "cinematic";
    energy: "high" | "medium" | "low";
  };
}
\`\`\`

## FEW-SHOT EXAMPLE

**Input:** "Create a 15-second demo of a Login Form component"

**Output:**
\`\`\`json
{
  "title": "Secure Authentication Made Simple",
  "audience": "Developers evaluating auth UI libraries",
  "coreMessage": "Beautiful, accessible login forms out of the box",
  "tone": "professional",
  "style": "motion-rich",
  "scenes": [
    {
      "type": "intro",
      "purpose": "Hook with bold title and value proposition",
      "durationInFrames": 67,
      "keyPoints": ["Secure Auth", "Built for developers"],
      "intent": { "entrance": "dramatic", "mood": "professional", "energy": "high" }
    },
    {
      "type": "feature",
      "purpose": "Showcase Login Form component in phone frame",
      "durationInFrames": 248,
      "componentName": "LoginForm",
      "keyPoints": ["Clean design", "Accessible inputs", "Error handling"],
      "interactionGoals": ["Focus email", "Type email", "Focus password", "Submit"],
      "intent": { "entrance": "subtle", "mood": "professional", "energy": "medium" }
    },
    {
      "type": "outro",
      "purpose": "CTA with installation command",
      "durationInFrames": 68,
      "keyPoints": ["npm install @acme/auth", "Get started in minutes"],
      "intent": { "entrance": "energetic", "mood": "professional", "energy": "high" }
    }
  ]
}
\`\`\`

Total: 67 + 248 + 68 = 383 frames ≈ 12.8s (with 15f transitions between = ~450 frames = 15s)

## DEMO POLISH PATTERNS (use these for WOW factor!)

When planning scenes, consider including these high-impact visual patterns:

### 1. Counter Animation
For any scene showing numbers, stats, or metrics:
- Add a keyPoint like "animate counter: 0 → 1,234"
- Scene Planner will create number animation over 20 frames
- Great for: user counts, revenue, performance metrics

### 2. Code Snippet Reveal
For developer-focused demos:
- Add keyPoint: "typewriter code: npm install @acme/ui"
- Characters type out progressively (2 frames per character)
- Great for: installation commands, API examples, config snippets

### 3. Split-Screen Before/After
For transformation or comparison scenes:
- Set scene type to "feature" with componentName
- Add keyPoints: ["show without (left)", "show with (right)", "sliding divider"]
- Creates compelling visual proof of value

### 4. Particle Burst on CTA
For outro scenes with calls-to-action:
- Add keyPoint: "particle burst behind CTA"
- Scene Planner adds confetti/sparks effect
- Makes the CTA feel celebratory and clickable

### 5. Device Frame Transition
For multi-platform demos:
- Add keyPoint: "transition phone → laptop"
- Shows same component adapting to different devices
- Demonstrates responsive design

**When to use**: Include 1-2 of these patterns per video for maximum impact without overwhelming.

## ANTI-PATTERNS

| Problem | Fix |
|---------|-----|
| Scene < 90 frames | Extend to minimum 90f or merge with adjacent scene |
| No intro scene | Add 60-90f Hook with title + value prop |
| Component showcase < 120f | Extend to 120f minimum for visibility |
| Tutorial without complete flow | Add missing steps: focus → type → submit → feedback |
| Specifying "spring-scale bouncy" | Use intent: { entrance: "dramatic", mood: "playful" } instead |

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
              description: 'REQUIRED: Percentage of total video duration this scene takes (number between 10-40). All scenes must add up to 100. Example: 20 means 20% of total duration.',
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
    model: context.modelId || DEFAULT_MODEL,
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

  // Debug: Log what we got from Gemini
  console.log(`[Director Agent] Model: ${context.modelId || DEFAULT_MODEL}`);
  console.log(`[Director Agent] Candidates:`, response.candidates?.length ?? 0);
  if (!candidate) {
    console.error(`[Director Agent] No candidate in response! Full response:`, JSON.stringify(response).slice(0, 500));
  }
  console.log(`[Director Agent] Response parts:`, parts.length);
  for (const p of parts) {
    if (p.text) console.log(`[Director Agent] Text response:`, p.text.slice(0, 300));
    if (p.functionCall) console.log(`[Director Agent] Function call:`, p.functionCall.name);
  }

  for (const part of parts) {
    if (part.functionCall && part.functionCall.name === 'create_video_plan') {
      const args = part.functionCall.args as Record<string, unknown>;

      // Convert percentage-based durations to frames
      const totalFrames = typeof context.composition.durationInFrames === 'number'
        ? context.composition.durationInFrames
        : 900; // Fallback: 30 seconds at 30fps

      const scenesRaw = args.scenes as Array<{
        type: string;
        purpose: string;
        durationPercentage?: number;
        duration?: number;
        durationPercent?: number;
        percentage?: number;
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

        // Try multiple field names Flash might use for duration percentage
        let percentage = s.durationPercentage ?? s.duration ?? s.durationPercent ?? s.percentage;
        if (typeof percentage !== 'number' || isNaN(percentage)) {
          console.warn(`[Director] Scene ${i + 1} has invalid durationPercentage:`, percentage, '- using even distribution');
          percentage = 100 / scenesRaw.length; // Even distribution fallback
        }
        // Clamp percentage to reasonable range
        percentage = Math.max(5, Math.min(50, percentage));

        const calculatedDuration = Math.round((percentage / 100) * totalFrames);

        return {
          id: `scene-${i + 1}`,
          type: s.type as SceneOutline['type'],
          purpose: s.purpose,
          durationInFrames: isNaN(calculatedDuration) ? 150 : calculatedDuration,
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
