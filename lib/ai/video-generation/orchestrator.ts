/**
 * Video Generation Orchestrator
 *
 * Coordinates the multi-agent video generation pipeline:
 *
 * 1. Director Agent → Creates high-level video plan
 * 2. Scene Planner Agent (parallel) → Details each scene
 * 3. Assembly Agent → Builds composition from scenes
 * 4. Refinement Agent → Reviews and suggests improvements
 * 5. (Optional) Re-plan/Re-assemble based on refinement
 *
 * The orchestrator manages:
 * - Agent sequencing and parallelization
 * - Context passing between agents
 * - Progress reporting to the client
 * - Error handling and recovery
 * - Quality gate enforcement
 */

import type { Track } from '@/lib/composition/types';
import type { CompositionContext } from '../system-prompt';

import { runDirectorAgent, validateVideoPlan } from './director-agent';
import { planAllScenes } from './scene-planner-agent';
import { runAssemblyAgent, validateComposition, toEditorTracks } from './assembly-agent';
import { runRefinementAgent, meetsQualityThreshold, applyAutoFixes } from './refinement-agent';

import type {
  AgentContext,
  ComponentInfo,
  VideoPlan,
  DetailedScene,
  GeneratedComposition,
  ProgressCallback,
} from './types';
import type { RefinementResult } from './refinement-agent';

export interface VideoGenerationRequest {
  /** User's natural language request */
  userRequest: string;

  /** Composition settings */
  composition: CompositionContext;

  /** Available components to use */
  components: ComponentInfo[];

  /** Whether to generate voiceover */
  includeVoiceover: boolean;

  /** Voice name for TTS */
  voiceName: string;

  /** Target duration in seconds */
  targetDurationSeconds: number;

  /** Project ID for storage */
  projectId?: string;

  /** Minimum quality score (0-100) */
  minQualityScore?: number;

  /** Max refinement iterations */
  maxRefinementIterations?: number;
}

export interface VideoGenerationResult {
  /** Success status */
  success: boolean;

  /** Generated tracks ready for the editor */
  tracks?: Track[];

  /** Video plan from director */
  videoPlan?: VideoPlan;

  /** Detailed scenes */
  scenes?: DetailedScene[];

  /** Full composition before track conversion */
  composition?: GeneratedComposition;

  /** Quality assessment */
  quality?: RefinementResult;

  /** Error message if failed */
  error?: string;

  /** Generation metadata */
  metadata: {
    totalDurationMs: number;
    agentTimings: Record<string, number>;
    refinementIterations: number;
    finalScore: number;
  };
}

/**
 * Main entry point for multi-agent video generation.
 */
