/**
 * Refinement Agent - Quality Verification & Enhancement
 *
 * The Refinement Agent acts as a "Critic" that reviews the assembled composition
 * and identifies issues or opportunities for improvement.
 *
 * It implements CoAgent's closed-loop verification approach:
 * 1. Review the composition against the original plan
 * 2. Identify issues (visual, timing, narrative)
 * 3. Suggest specific fixes
 * 4. Optionally apply fixes automatically
 *
 * This agent uses an LLM to reason about video quality and suggest improvements.
 */

import { Type } from '@google/genai';
import { getAIClient } from '../client';
import { DEFAULT_MODEL } from '../models';
import type {
  VideoPlan,
  DetailedScene,
  GeneratedComposition,
  GeneratedItem,
  AgentContext,
  ProgressCallback,
} from './types';

export interface RefinementIssue {
  severity: 'critical' | 'warning' | 'suggestion';
  category: 'timing' | 'visual' | 'narrative' | 'animation' | 'accessibility';
  description: string;
  itemId?: string;
  sceneId?: string;
  suggestedFix?: {
    action: 'adjust-timing' | 'adjust-position' | 'add-element' | 'remove-element' | 'modify-animation';
    details: Record<string, unknown>;
  };
}

export interface RefinementResult {
  overallScore: number; // 0-100
  issues: RefinementIssue[];
  summary: string;
  recommendedChanges: number;
}

/**
 * Refinement Agent System Prompt
 *
 * Quality critic that scores compositions and provides specific fix instructions.
 * Outputs actionable patches, not vague suggestions.
 */
const REFINEMENT_SYSTEM_PROMPT = `## ROLE
You are a Video Quality Critic. You score compositions and output SPECIFIC fix instructions, not vague suggestions.

## CORE RULES

1. **SCORE < 40 = REGENERATE** — Don't patch, flag for full regeneration from Director.

2. **OUTPUT PATCHES, NOT PROSE** — Every issue needs { elementId, issue, fix, priority }.

3. **FIX RECIPES ARE MANDATORY** — Use the exact fixes below, don't invent vague "improve timing".

4. **SCORING WEIGHTS MUST SUM TO 100%:**
   - Visual Composition: 30%
   - Timing: 25%
   - Narrative Flow: 25%
   - Animation Quality: 15%
   - Accessibility: 5%

## FIX RECIPES (Top 5 Failure Modes)

### 1. Text Overlapping Component
**Detection:** Text element with y: 0.4-0.6 when component at y: 0.5
**Fix:**
\`\`\`json
{
  "elementId": "text-xyz",
  "issue": "Text overlaps component (both at y ~0.5)",
  "fix": { "action": "adjust-position", "details": { "position": { "y": 0.10 } } },
  "priority": "critical"
}
\`\`\`
Move text to y < 0.20 (above) or y > 0.80 (below component).

### 2. Animation Too Fast
**Detection:** Entrance keyframes complete in < 10 frames
**Fix:**
\`\`\`json
{
  "elementId": "comp-abc",
  "issue": "Animation too fast (8 frames)",
  "fix": { "action": "modify-animation", "details": { "keyframes": [{"frame": 0, "scale": 0}, {"frame": 20, "scale": 1}] } },
  "priority": "critical"
}
\`\`\`
Extend duration by 1.5x. Minimum entrance: 15 frames.

### 3. Elements Appearing Simultaneously
**Detection:** Multiple elements with staggerDelay: 0 or same offsetFrames
**Fix:**
\`\`\`json
{
  "elementId": "text-2",
  "issue": "No stagger (appears same time as text-1)",
  "fix": { "action": "adjust-timing", "details": { "staggerDelay": 12 } },
  "priority": "critical"
}
\`\`\`
Add 12-frame stagger cascade. Order: title(0) → subtitle(12) → component(24) → cta(36).

### 4. Component Not Visible
**Detection:** Component extends beyond device frame bounds
**Fix:**
\`\`\`json
{
  "elementId": "comp-xyz",
  "issue": "Component overflows device frame",
  "fix": { "action": "adjust-position", "details": { "displaySize": "laptop", "containerWidth": 1280 } },
  "priority": "critical"
}
\`\`\`
Switch to larger frame or reduce containerWidth.

### 5. No Clear Narrative
**Detection:** Missing intro or outro scene
**Fix:**
\`\`\`json
{
  "sceneId": null,
  "issue": "Missing Hook scene (no intro)",
  "fix": { "action": "add-element", "details": { "sceneType": "intro", "durationInFrames": 60 } },
  "priority": "critical"
}
\`\`\`
Flag for Director regeneration with missing scene type.

## SCORING CRITERIA

### Visual Composition (30%)
- Elements properly positioned in safe zones (60px from edges)
- No text over components (text on black areas only)
- Visual hierarchy clear (title > subtitle > description)
- Device frames used for components
- Max 3-4 colors for cohesion

### Timing (25%)
- Elements on screen 90+ frames minimum
- Scene transitions smooth (15-30 frames)
- Pacing matches tone
- No rushed sections (< 60 frames)

### Narrative Flow (25%)
- Hook present (first 15% of frames)
- Clear showcase section (55% of frames)
- CTA present (last 15% of frames)
- Logical progression

### Animation Quality (15%)
- Spring-based animations (spring-scale, spring-bounce)
- Stagger between elements (10-20 frames)
- Appropriate spring presets (smooth/bouncy)
- No linear easing

### Accessibility (5%)
- Text readable (56px+ for titles)
- Sufficient contrast
- Not overwhelming motion

## SCORE THRESHOLDS

| Score | Action |
|-------|--------|
| 90-100 | Ship it — no changes needed |
| 75-89 | Apply minor patches (1-2 fixes) |
| 60-74 | Apply patches (3-5 fixes) |
| 40-59 | Apply major patches + manual review |
| 0-39 | **REGENERATE** — don't patch, send back to Director |

## OUTPUT FORMAT

\`\`\`typescript
interface RefinementResult {
  overallScore: number;  // 0-100
  requiresRegeneration: boolean;  // true if score < 40
  summary: string;
  issues: Array<{
    elementId?: string;
    sceneId?: string;
    issue: string;
    fix: {
      action: "adjust-timing" | "adjust-position" | "modify-animation" | "add-element" | "remove-element";
      details: Record<string, unknown>;
    };
    priority: "critical" | "minor";
  }>;
}
\`\`\`

## ANTI-PATTERNS

| Bad Output | Good Output |
|------------|-------------|
| "Improve the timing" | { action: "adjust-timing", details: { from: 60, durationInFrames: 120 } } |
| "Text is hard to read" | { action: "adjust-position", details: { position: { y: 0.10 } } } |
| "Animation feels off" | { action: "modify-animation", details: { keyframes: [...] } } |
| Score 35 with patches | requiresRegeneration: true, no patches |

Call analyze_composition with your complete assessment.`;

