/**
 * Multi-Agent Video Generation System
 *
 * A sophisticated pipeline for generating professional product showcase videos
 * using multiple specialized AI agents:
 *
 * - Director Agent: High-level planning and narrative structure
 * - Scene Planner Agent: Detailed scene specifications
 * - Assembly Agent: Composition building and track creation
 * - Refinement Agent: Quality verification and improvement
 *
 * Architecture inspired by:
 * - MovieAgent: Hierarchical CoT planning
 * - UniVA: Plan/Act dual agent with memory
 * - CoAgent: Closed-loop verification and refinement
 */

// Main orchestrator
export { generateVideo, generateVideoQuick } from './orchestrator';
export type { VideoGenerationRequest, VideoGenerationResult } from './orchestrator';

// Individual agents (for advanced usage)
export { runDirectorAgent, validateVideoPlan } from './director-agent';
export { runScenePlannerAgent, planAllScenes } from './scene-planner-agent';
export {
  runAssemblyAgent,
  validateComposition,
  toEditorTracks,
} from './assembly-agent';
export {
  runRefinementAgent,
  meetsQualityThreshold,
  applyAutoFixes,
} from './refinement-agent';
export type { RefinementIssue, RefinementResult } from './refinement-agent';

// Types
export type {
  VideoPlan,
  SceneOutline,
  DetailedScene,
  SceneText,
  SceneShape,
  SceneCursor,
  SceneKeyframe,
  CursorKeyframe,
  GeneratedComposition,
  GeneratedTrack,
  GeneratedItem,
  AgentContext,
  ComponentInfo,
  ProgressCallback,
} from './types';
