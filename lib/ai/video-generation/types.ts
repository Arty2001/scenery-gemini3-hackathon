/**
 * Types for multi-agent video generation system.
 *
 * Architecture inspired by:
 * - MovieAgent: Hierarchical CoT planning (Director → Scene → Shot)
 * - UniVA: Plan/Act dual agent with multi-level memory
 * - CoAgent: Closed-loop verification and refinement
 */

import type { CompositionContext } from '../system-prompt';

// =============================================
// Director Agent Types
// =============================================

/**
 * High-level video plan created by the Director Agent.
 * Defines the narrative arc, pacing, and scene breakdown.
 */
export interface VideoPlan {
  /** Overall video title */
  title: string;

  /** Target audience description */
  audience: string;

  /** Core message/value proposition */
  coreMessage: string;

  /** Tone: "professional", "playful", "technical", "inspirational" */
  tone: 'professional' | 'playful' | 'technical' | 'inspirational';

  /** Visual style: "minimal", "motion-rich", "cinematic", "energetic" */
  style: 'minimal' | 'motion-rich' | 'cinematic' | 'energetic';

  /** Total planned duration in frames */
  durationInFrames: number;

  /** Scene outlines (high-level, not detailed yet) */
  scenes: SceneOutline[];
}

export interface SceneOutline {
  /** Scene identifier */
  id: string;

  /** Scene type: intro, feature, transition, tutorial, outro */
  type: 'intro' | 'feature' | 'transition' | 'tutorial' | 'outro';

  /** Brief description of scene purpose */
  purpose: string;

  /** Planned duration in frames */
  durationInFrames: number;

  /** Component ID to showcase (if feature/tutorial scene) */
  componentId?: string;

  /** Component name for context */
  componentName?: string;

  /** Key points to communicate */
  keyPoints: string[];

  /** If tutorial, what interactions to demonstrate */
  interactionGoals?: string[];

  /** Animation intensity: low, medium, high */
  animationIntensity: 'low' | 'medium' | 'high';
}

// =============================================
// Scene Planner Agent Types
// =============================================

/**
 * Detailed scene plan created by Scene Planner Agent.
 * Contains all the specifics needed to build the scene.
 */
export interface DetailedScene {
  /** Reference to scene outline */
  sceneId: string;

  /** Start frame in the final video */
  from: number;

  /** Duration in frames */
  durationInFrames: number;

  /** Component configuration (if applicable) */
  component?: {
    componentId: string;
    displaySize: 'phone' | 'laptop' | 'full';
    containerWidth?: number;
    containerHeight?: number;
    objectPosition?: string;
    props?: Record<string, unknown>;
    /** Keyframe animations for the component */
    keyframes?: SceneKeyframe[];
  };

  /** Text overlays for this scene */
  texts: SceneText[];

  /** Shape elements (backgrounds, badges, etc.) */
  shapes: SceneShape[];

  /** Image elements (logos, icons, screenshots) */
  images?: SceneImage[];

  /** Cursor interactions (for tutorials) */
  cursor?: SceneCursor;

  /** Narration script (if voiceover enabled) */
  narrationScript?: string;
}

export interface SceneKeyframe {
  frame: number;
  values: Record<string, number>;
  easing?: string;
}

export interface SceneText {
  text: string;
  role: 'title' | 'subtitle' | 'description' | 'label' | 'cta';
  fontSize: number;
  fontWeight?: number;
  color: string;
  backgroundColor?: string;
  position: { x: number; y: number };
  offsetFrames: number;
  durationInFrames?: number;
  keyframes?: SceneKeyframe[];
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
}

export interface SceneShape {
  shapeType: 'rectangle' | 'circle' | 'gradient' | 'line' | 'badge' | 'svg';
  width: number;
  height: number;
  position: { x: number; y: number };
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  opacity?: number;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: number;
  text?: string;
  fontSize?: number;
  color?: string;
  svgContent?: string;
  viewBox?: string;
  offsetFrames: number;
  durationInFrames?: number;
  keyframes?: SceneKeyframe[];
}

export interface SceneImage {
  /** Image source URL or path */
  src: string;
  /** Alt text description */
  alt?: string;
  /** Normalized position (0-1) */
  position: { x: number; y: number };
  /** Normalized size (0-1 relative to canvas) */
  width: number;
  height: number;
  /** Clip shape for image */
  clipShape?: 'none' | 'circle' | 'rounded-rect' | 'hexagon' | 'diamond';
  /** Frames after scene start */
  offsetFrames: number;
  /** Duration in frames */
  durationInFrames?: number;
  /** Keyframe animations */
  keyframes?: SceneKeyframe[];
}

export interface SceneCursor {
  cursorStyle: 'default' | 'pointer' | 'hand';
  clickEffect: 'ripple' | 'highlight' | 'none';
  keyframes: CursorKeyframe[];
}

export interface CursorKeyframe {
  frame: number;
  /** Target element selector (preferred) */
  target?: string;
  /** Fallback position */
  x?: number;
  y?: number;
  click?: boolean;
  action?: 'click' | 'hover' | 'focus' | 'type' | 'select' | 'check';
  value?: string;
}

// =============================================
// Assembly & Output Types
// =============================================

/**
 * Full composition ready to be loaded into the editor.
 */
export interface GeneratedComposition {
  name: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  tracks: GeneratedTrack[];
}

export interface GeneratedTrack {
  name: string;
  type: 'component' | 'text' | 'shape' | 'cursor' | 'audio' | 'video' | 'image';
  locked: boolean;
  visible: boolean;
  items: GeneratedItem[];
}

export type GeneratedItem = Record<string, unknown>;

// =============================================
// Agent Context Types
// =============================================

/**
 * Shared context passed between agents.
 * Acts as "memory" for the multi-agent system.
 */
export interface AgentContext {
  /** Original user request */
  userRequest: string;

  /** Composition settings */
  composition: CompositionContext;

  /** Available components with details */
  components: ComponentInfo[];

  /** Whether to include voiceover */
  includeVoiceover: boolean;

  /** Voice name for TTS */
  voiceName: string;

  /** Target video duration in seconds */
  targetDurationSeconds: number;

  /** Project ID for asset storage */
  projectId?: string;

  /** Available uploaded assets (images, videos, audio) */
  availableAssets?: AvailableAsset[];

  /** AI model to use for generation (e.g., gemini-3-pro-preview) */
  modelId?: string;
}

export interface AvailableAsset {
  /** Display name of the asset */
  name: string;
  /** Public URL to use in compositions */
  url: string;
  /** Asset type */
  type: 'image' | 'video' | 'audio' | 'other';
}

export interface ComponentInfo {
  id: string;
  name: string;
  category: string;
  description?: string;
  props: string[];
  demoProps?: Record<string, unknown>;
  interactiveElements?: string;
  usesComponents?: string[];
  usedByComponents?: string[];
  relatedComponents?: string[];
}

// =============================================
// Progress Callback
// =============================================

export type ProgressCallback = (message: string) => void;