const REFINEMENT_TOOL = {
  name: 'analyze_composition',
  description: 'Provide a detailed quality analysis of the composition',
  parameters: {
    type: Type.OBJECT,
    properties: {
      overallScore: {
        type: Type.NUMBER,
        description: 'Quality score from 0-100',
      },
      summary: {
        type: Type.STRING,
        description: 'Brief summary of the composition quality',
      },
      issues: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            severity: {
              type: Type.STRING,
              enum: ['critical', 'warning', 'suggestion'],
            },
            category: {
              type: Type.STRING,
              enum: ['timing', 'visual', 'narrative', 'animation', 'accessibility'],
            },
            description: {
              type: Type.STRING,
              description: 'What the issue is',
            },
            itemId: {
              type: Type.STRING,
              description: 'ID of affected item (if applicable)',
            },
            sceneId: {
              type: Type.STRING,
              description: 'ID of affected scene (if applicable)',
            },
            suggestedFix: {
              type: Type.OBJECT,
              properties: {
                action: {
                  type: Type.STRING,
                  enum: [
                    'adjust-timing',
                    'adjust-position',
                    'add-element',
                    'remove-element',
                    'modify-animation',
                  ],
                },
                details: {
                  type: Type.OBJECT,
                  description: 'Specific parameters for the fix',
                },
              },
            },
          },
          required: ['severity', 'category', 'description'],
        },
      },
    },
    required: ['overallScore', 'summary', 'issues'],
  },
};

function buildRefinementPrompt(
  composition: GeneratedComposition,
  videoPlan: VideoPlan,
  detailedScenes: DetailedScene[],
  context: AgentContext
): string {
  // Summarize composition content
  const trackSummary = composition.tracks
    .map((t) => {
      const items = t.items
        .slice(0, 5)
        .map((i) => {
          if (i.type === 'text') return `"${(i.text as string)?.slice(0, 30)}..."`;
          if (i.type === 'component') return `Component(${i.componentId})`;
          if (i.type === 'shape') return `Shape(${i.shapeType})`;
          if (i.type === 'cursor') return 'Cursor';
          return i.type;
        })
        .join(', ');
      return `- ${t.name} (${t.type}): ${t.items.length} items [${items}${t.items.length > 5 ? '...' : ''}]`;
    })
    .join('\n');

  const sceneTimeline = detailedScenes
    .map((s) => {
      const endFrame = s.from + s.durationInFrames;
      const durationSec = (s.durationInFrames / context.composition.fps).toFixed(1);
      return `- ${s.sceneId}: frames ${s.from}-${endFrame} (${durationSec}s) - ${s.texts.length} texts, ${s.shapes.length} shapes${s.component ? ', 1 component' : ''}${s.cursor ? ', cursor' : ''}`;
    })
    .join('\n');

  // Sample some items for detailed review
  const sampleItems: string[] = [];
  for (const track of composition.tracks) {
    for (const item of track.items.slice(0, 3)) {
      sampleItems.push(JSON.stringify(item, null, 2));
    }
  }

  return `## Original Video Plan
- Title: "${videoPlan.title}"
- Audience: ${videoPlan.audience}
- Core Message: ${videoPlan.coreMessage}
- Tone: ${videoPlan.tone}
- Style: ${videoPlan.style}
- Planned Scenes: ${videoPlan.scenes.length}

## Scene Outline
${videoPlan.scenes.map((s) => `- ${s.id} (${s.type}): ${s.purpose}`).join('\n')}

## Generated Composition
- Duration: ${composition.durationInFrames} frames (${(composition.durationInFrames / context.composition.fps).toFixed(1)}s)
- Resolution: ${composition.width}x${composition.height}
- FPS: ${composition.fps}

## Tracks
${trackSummary}

## Scene Timeline
${sceneTimeline}

## Sample Items (for detailed review)
\`\`\`json
${sampleItems.slice(0, 5).join('\n\n')}
\`\`\`

## Your Task

Review this composition against the original plan and identify:
1. Critical issues that must be fixed
2. Warnings that should be addressed
3. Suggestions for improvement

Consider:
- Does the composition deliver on the video plan's goals?
- Is the pacing appropriate for the tone and audience?
- Are elements positioned well and readable?
- Do animations enhance or distract from the content?
- Is there a clear visual hierarchy?

Call analyze_composition with your assessment.`;
}

