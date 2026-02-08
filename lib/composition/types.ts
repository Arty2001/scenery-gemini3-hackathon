/**
 * TypeScript types for the composition system.
 * Defines the structure for multi-track video timelines.
 *
 * Animation patterns inspired by Remotion Lambda trailer:
 * - Spring physics with damping: 200 for smooth, controlled motion
 * - Staggered delays for multi-item sequences
 * - Scene transitions: Curtain, Wheel, Flip
 */

// =============================================
// Animation Types
// =============================================

/**
 * Animation presets inspired by Remotion Lambda trailer patterns.
 * - Basic: none, fade, slide, scale
 * - Spring-based: spring-scale (pop-in), spring-slide, spring-bounce
 * - Advanced: flip (3D card flip), zoom-blur (zoom with motion blur effect)
 */
export type AnimationType =
  | 'none'
  | 'fade'
  | 'slide'
  | 'scale'
  // Spring-based (natural physics motion - the trailer's core pattern)
  | 'spring-scale'    // Scale from 0 with spring physics (damping: 200) - THE signature animation
  | 'spring-slide'    // Slide with spring overshoot
  | 'spring-bounce'   // Bouncy scale (lower damping for playful feel)
  // Advanced
  | 'flip'            // 3D card flip (backface-visibility trick)
  | 'zoom-blur';      // Zoom in/out with blur fade effect

export type SlideDirection = 'left' | 'right' | 'top' | 'bottom';

/**
 * Spring configuration presets from Remotion trailer analysis.
 * The trailer consistently uses damping: 200 for controlled, non-bouncy motion.
 */
export type SpringPreset =
  | 'smooth'     // damping: 200, mass: 1 - standard controlled motion (default)
  | 'snappy'     // damping: 200, mass: 0.5 - quick, responsive
  | 'heavy'      // damping: 200, mass: 5 - slow, deliberate (zoom out effect)
  | 'bouncy'     // damping: 100, mass: 1 - playful with overshoot
  | 'gentle'     // damping: 300, mass: 2 - soft, subtle
  | 'wobbly';    // damping: 80, mass: 1 - lots of wobble/overshoot

/**
 * Custom spring physics configuration.
 * Allows fine-grained control over spring behavior.
 */
export interface SpringConfig {
  mass: number;       // 0.1 - 10 (default 1) - higher = slower, more deliberate
  stiffness: number;  // 1 - 1000 (default 100) - higher = snappier, quicker settle
  damping: number;    // 1 - 500 (default 10) - higher = less overshoot/bounce
  velocity?: number;  // Initial velocity (default 0)
}

export interface AnimationConfig {
  type: AnimationType;
  direction?: SlideDirection;
  durationInFrames?: number; // default 15
  springPreset?: SpringPreset; // Spring physics preset (default: 'smooth')
  staggerDelay?: number; // Frames to delay start (for staggered multi-item animations)
}

/**
 * Scene transition types for transitions between scenes/items.
 * Inspired by Remotion trailer: Curtain, Wheel, Flip transitions.
 */
export type SceneTransitionType =
  | 'fade'
  | 'slide'
  | 'curtain'       // Two panels slide apart to reveal content (trailer's Curtain.tsx)
  | 'wheel'         // Rotational swing in/out effect (trailer's WheelTransition.tsx)
  | 'flip'          // 3D card flip between scenes
  | 'wipe'          // Edge wipe transition
  | 'zoom'          // Zoom in/out transition
  | 'motion-blur';  // Fast motion blur effect

export interface TransitionConfig {
  type: SceneTransitionType;
  direction?: SlideDirection;
  durationInFrames: number;
  springPreset?: SpringPreset;
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
  // Spring physics (overrides easing when set)
  springPreset?: SpringPreset; // Use a spring preset
  springConfig?: SpringConfig; // Or custom spring configuration (takes precedence over preset)
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
  from: number; // Start frame (relative to composition, or relative to scene if sceneId is set)
  durationInFrames: number;
  sceneId?: string; // Optional: which scene this item belongs to (frame becomes relative to scene start)
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
  backgroundColor?: string; // Background color (hex, rgba, or 'transparent')
}

/**
 * Letter animation types for per-character text effects.
 */
export type LetterAnimationType =
  | 'fade'           // Fade in
  | 'slide-up'       // Slide up from below
  | 'slide-down'     // Slide down from above
  | 'slide-left'     // Slide in from left
  | 'slide-right'    // Slide in from right
  | 'scale'          // Scale up from small
  | 'scale-down'     // Scale down from large
  | 'blur'           // Blur to sharp
  | 'rotate'         // Rotate in
  | 'bounce'         // Bounce in
  | 'typewriter';    // Typewriter (instant appear)

