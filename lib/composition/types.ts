/**
 * TypeScript types for the composition system.
 * Defines the structure for multi-track video timelines.
 */

// =============================================
// Animation Types
// =============================================

export type AnimationType = 'none' | 'fade' | 'slide' | 'scale';
export type SlideDirection = 'left' | 'right' | 'top' | 'bottom';

export interface AnimationConfig {
  type: AnimationType;
  direction?: SlideDirection;
  durationInFrames?: number; // default 15
}

export interface TransitionConfig {
  type: 'fade' | 'slide';
  direction?: SlideDirection;
  durationInFrames: number;
}

// =============================================
// Keyframe Animation Types
// =============================================

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';

/**
 * A single keyframe: at a given frame offset, set numeric properties to specific values.
 * Frame is relative to the item's start (0 = first frame of item).
 */
export interface PropertyKeyframe {
  frame: number;
  values: Record<string, number>; // e.g. { positionX: 0.5, positionY: 0.3, opacity: 1, scale: 1.2 }
  easing?: EasingType; // Easing to reach this keyframe from the previous one
}

// =============================================
// Cursor Keyframe (declared early for BaseTimelineItem union)
// =============================================

export interface CursorInteraction {
  /** CSS selector targeting the element inside the component HTML */
  selector: string;
  /** Action to perform */
  action: 'click' | 'hover' | 'type' | 'focus' | 'select' | 'check';
  /** Text to type into an input (for action: 'type'), or option value (for action: 'select') */
  value?: string;
  /**
   * Frames per character for typing (default: 1 = fast typing).
   * Use 2-3 for deliberate typing, 1 for fast typing.
   */
  speed?: number;
  /**
   * Duration in frames to hold the interaction visible after it completes.
   * For 'type': how long to show the completed text before cursor moves.
   * For 'click': how long to show the pressed state.
   */
  holdDuration?: number;
}

export interface CursorKeyframe {
  frame: number;
  /** Manual pixel position (used if no target specified) */
  x?: number;
  y?: number;
  /**
   * CSS selector to auto-position cursor to. The cursor will find this element
   * in component previews and move to its center. Takes precedence over x/y.
   * Example: 'button[data-testid="submit"]', 'input[name="email"]'
   */
  target?: string;
  /** Offset from target element center in pixels (default: cursor tip at center) */
  targetOffset?: { x: number; y: number };
  /** Show click effect at this keyframe */
  click?: boolean;
  /** Interaction to apply to the targeted element at this keyframe */
  interaction?: CursorInteraction;
}

// =============================================
// Base Timeline Item
// =============================================

/**
 * Shared fields for all timeline items.
 */
export interface BaseTimelineItem {
  id: string;
  from: number; // Start frame
  durationInFrames: number;
  enterAnimation?: AnimationConfig;
  exitAnimation?: AnimationConfig;
  transitionIn?: TransitionConfig;
  keyframes?: PropertyKeyframe[]; // Keyframe animations for any numeric property
}

// =============================================
// Item Types
// =============================================

/**
 * Component item - renders a user's React component from discovered_components.
 */
export interface ComponentItem extends BaseTimelineItem {
  type: 'component';
  componentId: string; // UUID reference to discovered_components.id
  props: Record<string, unknown>;
  displaySize?: 'phone' | 'laptop' | 'full'; // Device frame preset
  containerWidth?: number;  // Custom container width in px (overrides displaySize)
  containerHeight?: number; // Custom container height in px (overrides displaySize)
  objectFit?: 'contain' | 'cover' | 'fill'; // How content fits in container
  objectPosition?: string; // CSS object-position e.g. "top left", "center"
  position?: { x: number; y: number }; // Optional 0-1 relative position (default: centered 0.5, 0.5)
}

/**
 * Text overlay item - renders text on the video.
 */
export interface TextItem extends BaseTimelineItem {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  position: { x: number; y: number }; // Relative 0-1 coordinates
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;
  textShadow?: string;
  letterSpacing?: number;
  lineHeight?: number;
}