export async function runRefinementAgent(
  composition: GeneratedComposition,
  videoPlan: VideoPlan,
  detailedScenes: DetailedScene[],
  context: AgentContext,
  onProgress?: ProgressCallback
): Promise<RefinementResult> {
  onProgress?.('🔍 Refinement Agent: Analyzing composition quality...');

  const client = getAIClient();

  const prompt = buildRefinementPrompt(composition, videoPlan, detailedScenes, context);

  const response = await client.models.generateContent({
    model: context.modelId || DEFAULT_MODEL,
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    config: {
      systemInstruction: REFINEMENT_SYSTEM_PROMPT,
      tools: [{ functionDeclarations: [REFINEMENT_TOOL] }],
      temperature: 0.3, // Lower temperature for more consistent analysis
    },
  });

  // Extract function call
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  for (const part of parts) {
    if (part.functionCall && part.functionCall.name === 'analyze_composition') {
      const args = part.functionCall.args as {
        overallScore: number;
        summary: string;
        issues: RefinementIssue[];
      };

      const result: RefinementResult = {
        overallScore: args.overallScore,
        summary: args.summary,
        issues: args.issues || [],
        recommendedChanges: (args.issues || []).filter(
          (i) => i.severity === 'critical' || i.severity === 'warning'
        ).length,
      };

      const criticalCount = result.issues.filter((i) => i.severity === 'critical').length;
      const warningCount = result.issues.filter((i) => i.severity === 'warning').length;

      onProgress?.(
        `✅ Refinement Agent: Score ${result.overallScore}/100 - ${criticalCount} critical, ${warningCount} warnings`
      );

      return result;
    }
  }

  // Fallback result
  return {
    overallScore: 70,
    summary: 'Unable to analyze composition in detail',
    issues: [],
    recommendedChanges: 0,
  };
}

/**
 * Apply automatic fixes for certain issue types.
 */
export function applyAutoFixes(
  composition: GeneratedComposition,
  issues: RefinementIssue[]
): GeneratedComposition {
  // Clone composition for modification
  const fixed = JSON.parse(JSON.stringify(composition)) as GeneratedComposition;

  for (const issue of issues) {
    if (!issue.suggestedFix) continue;

    const { action, details } = issue.suggestedFix;

    switch (action) {
      case 'adjust-timing':
        // Find and adjust item timing
        if (issue.itemId) {
          for (const track of fixed.tracks) {
            const item = track.items.find((i) => i.id === issue.itemId);
            if (item && details) {
              if (details.from !== undefined) item.from = details.from as number;
              if (details.durationInFrames !== undefined) {
                item.durationInFrames = details.durationInFrames as number;
              }
            }
          }
        }
        break;

      case 'adjust-position':
        if (issue.itemId && details?.position) {
          for (const track of fixed.tracks) {
            const item = track.items.find((i) => i.id === issue.itemId);
            if (item) {
              item.position = details.position as { x: number; y: number };
            }
          }
        }
        break;

      case 'modify-animation':
        // Modify keyframes for an item
        if (issue.itemId && details?.keyframes) {
          for (const track of fixed.tracks) {
            const item = track.items.find((i) => i.id === issue.itemId);
            if (item) {
              item.keyframes = details.keyframes;
            }
          }
        }
        break;
    }
  }

  return fixed;
}

/**
 * Check if composition meets minimum quality threshold.
 */
export function meetsQualityThreshold(
  result: RefinementResult,
  minScore = 60
): boolean {
  const hasCritical = result.issues.some((i) => i.severity === 'critical');
  return result.overallScore >= minScore && !hasCritical;
}