export type TextAnimationMode = 'letter' | 'word';

export interface LetterAnimation {
  enabled: boolean;
  type: LetterAnimationType;
  mode?: TextAnimationMode;   // 'letter' (default) animates each character, 'word' animates each word
  staggerFrames: number;      // Frames delay between each unit (letter or word)
  durationPerLetter: number;  // Duration of each unit's animation in frames
  direction?: 'forward' | 'backward' | 'center' | 'random'; // Order units animate
  easing?: 'linear' | 'ease-out' | 'ease-in-out' | 'spring';
}

/**
 * Gradient fill configuration for text.
 */
export interface TextGradient {
  enabled: boolean;
  colors: GradientColorStop[];  // At least 2 color stops
  angle?: number;               // Gradient angle (0-360)
  animate?: boolean;            // Animate the gradient
  speed?: number;               // Animation speed
}

/**
 * Glow effect configuration.
 */
export interface GlowEffect {
  enabled: boolean;
  color: string;      // Glow color
  intensity: number;  // 0-1 strength
  size: number;       // Blur radius in px
  animate?: boolean;  // Pulse animation
  pulseSpeed?: number; // Pulse frequency (1 = default)
}

/**
 * Glass/Frosted effect configuration.
 */
export interface GlassEffect {
  enabled: boolean;
  blur: number;         // Backdrop blur in px (4-20 typical)
  opacity: number;      // Background opacity (0-1)
  tint?: string;        // Optional tint color
  saturation?: number;  // Backdrop saturation (1 = normal)
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
  maxWidth?: number; // Maximum width in pixels (default: 90% of composition)
  noWrap?: boolean; // If true, text stays on one line (no wrapping)
  letterAnimation?: LetterAnimation; // Per-letter animation settings
  // Advanced effects
  gradient?: TextGradient;    // Gradient fill for text
  glow?: GlowEffect;          // Glow effect around text
  glass?: GlassEffect;        // Glass/frosted background effect
}

/**
 * Media item - video or audio clip.
 */