/**
 * Media item - video or audio clip.
 */
export interface MediaItem extends BaseTimelineItem {
  type: 'video' | 'audio';
  src: string;
  volume: number; // 0-1
  startFrom: number; // Trim start frame
  position?: { x: number; y: number }; // 0-1 relative (default: centered)
  clipShape?: 'none' | 'circle' | 'rounded-rect' | 'hexagon' | 'diamond';
  width?: number;  // 0-1 relative to composition width
  height?: number; // 0-1 relative to composition height
}

/**
 * Image item - static image on the timeline.
 */
export interface ImageItem extends BaseTimelineItem {
  type: 'image';
  src: string;
  position?: { x: number; y: number }; // 0-1 relative (default: centered)
  clipShape?: 'none' | 'circle' | 'rounded-rect' | 'hexagon' | 'diamond';
  width?: number;  // 0-1 relative to composition width
  height?: number; // 0-1 relative to composition height
}

/**
 * Cursor item - animated cursor overlay.
 */
export interface CursorItem extends Omit<BaseTimelineItem, 'keyframes'> {
  type: 'cursor';
  keyframes: CursorKeyframe[];
  cursorStyle?: 'pointer' | 'default' | 'hand';
  clickEffect?: 'ripple' | 'highlight' | 'none';
  scale?: number;
}

/**
 * Shape item - rectangles, circles, lines, gradients, dividers, badges.
 */
export type ShapeType = 'rectangle' | 'circle' | 'line' | 'gradient' | 'divider' | 'badge' | 'svg';

export interface ShapeItem extends BaseTimelineItem {
  type: 'shape';
  shapeType: ShapeType;
  width: number;       // 0-1 relative to composition width
  height: number;      // 0-1 relative to composition height
  position: { x: number; y: number }; // 0-1 relative coordinates
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  opacity?: number;
  // Gradient-specific
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: number; // degrees
  // Badge-specific
  text?: string;
  fontSize?: number;
  color?: string;
  // SVG-specific
  svgContent?: string; // Raw SVG markup (without outer <svg> tag)
  viewBox?: string;    // SVG viewBox e.g. "0 0 400 300"
}

/**
 * Particle type for particle effects.
 */
export type ParticleType = 'confetti' | 'sparks' | 'snow' | 'bubbles' | 'stars' | 'dust';

/**
 * Particle item - generates animated particle effects like confetti, sparks, snow.
 */
export interface ParticleItem extends BaseTimelineItem {
  type: 'particles';
  particleType: ParticleType;
  emitterPosition: { x: number; y: number }; // 0-1 relative to composition
  emitterSize?: { width: number; height: number }; // 0-1 relative, area from which particles spawn
  particleCount: number;
  colors: string[];
  speed: number; // Base speed multiplier (1 = default)
  gravity: number; // Gravity strength (0 = no gravity, 1 = normal)
  spread: number; // Emission angle spread in degrees (180 = semicircle, 360 = full circle)
  particleSize?: number; // Size of individual particles (1 = default)
  fadeOut?: boolean; // Whether particles fade out at end of life
  rotation?: boolean; // Whether particles rotate as they move
}

/**
 * Union type for all timeline items.
 * Discriminated on 'type' field.
 */
export type TimelineItem = ComponentItem | TextItem | MediaItem | ImageItem | CursorItem | ShapeItem | ParticleItem;

// =============================================
// Track
// =============================================

/**
 * Track containing timeline items.
 * Tracks are layered (first track = bottom, last = top).
 */
export interface Track {
  id: string;
  name: string;
  type: 'component' | 'text' | 'video' | 'audio' | 'image' | 'cursor' | 'shape' | 'particles';
  locked: boolean;
  visible: boolean;
  items: TimelineItem[];
}

// =============================================
// Composition
// =============================================

/**
 * Full composition representing a video project.
 * Contains multiple tracks with timeline items.
 */
export interface Composition {
  id: string;
  projectId: string;
  name: string;
  tracks: Track[];
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}