export async function generateVideo(
  request: VideoGenerationRequest,
  onProgress?: ProgressCallback
): Promise<VideoGenerationResult> {
  const startTime = Date.now();
  const agentTimings: Record<string, number> = {};
  let refinementIterations = 0;

  const minQuality = request.minQualityScore ?? 60;
  const maxIterations = request.maxRefinementIterations ?? 2;

  onProgress?.('🚀 Starting multi-agent video generation pipeline...');

  // Build shared context
  const context: AgentContext = {
    userRequest: request.userRequest,
    composition: request.composition,
    components: request.components,
    includeVoiceover: request.includeVoiceover,
    voiceName: request.voiceName,
    targetDurationSeconds: request.targetDurationSeconds,
    projectId: request.projectId,
  };

  try {
    // =============================================
    // Stage 1: Director Agent
    // =============================================
    const directorStart = Date.now();
    onProgress?.('📋 Stage 1/4: Director planning video structure...');

    const videoPlan = await runDirectorAgent(context, onProgress);
    agentTimings['director'] = Date.now() - directorStart;

    // Validate the plan
    const planValidation = validateVideoPlan(videoPlan);
    if (!planValidation.valid) {
      console.warn('Video plan validation issues:', planValidation.issues);
      // Continue anyway, these are warnings
    }

    onProgress?.(
      `📋 Director created plan: "${videoPlan.title}" with ${videoPlan.scenes.length} scenes`
    );

    // =============================================
    // Stage 2: Scene Planner Agent (Parallel)
    // =============================================
    const scenePlannerStart = Date.now();
    onProgress?.('🎨 Stage 2/4: Planning detailed scenes in parallel...');

    const detailedScenes = await planAllScenes(videoPlan, context, onProgress);
    agentTimings['scenePlanner'] = Date.now() - scenePlannerStart;

    onProgress?.(`🎨 Scene Planner completed ${detailedScenes.length} detailed scenes`);

    // =============================================
    // Stage 3: Assembly Agent
    // =============================================
    const assemblyStart = Date.now();
    onProgress?.('🔧 Stage 3/4: Assembling composition...');

    let composition = await runAssemblyAgent(videoPlan, detailedScenes, context, onProgress);
    agentTimings['assembly'] = Date.now() - assemblyStart;

    // Validate composition
    const compValidation = validateComposition(composition);
    if (!compValidation.valid) {
      console.warn('Composition validation issues:', compValidation.issues);
    }

    onProgress?.(
      `🔧 Assembly complete: ${composition.tracks.length} tracks, ${composition.tracks.reduce((sum, t) => sum + t.items.length, 0)} items`
    );

    // =============================================
    // Stage 4: Refinement Agent (with iteration)
    // =============================================
    const refinementStart = Date.now();
    onProgress?.('🔍 Stage 4/4: Quality verification and refinement...');

    let quality = await runRefinementAgent(
      composition,
      videoPlan,
      detailedScenes,
      context,
      onProgress
    );

    // Track all versions to pick the best if none hit threshold
    const versions: Array<{ composition: GeneratedComposition; quality: RefinementResult }> = [
      { composition, quality },
    ];

    // Refinement loop - max iterations, then pick best
    while (
      !meetsQualityThreshold(quality, minQuality) &&
      refinementIterations < maxIterations
    ) {
      refinementIterations++;
      onProgress?.(
        `🔄 Refinement iteration ${refinementIterations}/${maxIterations}: Applying ${quality.issues.filter((i) => i.suggestedFix).length} fixes (current score: ${quality.overallScore})...`
      );

      // Apply automatic fixes
      composition = applyAutoFixes(composition, quality.issues);

      // Re-evaluate
      quality = await runRefinementAgent(
        composition,
        videoPlan,
        detailedScenes,
        context,
        onProgress
      );

      // Track this version
      versions.push({ composition, quality });
    }

    // If we hit max iterations without meeting threshold, pick the best version
    if (!meetsQualityThreshold(quality, minQuality) && versions.length > 1) {
      const best = versions.reduce((a, b) =>
        a.quality.overallScore > b.quality.overallScore ? a : b
      );
      composition = best.composition;
      quality = best.quality;
      onProgress?.(
        `⚠️ Max iterations reached. Using best version with score ${quality.overallScore}/100`
      );
    }

    agentTimings['refinement'] = Date.now() - refinementStart;

    // =============================================
    // Final Output
    // =============================================
    const totalDuration = Date.now() - startTime;

    // Convert to editor tracks
    const tracks = toEditorTracks(composition);

    onProgress?.(
      `✅ Video generation complete! Score: ${quality.overallScore}/100, Duration: ${(totalDuration / 1000).toFixed(1)}s`
    );

    return {
      success: true,
      tracks,
      videoPlan,
      scenes: detailedScenes,
      composition,
      quality,
      metadata: {
        totalDurationMs: totalDuration,
        agentTimings,
        refinementIterations,
        finalScore: quality.overallScore,
      },
    };
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('Video generation failed:', error);
    onProgress?.(`❌ Video generation failed: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
      metadata: {
        totalDurationMs: totalDuration,
        agentTimings,
        refinementIterations,
        finalScore: 0,
      },
    };
  }
}

/**
 * Quick video generation without refinement loop.
 * Faster but may have quality issues.
 */
export async function generateVideoQuick(
  request: VideoGenerationRequest,
  onProgress?: ProgressCallback
): Promise<VideoGenerationResult> {
  return generateVideo(
    {
      ...request,
      minQualityScore: 0, // Skip quality gate
      maxRefinementIterations: 0, // No refinement
    },
    onProgress
  );
}

/**
 * Re-export types for convenience.
 */
export type { VideoPlan, DetailedScene, ComponentInfo, AgentContext };