export interface MediaItem extends BaseTimelineItem {
  type: 'video' | 'audio';
  src: string;
  volume: number; // 0-1
  startFrom: number; // Trim start frame
  endAt?: number; // Frame where the video actually ends (for freeze frame calculation)
  freezeAtEnd?: boolean; // If true, freeze on last frame when timeline extends past video duration
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
 * Gradient types for animated gradient backgrounds.
 */
export type GradientType = 'linear' | 'radial' | 'conic';

/**
 * A color stop in a gradient.
 */
export interface GradientColorStop {
  color: string;      // Hex or rgba color
  position: number;   // 0-100 percentage
}

/**
 * Animated gradient background item.
 * Creates beautiful, animated gradient backgrounds.
 */
export interface GradientItem extends BaseTimelineItem {
  type: 'gradient';
  gradientType: GradientType;
  colors: GradientColorStop[];  // At least 2 color stops
  angle?: number;               // For linear gradients (0-360 degrees)
  centerX?: number;             // For radial/conic (0-1, default 0.5)
  centerY?: number;             // For radial/conic (0-1, default 0.5)
  // Animation
  animate?: boolean;            // Enable animation
  animateAngle?: boolean;       // Rotate the gradient
  animateColors?: boolean;      // Shift colors through stops
  speed?: number;               // Animation speed (1 = default, 2 = twice as fast)
  // Size and position (covers full canvas by default)
  width?: number;               // 0-1 relative (default 1 = full width)
  height?: number;              // 0-1 relative (default 1 = full height)
  position?: { x: number; y: number }; // 0-1 relative (default 0.5, 0.5)
}

/**
 * Custom HTML item - user-imported HTML snippets processed by AI.
 * Shares the same display capabilities as ComponentItem.
 */
export interface CustomHtmlItem extends BaseTimelineItem {
  type: 'custom-html';
  customComponentId: string; // UUID reference to custom_components.id
  html: string; // The processed HTML to render
  displaySize?: 'phone' | 'laptop' | 'full'; // Device frame preset
  containerWidth?: number;  // Custom container width in px (overrides displaySize)
  containerHeight?: number; // Custom container height in px (overrides displaySize)
  objectFit?: 'contain' | 'cover' | 'fill'; // How content fits in container
  objectPosition?: string; // CSS object-position e.g. "top left", "center"
  position?: { x: number; y: number }; // Optional 0-1 relative position (default: centered 0.5, 0.5)
  backgroundColor?: string; // Background color (hex, rgba, or 'transparent')
}

/**
 * Film Grain effect - animated noise overlay for cinematic look.
 */
export interface FilmGrainItem extends BaseTimelineItem {
  type: 'film-grain';
  intensity: number;      // 0-1, how visible the grain is (default 0.3)
  speed: number;          // Animation speed multiplier (default 1)
  size: number;           // Grain size multiplier (default 1)
  colored: boolean;       // Colored grain vs monochrome (default false)
  blendMode: 'overlay' | 'soft-light' | 'multiply' | 'screen'; // Blend mode (default 'overlay')
}

/**
 * Vignette effect - darkened edges for focus and cinematic framing.
 */
export interface VignetteItem extends BaseTimelineItem {
  type: 'vignette';
  intensity: number;      // 0-1, how dark the edges are (default 0.5)
  size: number;           // 0-1, how far the vignette extends from edges (default 0.5)
  softness: number;       // 0-1, how soft the edge is (default 0.5)
  color?: string;         // Vignette color (default: black)
  shape: 'circular' | 'rectangular'; // Shape of vignette (default 'circular')
}

/**
 * Color Grading preset types.
 */
export type ColorGradePreset =
  | 'cinematic-teal-orange'  // Popular film look
  | 'vintage-warm'           // Retro warm tones
  | 'vintage-cool'           // Retro cool tones
  | 'noir'                   // Black and white with contrast
  | 'cyberpunk'              // Neon purple/pink
  | 'sunset'                 // Warm golden hour
  | 'moonlight'              // Cool blue night
  | 'sepia'                  // Classic sepia tone
  | 'custom';                // Custom adjustments

/**
 * Color Grading effect - LUT-style color adjustments.
 */
export interface ColorGradeItem extends BaseTimelineItem {
  type: 'color-grade';
  preset: ColorGradePreset;
  intensity: number;       // 0-1, blend with original (default 1)
  // Custom adjustments (used when preset is 'custom' or to tweak presets)
  brightness?: number;     // -1 to 1 (default 0)
  contrast?: number;       // -1 to 1 (default 0)
  saturation?: number;     // -1 to 1 (default 0)
  temperature?: number;    // -1 (cool) to 1 (warm) (default 0)
  tint?: number;           // -1 (green) to 1 (magenta) (default 0)
  shadows?: string;        // Color to add to shadows (hex)
  highlights?: string;     // Color to add to highlights (hex)
}

/**
 * Blob/Organic Shape animation style.
 */
export type BlobAnimationStyle = 'morph' | 'float' | 'pulse' | 'wave';

/**
 * Blob/Organic Shapes - animated organic blob backgrounds.
 */
export interface BlobItem extends BaseTimelineItem {
  type: 'blob';
  colors: string[];        // Array of colors for gradient fill
  blobCount: number;       // Number of blob layers (default 3)
  complexity: number;      // 0-1, how complex the blob shape is (default 0.5)
  animationStyle: BlobAnimationStyle; // Animation type (default 'morph')
  speed: number;           // Animation speed (default 1)
  opacity: number;         // Overall opacity (default 0.8)
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay'; // Blend mode (default 'normal')
  position?: { x: number; y: number }; // Center position 0-1 (default 0.5, 0.5)
  scale?: number;          // Scale multiplier (default 1)
}

/**
 * Union type for all timeline items.
 * Discriminated on 'type' field.
 */
export type TimelineItem = ComponentItem | TextItem | MediaItem | ImageItem | CursorItem | ShapeItem | ParticleItem | CustomHtmlItem | GradientItem | FilmGrainItem | VignetteItem | ColorGradeItem | BlobItem;

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
  type: 'component' | 'text' | 'video' | 'audio' | 'image' | 'cursor' | 'shape' | 'particles' | 'custom-html' | 'gradient' | 'film-grain' | 'vignette' | 'color-grade' | 'blob';
  locked: boolean;
  visible: boolean;
  items: TimelineItem[];
}

// =============================================
// Scene
// =============================================

/**
 * Scene/Slide in a composition.
 * Scenes provide a way to organize compositions into discrete sections (like slides).
 * Each scene has its own time range and can have a transition when entering from the previous scene.
 */
export interface Scene {
  id: string;
  name: string;
  startFrame: number;        // When this scene starts in the composition timeline
  durationInFrames: number;  // Duration of this scene
  transition?: TransitionConfig; // Transition when entering this scene from the previous scene
  backgroundColor?: string;  // Scene-specific background color (overrides composition background)
}

// =============================================
// Composition
// =============================================

/**
 * Full composition representing a video project.
 * Contains multiple tracks with timeline items.
 * Optionally contains scenes for slide-based editing.
 */
export interface Composition {
  id: string;
  projectId: string;
  name: string;
  tracks: Track[];
  scenes?: Scene[];  // Optional: scenes for slide-based editing
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}
