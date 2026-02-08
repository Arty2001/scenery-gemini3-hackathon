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

const REFINEMENT_SYSTEM_PROMPT = `You are a Video Quality Critic Agent specializing in motion graphics review.

Your role is to review a generated video composition and identify issues or improvements.

## Review Criteria

### Timing (Weight: 25%)
- Elements appear/disappear at appropriate times
- Animations have proper duration (not too fast/slow)
- Scene transitions are smooth
- Pacing matches the video's tone

### Visual Composition (Weight: 30%)
- Elements are properly positioned
- No overlapping text/components that hurt readability
- Visual hierarchy is clear
- Colors and contrast work well together
- Components are properly sized and framed
- **CRITICAL CHECK:** Canvas is BLACK (#000000). Components have LIGHT backgrounds.
  - White text (#ffffff) on black background = GOOD
  - White text overlapping light components = BAD (invisible!)
  - Dark text or text with backgroundColor pill when overlapping components = GOOD

### Narrative Flow (Weight: 25%)
- Story follows a logical progression
- Key points are communicated clearly
- Call-to-action is prominent (if applicable)
- Audience engagement is maintained

### Animation Quality (Weight: 15%)
- Animations use spring-based types (spring-scale, spring-slide, spring-bounce) NOT basic scale/slide
- Spring presets match the video tone (smooth for professional, bouncy for playful)
- Animations feel smooth and natural with proper spring physics
- Elements have stagger delays (10-20 frames between elements) - NOT all at once!
- Animation intensity matches the style (use appropriate springPreset)
- No jarring or abrupt movements - spring physics should handle easing

### Accessibility (Weight: 5%)
- Text is readable (size, contrast)
- Not too much motion for sensitive viewers
- Key information is conveyed visually

## Scoring

- 90-100: Excellent, professional quality
- 75-89: Good, minor improvements possible
- 60-74: Acceptable, several issues to address
- 40-59: Needs work, significant issues
- 0-39: Major problems, requires restructuring

## Output Format

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
    model: 'gemini-3-flash-preview',
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
