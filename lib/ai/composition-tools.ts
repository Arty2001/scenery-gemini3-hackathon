import { Type } from '@google/genai';
import { useCompositionStore } from '@/lib/composition/store';
import type { TextItem, ComponentItem, ShapeItem, CursorItem, MediaItem, ImageItem, PropertyKeyframe, ParticleItem, ParticleType, LetterAnimationType, LetterAnimation, GradientItem, GradientColorStop, SpringPreset, SpringConfig, Scene, SceneTransitionType, FilmGrainItem, VignetteItem, ColorGradeItem, ColorGradePreset, BlobItem, BlobAnimationStyle } from '@/lib/composition/types';
import { applyPreset } from '@/lib/animation-presets';
import { pathToKeyframes, getMotionPathPreset, type MotionPath, type PathPoint, type MotionPathPreset } from '@/components/remotion/animation/motion-path';

// Type for the store instance (outside React)
type CompositionStoreApi = ReturnType<typeof useCompositionStore.getState>;

/**
 * Track layer priority for automatic z-ordering.
 * Lower numbers render FIRST (bottom layer), higher numbers render LAST (top layer).
 *
 * Layer order (bottom to top):
 * 0: Background effects (gradient, blob)
 * 1: Post-processing effects (film-grain, vignette, color-grade) - usually placed over backgrounds
 * 2: Media (video, image)
 * 3: Components (component, custom-html)
 * 4: Shapes
 * 5: Text overlays
 * 6: Particles (usually top layer for celebrations)
 * 7: Cursor (always on top for tutorials)
 * 8: Audio (no visual, doesn't matter)
 */
function getTrackLayerPriority(type: string): number {
  switch (type) {
    case 'gradient':
    case 'blob':
      return 0; // Background effects at bottom
    case 'film-grain':
    case 'vignette':
    case 'color-grade':
      return 1; // Post-processing effects
    case 'video':
    case 'image':
      return 2; // Media
    case 'component':
    case 'custom-html':
      return 3; // Components
    case 'shape':
      return 4; // Shapes
    case 'text':
      return 5; // Text overlays
    case 'particles':
      return 6; // Particles (often over everything)
    case 'cursor':
      return 7; // Cursor always on top
    case 'audio':
      return 8; // Audio has no visual
    default:
      return 5; // Default to middle
  }
}

/**
 * Find the correct index to insert a track based on its type for proper layering.
 * Tracks are rendered in order - earlier tracks are at the bottom, later tracks are on top.
 */
function findTrackInsertIndex(tracks: { type: string }[], newType: string): number {
  const newPriority = getTrackLayerPriority(newType);

  // Find the first track with higher priority (should be rendered after/above the new track)
  for (let i = 0; i < tracks.length; i++) {
    const existingPriority = getTrackLayerPriority(tracks[i].type);
    if (existingPriority > newPriority) {
      return i; // Insert before this track
    }
  }

  // No higher priority track found, append at end
  return tracks.length;
}

/** Call store.addTrack with smart layer positioning then return the newly created track */
function addTrackAndGet(store: CompositionStoreApi, track: Parameters<CompositionStoreApi['addTrack']>[0]) {
  const currentTracks = useCompositionStore.getState().tracks;
  const insertIndex = findTrackInsertIndex(currentTracks, track.type);

  // Add the track
  store.addTrack(track);

  // Get the newly added track (it's at the end after addTrack)
  const freshTracks = useCompositionStore.getState().tracks;
  const newTrack = freshTracks[freshTracks.length - 1];

  // Reorder to correct position if needed
  if (insertIndex < freshTracks.length - 1 && newTrack) {
    store.reorderTrack(newTrack.id, insertIndex);
  }

  // Return the track from fresh state
  const finalTracks = useCompositionStore.getState().tracks;
  return finalTracks.find(t => t.id === newTrack?.id) ?? finalTracks[finalTracks.length - 1];
}

// =============================================
// Function Declarations for Gemini
// =============================================

const updateItemDuration = {
  name: 'update_item_duration',
  description: 'Update the duration of a timeline item.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackId: { type: Type.STRING, description: 'The track ID containing the item' },
      itemId: { type: Type.STRING, description: 'The item ID to update' },
      durationInFrames: { type: Type.NUMBER, description: 'New duration in frames' },
    },
    required: ['trackId', 'itemId', 'durationInFrames'],
  },
};

const addTextOverlay = {
  name: 'add_text_overlay',
  description: 'Add a text overlay to the composition. Creates a text track if needed.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING, description: 'The text content' },
      fontSize: { type: Type.NUMBER, description: 'Font size in pixels (default 48)' },
      positionX: { type: Type.NUMBER, description: 'X position 0-1 (default 0.5)' },
      positionY: { type: Type.NUMBER, description: 'Y position 0-1 (default 0.5)' },
      from: { type: Type.NUMBER, description: 'Start frame' },
      durationInFrames: { type: Type.NUMBER, description: 'Duration in frames' },
      color: { type: Type.STRING, description: 'Text color as hex string (default #ffffff). Use contrasting colors against the black background and any underlying components.' },
      fontWeight: { type: Type.NUMBER, description: 'Font weight (100-900). Default 400. Use 700-800 for titles.' },
      backgroundColor: { type: Type.STRING, description: 'Optional background color behind the text (e.g. "rgba(0,0,0,0.6)" for a semi-transparent dark pill). Auto-applies padding and border-radius for a polished look.' },
      padding: { type: Type.NUMBER, description: 'Padding in px around text (auto 14 when backgroundColor is set).' },
      borderRadius: { type: Type.NUMBER, description: 'Border radius in px for text background pill (auto 10 when backgroundColor is set).' },
      textShadow: { type: Type.STRING, description: 'CSS text-shadow for readability (default: "0 2px 12px rgba(0,0,0,0.6)" when no backgroundColor). Set "none" to disable.' },
      letterSpacing: { type: Type.NUMBER, description: 'Letter spacing in px. Use 1-3 for titles, -0.5 for body.' },
      lineHeight: { type: Type.NUMBER, description: 'Line height multiplier (e.g. 1.2 for tight, 1.6 for spacious).' },
      textAlign: { type: Type.STRING, description: 'Text alignment: "left", "center", or "right". Default "left".' },
      maxWidth: { type: Type.NUMBER, description: 'Maximum width of text box in pixels (default: 90% of video width). Use to constrain wide text blocks.' },
      noWrap: { type: Type.BOOLEAN, description: 'If true, text stays on one line without wrapping. Default false.' },
      // Letter/word animation
      letterAnimation: { type: Type.BOOLEAN, description: 'Enable per-letter or per-word animation for dynamic text reveals. Great for titles and emphasis. Default false.' },
      letterAnimationMode: { type: Type.STRING, description: 'Animation unit: "letter" (animate each character) or "word" (animate each word). "word" mode is better for sentences, "letter" for short titles. Default "letter".' },
      letterAnimationType: { type: Type.STRING, description: 'Animation effect: "fade", "slide-up", "slide-down", "slide-left", "slide-right", "scale", "scale-down", "blur", "rotate", "bounce", "typewriter". Default "fade".' },
      letterAnimationDirection: { type: Type.STRING, description: 'Animation order: "forward" (left-to-right), "backward" (right-to-left), "center" (center outward), "random". Default "forward".' },
      letterStagger: { type: Type.NUMBER, description: 'Frames delay between each unit animation (1-10). Lower = faster cascade. Default 2.' },
      letterDuration: { type: Type.NUMBER, description: 'Duration of each unit animation in frames (5-30). Default 10.' },
      letterEasing: { type: Type.STRING, description: 'Animation easing: "linear", "ease-out", "ease-in-out", "spring". Default "ease-out".' },
    },
    required: ['text', 'from', 'durationInFrames'],
  },
};

const keyframeSchema = {
  type: Type.OBJECT,
  properties: {
    frame: { type: Type.NUMBER, description: 'Frame offset relative to item start (0 = first frame of item)' },
    values: {
      type: Type.OBJECT,
      description: 'Numeric property values at this keyframe',
      properties: {
        // Transform properties
        positionX: { type: Type.NUMBER, description: 'X position 0-1' },
        positionY: { type: Type.NUMBER, description: 'Y position 0-1' },
        scale: { type: Type.NUMBER, description: 'Scale (1=normal)' },
        rotation: { type: Type.NUMBER, description: 'Rotation in degrees' },
        skewX: { type: Type.NUMBER, description: 'Skew X in degrees (-45 to 45)' },
        skewY: { type: Type.NUMBER, description: 'Skew Y in degrees (-45 to 45)' },
        // Size properties
        width: { type: Type.NUMBER, description: 'Width 0-1 relative (shapes)' },
        height: { type: Type.NUMBER, description: 'Height 0-1 relative (shapes)' },
        // Opacity
        opacity: { type: Type.NUMBER, description: 'Opacity 0-1' },
        // Filter effects
        blur: { type: Type.NUMBER, description: 'CSS blur in px (0-50). Great for depth of field and focus effects.' },
        brightness: { type: Type.NUMBER, description: 'Brightness (0-3, 1=normal). Use for flash effects.' },
        contrast: { type: Type.NUMBER, description: 'Contrast (0-3, 1=normal)' },
        saturate: { type: Type.NUMBER, description: 'Saturation (0-3, 1=normal). 0 for grayscale, >1 for vibrant.' },
        hueRotate: { type: Type.NUMBER, description: 'Hue rotation in degrees (0-360)' },
        // Shadow effects
        shadowBlur: { type: Type.NUMBER, description: 'Shadow blur radius in px (0-100)' },
        shadowOffsetX: { type: Type.NUMBER, description: 'Shadow X offset in px (-100 to 100)' },
        shadowOffsetY: { type: Type.NUMBER, description: 'Shadow Y offset in px (-100 to 100)' },
        shadowOpacity: { type: Type.NUMBER, description: 'Shadow opacity (0-1)' },
        // Text properties
        fontSize: { type: Type.NUMBER, description: 'Font size in px' },
        letterSpacing: { type: Type.NUMBER, description: 'Letter spacing in px (-10 to 50)' },
        // Shape/SVG properties
        progress: { type: Type.NUMBER, description: 'SVG draw progress 0-1 (for stroke animations)' },
        borderRadius: { type: Type.NUMBER, description: 'Border radius in px (0-100)' },
        strokeWidth: { type: Type.NUMBER, description: 'Stroke width in px (0-20)' },
      },
    },
    easing: { type: Type.STRING, description: 'Easing to reach this keyframe: "linear", "ease-in", "ease-out", "ease-in-out", "spring". Default: "ease-out"' },
    springPreset: { type: Type.STRING, description: 'Spring physics preset (overrides easing): "smooth" (controlled), "snappy" (quick), "heavy" (slow), "bouncy" (playful), "gentle" (soft), "wobbly" (extreme bounce). Creates natural, organic motion.' },
    springConfig: {
      type: Type.OBJECT,
      description: 'Custom spring physics config (overrides preset). Use for fine-tuned control over motion feel.',
      properties: {
        mass: { type: Type.NUMBER, description: 'Mass affects inertia (0.1-10, default 1). Higher = slower, heavier feel.' },
        stiffness: { type: Type.NUMBER, description: 'Spring tension (1-1000, default 100). Higher = faster snap.' },
        damping: { type: Type.NUMBER, description: 'Friction/resistance (1-500, default 10). Higher = less bounce.' },
      },
    },
  },
  required: ['frame', 'values'],
};

const addKeyframes = {
  name: 'add_keyframes',
  description: 'Add keyframe animations to an existing timeline item. IMPORTANT: Frame values are RELATIVE to the item start (frame 0 = when item first appears, NOT video start). Example: To fade in over 20 frames, use [{frame: 0, values: {opacity: 0}}, {frame: 20, values: {opacity: 1}}]. For position keyframes, use the item\'s current position as base (don\'t hardcode 0.5).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackId: { type: Type.STRING, description: 'The track ID containing the item' },
      itemId: { type: Type.STRING, description: 'The item ID to animate' },
      keyframes: { type: Type.ARRAY, description: 'Array of keyframes. Each keyframe: frame (RELATIVE to item start, 0 = first frame of item), values, easing.', items: keyframeSchema },
    },
    required: ['trackId', 'itemId', 'keyframes'],
  },
};

const removeItem = {
  name: 'remove_item',
  description: 'Remove an item from a track.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackId: { type: Type.STRING, description: 'The track ID' },
      itemId: { type: Type.STRING, description: 'The item ID to remove' },
    },
    required: ['trackId', 'itemId'],
  },
};

const moveItem = {
  name: 'move_item',
  description: 'Move an item to a new start frame within its track.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackId: { type: Type.STRING, description: 'The track ID' },
      itemId: { type: Type.STRING, description: 'The item ID to move' },
      newFrom: { type: Type.NUMBER, description: 'New start frame' },
    },
    required: ['trackId', 'itemId', 'newFrom'],
  },
};

const updateItemProps = {
  name: 'update_item_props',
  description: 'Update properties of a timeline item (e.g., text, color, fontSize).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackId: { type: Type.STRING, description: 'The track ID' },
      itemId: { type: Type.STRING, description: 'The item ID' },
      props: { type: Type.OBJECT, description: 'Properties to update', properties: {} },
    },
    required: ['trackId', 'itemId', 'props'],
  },
};

const addTransition = {
  name: 'add_transition',
  description: 'Add a transition effect to an item.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackId: { type: Type.STRING, description: 'The track ID' },
      itemId: { type: Type.STRING, description: 'The item ID' },
      type: { type: Type.STRING, description: 'Transition type: fade, slide, or scale' },
      direction: { type: Type.STRING, description: 'Direction for slide: left, right, top, bottom' },
      durationInFrames: { type: Type.NUMBER, description: 'Transition duration in frames' },
    },
    required: ['trackId', 'itemId', 'type', 'durationInFrames'],
  },
};

const addComponent = {
  name: 'add_component',
  description: 'Add a discovered React component to the timeline. Use the componentId from the Available Components list. The component will render with its demo props by default.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      componentId: { type: Type.STRING, description: 'The component UUID from the Available Components list' },
      componentName: { type: Type.STRING, description: 'The component name (for logging)' },
      from: { type: Type.NUMBER, description: 'Start frame (default: current playhead position)' },
      durationInFrames: { type: Type.NUMBER, description: 'Duration in frames (default: 150)' },
      displaySize: { type: Type.STRING, description: 'Device frame preset: phone (375x812), laptop (1280x800), or full (stretch). Default: laptop' },
      containerWidth: { type: Type.NUMBER, description: 'Custom container width in px (overrides displaySize)' },
      containerHeight: { type: Type.NUMBER, description: 'Custom container height in px (overrides displaySize)' },
      objectPosition: { type: Type.STRING, description: 'Alignment inside container: "center center", "top left", "bottom right", etc. Default: center center' },
      props: { type: Type.OBJECT, description: 'Override props for the component (optional)', properties: {} },
    },
    required: ['componentId'],
  },
};

const addCustomHtml = {
  name: 'add_custom_html',
  description: 'Add a custom HTML component (imported by the user) to the timeline. Use the customComponentId from the Custom HTML Components list. Great for screenshots, mockups, or pre-styled UI elements.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      customComponentId: { type: Type.STRING, description: 'The custom component UUID from the Custom HTML Components list' },
      customComponentName: { type: Type.STRING, description: 'The component name (for logging)' },
      from: { type: Type.NUMBER, description: 'Start frame (default: 0)' },
      durationInFrames: { type: Type.NUMBER, description: 'Duration in frames (default: 150)' },
      displaySize: { type: Type.STRING, description: 'Device frame preset: phone (375x812), laptop (1280x800), or full (stretch). Default: laptop' },
      containerWidth: { type: Type.NUMBER, description: 'Custom container width in px (overrides displaySize)' },
      containerHeight: { type: Type.NUMBER, description: 'Custom container height in px (overrides displaySize)' },
      objectFit: { type: Type.STRING, description: 'How content fits: contain, cover, or fill. Default: contain' },
      objectPosition: { type: Type.STRING, description: 'Position inside container: "center", "top left", etc. Default: center' },
      positionX: { type: Type.NUMBER, description: 'X position 0-1 (default 0.5 = centered)' },
      positionY: { type: Type.NUMBER, description: 'Y position 0-1 (default 0.5 = centered)' },
      backgroundColor: { type: Type.STRING, description: 'Background color (hex, rgba, or "transparent"). Default: transparent' },
    },
    required: ['customComponentId'],
  },
};

const addShape = {
  name: 'add_shape',
  description: 'Add a shape element to the timeline (rectangle, circle, line, gradient, divider, or badge). Use for backgrounds, decorative elements, separators, and labels.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      shapeType: { type: Type.STRING, description: 'Shape type: "rectangle", "circle", "line", "gradient", "divider", or "badge"' },
      width: { type: Type.NUMBER, description: 'Width relative to composition (0-1). E.g. 0.4 = 40% width.' },
      height: { type: Type.NUMBER, description: 'Height relative to composition (0-1). E.g. 0.25 = 25% height.' },
      positionX: { type: Type.NUMBER, description: 'X position 0-1 (default 0.5 = centered)' },
      positionY: { type: Type.NUMBER, description: 'Y position 0-1 (default 0.5 = centered)' },
      from: { type: Type.NUMBER, description: 'Start frame' },
      durationInFrames: { type: Type.NUMBER, description: 'Duration in frames' },
      fill: { type: Type.STRING, description: 'Fill color (hex). Default "#6366f1".' },
      stroke: { type: Type.STRING, description: 'Stroke/border color (hex). Optional.' },
      strokeWidth: { type: Type.NUMBER, description: 'Stroke width in px. Default 2.' },
      borderRadius: { type: Type.NUMBER, description: 'Border radius in px. Use 999 for pill shape.' },
      opacity: { type: Type.NUMBER, description: 'Opacity 0-1. Default 1.' },
      gradientFrom: { type: Type.STRING, description: 'Gradient start color (for shapeType "gradient").' },
      gradientTo: { type: Type.STRING, description: 'Gradient end color (for shapeType "gradient").' },
      gradientDirection: { type: Type.NUMBER, description: 'Gradient angle in degrees (default 135).' },
      text: { type: Type.STRING, description: 'Text inside badge (for shapeType "badge").' },
      fontSize: { type: Type.NUMBER, description: 'Font size for badge text.' },
      color: { type: Type.STRING, description: 'Text color for badge.' },
    },
    required: ['shapeType', 'width', 'height', 'from', 'durationInFrames'],
  },
};

const addCursor = {
  name: 'add_cursor',
  description: 'Add an animated cursor overlay that moves between elements and performs interactions. PREFERRED: Use "target" with a CSS selector - the cursor automatically positions itself to that element! This is the BEST way to create tutorials. Use interactiveElements from component context to find valid selectors.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      from: { type: Type.NUMBER, description: 'Start frame for the cursor' },
      durationInFrames: { type: Type.NUMBER, description: 'How long the cursor is visible' },
      cursorStyle: { type: Type.STRING, description: '"default" (arrow), "pointer" (finger), or "hand". Default: "default"' },
      clickEffect: { type: Type.STRING, description: '"ripple" (blue ring), "highlight" (yellow glow), or "none". Default: "ripple"' },
      scale: { type: Type.NUMBER, description: 'Cursor size multiplier. Default: 1' },
      keyframes: {
        type: Type.ARRAY,
        description: 'Array of cursor positions and interactions. PREFERRED: Use "target" with a CSS selector to auto-position cursor to elements. The cursor will automatically find and move to the targeted element.',
        items: {
          type: Type.OBJECT,
          properties: {
            frame: { type: Type.NUMBER, description: 'Frame number (relative to cursor item start, 0 = first frame cursor appears)' },
            target: {
              type: Type.STRING,
              description: 'PREFERRED: CSS selector to auto-position cursor to. The cursor moves to this element\'s center automatically. Examples: "button[data-testid=submit]", "input[name=email]", "button", ".cta-button". Use this instead of x/y coordinates!'
            },
            targetOffset: {
              type: Type.OBJECT,
              description: 'Optional offset from target center in pixels (for fine-tuning)',
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
              },
            },
            action: {
              type: Type.STRING,
              description: 'Interaction action for the target element: "click", "hover", "type", "focus", "select", "check". Required if target is set.'
            },
            value: {
              type: Type.STRING,
              description: 'For "type" action: text to type. For "select" action: option value.'
            },
            speed: {
              type: Type.NUMBER,
              description: 'For "type" action: frames per character (1 = fast typing, 2 = deliberate, 3 = slow). Default: 1'
            },
            holdDuration: {
              type: Type.NUMBER,
              description: 'Frames to hold the visual effect after completing (for click/hover/type). Default: 8 for click, 15 for hover.'
            },
            click: { type: Type.BOOLEAN, description: 'Show click visual effect at this position' },
            // Legacy: manual positioning (fallback if target not available)
            x: { type: Type.NUMBER, description: 'Fallback: X position in pixels if target not found' },
            y: { type: Type.NUMBER, description: 'Fallback: Y position in pixels if target not found' },
            relX: { type: Type.NUMBER, description: 'Fallback: X position 0-1 relative' },
            relY: { type: Type.NUMBER, description: 'Fallback: Y position 0-1 relative' },
          },
          required: ['frame'],
        },
      },
    },
    required: ['from', 'durationInFrames', 'keyframes'],
  },
};

const addSvg = {
  name: 'add_svg',
  description: 'Add an animated SVG graphic to the timeline. Use for charts, graphs, icons, diagrams, arrows, or any custom vector graphics. Supports stroke draw-on animation via the "progress" keyframe (0→1 draws the SVG). Provide raw SVG inner content (paths, lines, etc.) — the outer <svg> tag is added automatically.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      svgContent: { type: Type.STRING, description: 'Raw SVG markup (paths, lines, circles, etc.) WITHOUT the outer <svg> tag. All stroke elements get automatic draw-on animation. Example: \'<path d="M10,80 Q52,10 95,80" stroke="#6366f1" stroke-width="3" fill="none"/>\'' },
      viewBox: { type: Type.STRING, description: 'SVG viewBox attribute, e.g. "0 0 400 300". Default: "0 0 {width} {height}" based on size.' },
      width: { type: Type.NUMBER, description: 'Width 0-1 relative to composition (default 0.5)' },
      height: { type: Type.NUMBER, description: 'Height 0-1 relative to composition (default 0.4)' },
      positionX: { type: Type.NUMBER, description: 'X position 0-1 (default 0.5)' },
      positionY: { type: Type.NUMBER, description: 'Y position 0-1 (default 0.5)' },
      from: { type: Type.NUMBER, description: 'Start frame' },
      durationInFrames: { type: Type.NUMBER, description: 'Duration in frames' },
      drawDuration: { type: Type.NUMBER, description: 'Number of frames for the draw-on animation (default: 60). Creates keyframes from progress 0→1 over this many frames.' },
      fill: { type: Type.STRING, description: 'Background fill behind the SVG (default: transparent)' },
    },
    required: ['svgContent', 'from', 'durationInFrames'],
  },
};

const addMedia = {
  name: 'add_media',
  description: 'Add a video or image to the timeline with optional positioning, sizing, and shape clipping. Use for background videos, floating images, logo placements, avatar clips, etc.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      src: { type: Type.STRING, description: 'URL of the video or image file' },
      mediaType: { type: Type.STRING, description: '"video" or "image"' },
      from: { type: Type.NUMBER, description: 'Start frame' },
      durationInFrames: { type: Type.NUMBER, description: 'Duration in frames' },
      positionX: { type: Type.NUMBER, description: 'X position 0-1 (default 0.5 = centered)' },
      positionY: { type: Type.NUMBER, description: 'Y position 0-1 (default 0.5 = centered)' },
      width: { type: Type.NUMBER, description: 'Width 0-1 relative to composition (default 1.0 = full width)' },
      height: { type: Type.NUMBER, description: 'Height 0-1 relative to composition (default 1.0 = full height)' },
      clipShape: { type: Type.STRING, description: 'Clip into shape: "none", "circle", "rounded-rect", "hexagon", "diamond". Default: "none"' },
      volume: { type: Type.NUMBER, description: 'Volume 0-1 for video (default 1)' },
    },
    required: ['src', 'mediaType', 'from', 'durationInFrames'],
  },
};

const clearComposition = {
  name: 'clear_composition',
  description: 'Remove ALL tracks, items, and scenes from the timeline, giving a blank slate. Use this before generating a new video or when the user asks to start over / clear everything.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const removeTrack = {
  name: 'remove_track',
  description: 'Remove a track and all its items from the timeline.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackId: { type: Type.STRING, description: 'The track ID to remove' },
    },
    required: ['trackId'],
  },
};

const reorderTrack = {
  name: 'reorder_track',
  description: 'Move a track to a new position in the track list. Tracks are layered by order: earlier tracks render at the bottom (background), later tracks render on top (foreground). Use this to fix layering issues like backgrounds covering content, or cursors being hidden behind components.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackId: { type: Type.STRING, description: 'The track ID to move' },
      newIndex: { type: Type.NUMBER, description: 'New position index (0 = bottom/first rendered, higher = on top)' },
    },
    required: ['trackId', 'newIndex'],
  },
};

const generateProductVideo = {
  name: 'generate_product_video',
  description: 'Generate a complete product showcase video that displays React components alongside descriptive text overlays. Use this when the user asks to create a product video, demo, feature showcase, walkthrough, OR provides a script/voiceover text. This tool creates a full multi-section video with components, text animations, and narration. When the user provides a script, use it as the description - the Director Agent will break it into scenes.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      description: { type: Type.STRING, description: 'What the video should showcase, OR a complete voiceover script. Include any style/tone instructions. The Director Agent will parse scripts into scenes automatically.' },
      durationInSeconds: { type: Type.NUMBER, description: 'Desired total video duration in seconds. Minimum 10 seconds. Default: 5 seconds per component + 5 for intro/outro. A typical product video is 30-60 seconds, but shorter hook videos (15-30s) are also valid.' },
      includeVoiceover: { type: Type.BOOLEAN, description: 'Default FALSE. Set true when the user provides a voiceover script or explicitly asks for narration/audio.' },
      voiceName: { type: Type.STRING, description: 'Voice for narration: "Kore" (default), "Charon", "Fenrir", "Aoede", or "Puck"' },
    },
    required: ['description'],
  },
};

const generateComposition = {
  name: 'generate_composition',
  description:
    'Generate a complete new composition from a natural language description. Use this when the user wants to create a new video from scratch with TEXT ONLY (no components).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      description: { type: Type.STRING, description: 'Natural language description of the desired video composition' },
      width: { type: Type.NUMBER, description: 'Video width (default 1920)' },
      height: { type: Type.NUMBER, description: 'Video height (default 1080)' },
      fps: { type: Type.NUMBER, description: 'Frames per second (default 30)' },
      durationInFrames: { type: Type.NUMBER, description: 'Total duration in frames (default 900)' },
    },
    required: ['description'],
  },
};

const applyAnimationPreset = {
  name: 'apply_animation_preset',
  description: 'Apply a professional animation preset to an existing timeline item. Presets include entrance animations (fade-in, slide-in, bounce, elastic, blur-in), exit animations (fade-out, zoom-out, blur-out), emphasis effects (pulse, shake, wiggle, heartbeat, glow), and filter effects (color-pop, flash, cinematic-focus).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackId: { type: Type.STRING, description: 'The track ID containing the item' },
      itemId: { type: Type.STRING, description: 'The item ID to animate' },
      preset: {
        type: Type.STRING,
        description: 'Preset name: "fade-in", "fade-out", "slide-in-left", "slide-in-right", "slide-in-up", "slide-in-down", "zoom-in", "zoom-out", "bounce", "elastic", "spring-pop", "blur-in", "blur-out", "flip-in", "rotate-in", "pulse", "shake", "wiggle", "heartbeat", "jello", "glow", "float", "drift-right", "ken-burns-zoom", "color-pop", "flash", "hue-shift", "cinematic-focus"'
      },
      durationInFrames: { type: Type.NUMBER, description: 'Override the default duration of the preset (optional)' },
      intensity: { type: Type.NUMBER, description: 'Scale the effect intensity 0.5-2 (optional, default 1)' },
    },
    required: ['trackId', 'itemId', 'preset'],
  },
};

const addCameraMovement = {
  name: 'add_camera_movement',
  description: 'Apply cinematic camera-like movement to one or more items. Creates professional zoom, pan, drift, or shake effects. If no itemIds provided, applies to ALL visible items for a global camera feel.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      type: {
        type: Type.STRING,
        description: 'Camera movement type: "zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down", "shake", "drift", "ken-burns"'
      },
      itemIds: {
        type: Type.ARRAY,
        description: 'Array of {trackId, itemId} objects. If omitted, applies to all items.',
        items: {
          type: Type.OBJECT,
          properties: {
            trackId: { type: Type.STRING },
            itemId: { type: Type.STRING },
          },
          required: ['trackId', 'itemId'],
        },
      },
      intensity: { type: Type.NUMBER, description: 'Effect intensity 0.1-1 (default 0.5)' },
      durationInFrames: { type: Type.NUMBER, description: 'Duration of the camera movement' },
      startFrame: { type: Type.NUMBER, description: 'Frame to start the camera movement (relative to composition start)' },
      easing: { type: Type.STRING, description: 'Easing type: "linear", "ease-in", "ease-out", "ease-in-out". Default: "ease-out"' },
    },
    required: ['type', 'durationInFrames', 'startFrame'],
  },
};

const addStaggerAnimation = {
  name: 'add_stagger_animation',
  description: 'Apply staggered animations to multiple items for choreographed, sequential reveals. Each item starts its animation with a delay after the previous one. Great for list items, grid entries, or sequential text reveals.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: 'Array of {trackId, itemId} objects in the order they should animate',
        items: {
          type: Type.OBJECT,
          properties: {
            trackId: { type: Type.STRING },
            itemId: { type: Type.STRING },
          },
          required: ['trackId', 'itemId'],
        },
      },
      animation: {
        type: Type.OBJECT,
        description: 'The animation to apply to each item',
        properties: {
          property: { type: Type.STRING, description: 'Property to animate: "opacity", "positionX", "positionY", "scale", "blur", etc.' },
          from: { type: Type.NUMBER, description: 'Starting value' },
          to: { type: Type.NUMBER, description: 'Ending value' },
          durationPerItem: { type: Type.NUMBER, description: 'Duration in frames for each item\'s animation' },
          easing: { type: Type.STRING, description: 'Easing type. Default: "ease-out"' },
        },
        required: ['property', 'from', 'to', 'durationPerItem'],
      },
      staggerDelay: { type: Type.NUMBER, description: 'Frames between each item\'s animation start (e.g., 10 = each item starts 10 frames after the previous)' },
      direction: { type: Type.STRING, description: '"forward" (first to last), "reverse" (last to first), "center-out" (middle first), "random"' },
    },
    required: ['items', 'animation', 'staggerDelay'],
  },
};

const addMotionPath = {
  name: 'add_motion_path',
  description: 'Move an item along a curved bezier path for organic, flowing motion. Great for flying logos, orbiting elements, or any non-linear movement. Can use preset paths or define custom bezier curves.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackId: { type: Type.STRING, description: 'The track ID containing the item' },
      itemId: { type: Type.STRING, description: 'The item ID to animate' },
      preset: {
        type: Type.STRING,
        description: 'Use a preset path: "arc-left-to-right", "arc-right-to-left", "wave", "figure-8", "bounce-path", "spiral-in". Or omit to use custom path points.'
      },
      path: {
        type: Type.ARRAY,
        description: 'Custom path points. Each point has x/y (0-1) and optional bezier control points.',
        items: {
          type: Type.OBJECT,
          properties: {
            x: { type: Type.NUMBER, description: 'X position 0-1' },
            y: { type: Type.NUMBER, description: 'Y position 0-1' },
            controlPoint1: {
              type: Type.OBJECT,
              description: 'Outgoing bezier control point (optional)',
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
              },
            },
            controlPoint2: {
              type: Type.OBJECT,
              description: 'Incoming bezier control point (optional)',
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
              },
            },
          },
          required: ['x', 'y'],
        },
      },
      durationInFrames: { type: Type.NUMBER, description: 'Duration of the motion path animation' },
      autoRotate: { type: Type.BOOLEAN, description: 'Rotate item to follow path direction (default: false)' },
      easing: { type: Type.STRING, description: 'Easing: "linear", "ease-in", "ease-out", "ease-in-out". Default: "ease-out"' },
    },
    required: ['trackId', 'itemId', 'durationInFrames'],
  },
};

const addParticles = {
  name: 'add_particles',
  description: 'Add particle effects like confetti, sparks, snow, bubbles, stars, or dust. Creates celebratory, ambient, or attention-grabbing visual effects.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      particleType: {
        type: Type.STRING,
        description: 'Type of particles: "confetti" (celebration), "sparks" (energy/action), "snow" (ambient/winter), "bubbles" (playful/underwater), "stars" (magical/space), "dust" (subtle/ethereal)'
      },
      from: { type: Type.NUMBER, description: 'Start frame' },
      durationInFrames: { type: Type.NUMBER, description: 'Duration in frames' },
      emitterX: { type: Type.NUMBER, description: 'Emitter X position 0-1 (default 0.5 = center)' },
      emitterY: { type: Type.NUMBER, description: 'Emitter Y position 0-1 (default 0.5 = center)' },
      emitterWidth: { type: Type.NUMBER, description: 'Emitter width 0-1 (default 0 = point source). Use 1 for full-width snow/confetti' },
      emitterHeight: { type: Type.NUMBER, description: 'Emitter height 0-1 (default 0 = point source)' },
      particleCount: { type: Type.NUMBER, description: 'Number of particles (default 50). More = denser effect.' },
      colors: {
        type: Type.ARRAY,
        description: 'Array of color hex strings. Default varies by type (confetti = rainbow, sparks = warm, snow = white, etc.)',
        items: { type: Type.STRING },
      },
      speed: { type: Type.NUMBER, description: 'Speed multiplier (default 1). Higher = faster particles.' },
      gravity: { type: Type.NUMBER, description: 'Gravity strength (default 1). 0 = no gravity, negative = float up.' },
      spread: { type: Type.NUMBER, description: 'Emission spread in degrees (default 180 = semicircle up, 360 = all directions)' },
      particleSize: { type: Type.NUMBER, description: 'Size multiplier (default 1). Higher = bigger particles.' },
      fadeOut: { type: Type.BOOLEAN, description: 'Whether particles fade out (default true)' },
    },
    required: ['particleType', 'from', 'durationInFrames'],
  },
};

const addGradient = {
  name: 'add_gradient',
  description: 'Add an animated gradient background to the timeline. Perfect for dynamic backgrounds, color transitions, and visual depth. Supports linear, radial, and conic gradients with optional rotation and color-shifting animation.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      gradientType: {
        type: Type.STRING,
        description: 'Gradient type: "linear" (straight line), "radial" (circular), or "conic" (angular sweep). Default: "linear"'
      },
      colors: {
        type: Type.ARRAY,
        description: 'Array of color stops. Each has "color" (hex) and "position" (0-100). Minimum 2 colors. Example: [{color: "#6366f1", position: 0}, {color: "#06b6d4", position: 100}]',
        items: {
          type: Type.OBJECT,
          properties: {
            color: { type: Type.STRING, description: 'Hex color (e.g. "#6366f1")' },
            position: { type: Type.NUMBER, description: 'Position 0-100 (percentage along gradient)' },
          },
          required: ['color', 'position'],
        },
      },
      angle: { type: Type.NUMBER, description: 'Gradient angle in degrees (0-360). For linear: direction, for conic: start angle. Default: 135' },
      centerX: { type: Type.NUMBER, description: 'Center X position 0-1 for radial/conic gradients (default 0.5)' },
      centerY: { type: Type.NUMBER, description: 'Center Y position 0-1 for radial/conic gradients (default 0.5)' },
      from: { type: Type.NUMBER, description: 'Start frame' },
      durationInFrames: { type: Type.NUMBER, description: 'Duration in frames' },
      animate: { type: Type.BOOLEAN, description: 'Enable animation (default false)' },
      animateAngle: { type: Type.BOOLEAN, description: 'Rotate the gradient when animate=true (default false)' },
      animateColors: { type: Type.BOOLEAN, description: 'Shift colors through the gradient when animate=true (default false)' },
      speed: { type: Type.NUMBER, description: 'Animation speed multiplier (default 1). Higher = faster animation.' },
      positionX: { type: Type.NUMBER, description: 'X position 0-1 (default 0.5 = centered)' },
      positionY: { type: Type.NUMBER, description: 'Y position 0-1 (default 0.5 = centered)' },
      width: { type: Type.NUMBER, description: 'Width 0-1 relative to composition (default 1 = full width)' },
      height: { type: Type.NUMBER, description: 'Height 0-1 relative to composition (default 1 = full height)' },
    },
    required: ['colors', 'from', 'durationInFrames'],
  },
};

// =============================================
// Visual Effects Tools
// =============================================

const addFilmGrain = {
  name: 'add_film_grain',
  description: 'Add a film grain effect to give videos a cinematic, vintage, or retro look. Creates animated noise overlay that simulates analog film.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      from: { type: Type.NUMBER, description: 'Start frame' },
      durationInFrames: { type: Type.NUMBER, description: 'Duration in frames' },
      intensity: { type: Type.NUMBER, description: 'Grain intensity 0-1 (default 0.3). Higher = more visible grain.' },
      speed: { type: Type.NUMBER, description: 'Animation speed multiplier (default 1). Higher = faster grain animation.' },
      size: { type: Type.NUMBER, description: 'Grain size 0-1 (default 0.5). Higher = larger grain particles.' },
      colored: { type: Type.BOOLEAN, description: 'Use colored grain instead of monochrome (default false).' },
      blendMode: { type: Type.STRING, description: 'Blend mode: "overlay" (default), "soft-light", "multiply", "screen".' },
    },
    required: ['from', 'durationInFrames'],
  },
};

const addVignette = {
  name: 'add_vignette',
  description: 'Add a vignette effect that darkens the edges of the video. Creates cinematic focus and draws attention to the center.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      from: { type: Type.NUMBER, description: 'Start frame' },
      durationInFrames: { type: Type.NUMBER, description: 'Duration in frames' },
      intensity: { type: Type.NUMBER, description: 'Darkness intensity 0-1 (default 0.5). Higher = darker edges.' },
      size: { type: Type.NUMBER, description: 'Size of the clear center area 0-1 (default 0.4). Lower = larger dark area.' },
      softness: { type: Type.NUMBER, description: 'Softness of the edge transition 0-1 (default 0.5). Higher = smoother gradient.' },
      color: { type: Type.STRING, description: 'Vignette color (default "#000000"). Use for creative colored vignettes.' },
      shape: { type: Type.STRING, description: 'Vignette shape: "circular" (default) or "rectangular".' },
    },
    required: ['from', 'durationInFrames'],
  },
};

const addColorGrade = {
  name: 'add_color_grade',
  description: 'Add a color grading effect to change the mood and look of the video. Includes preset looks like cinematic, vintage, noir, etc.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      from: { type: Type.NUMBER, description: 'Start frame' },
      durationInFrames: { type: Type.NUMBER, description: 'Duration in frames' },
      preset: {
        type: Type.STRING,
        description: 'Color grade preset: "cinematic-teal-orange" (blockbuster film look), "vintage-warm" (nostalgic warm), "vintage-cool" (faded cool), "noir" (black & white with contrast), "cyberpunk" (neon pink/cyan), "sunset" (warm golden hour), "moonlight" (cool night), "sepia" (classic sepia tone), "custom" (use custom values).'
      },
      intensity: { type: Type.NUMBER, description: 'Effect intensity 0-1 (default 1). Lower for subtler effect.' },
      brightness: { type: Type.NUMBER, description: 'Brightness adjustment -1 to 1 (default 0).' },
      contrast: { type: Type.NUMBER, description: 'Contrast adjustment -1 to 1 (default 0).' },
      saturation: { type: Type.NUMBER, description: 'Saturation adjustment -1 to 1 (default 0). -1 = grayscale.' },
      temperature: { type: Type.NUMBER, description: 'Color temperature -1 to 1 (default 0). Negative = cooler/bluer, positive = warmer/yellower.' },
      tint: { type: Type.NUMBER, description: 'Tint adjustment -1 to 1 (default 0). Negative = green, positive = magenta.' },
      shadows: { type: Type.STRING, description: 'Shadow color tint (hex). For split-tone effect.' },
      highlights: { type: Type.STRING, description: 'Highlight color tint (hex). For split-tone effect.' },
    },
    required: ['from', 'durationInFrames', 'preset'],
  },
};

const addBlob = {
  name: 'add_blob',
  description: 'Add animated organic blob shapes for creative backgrounds and visual effects. Creates soft, flowing shapes with smooth animations.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      from: { type: Type.NUMBER, description: 'Start frame' },
      durationInFrames: { type: Type.NUMBER, description: 'Duration in frames' },
      colors: {
        type: Type.ARRAY,
        description: 'Array of colors (hex) for the blobs. Default: ["#6366f1", "#8b5cf6", "#a855f7"]',
        items: { type: Type.STRING },
      },
      blobCount: { type: Type.NUMBER, description: 'Number of overlapping blobs (default 3). More = richer layered effect.' },
      complexity: { type: Type.NUMBER, description: 'Blob shape complexity 0-1 (default 0.5). Higher = more irregular shapes.' },
      animationStyle: {
        type: Type.STRING,
        description: 'Animation style: "morph" (smooth shape-shifting), "float" (gentle floating), "pulse" (breathing in/out), "wave" (wave deformation).'
      },
      speed: { type: Type.NUMBER, description: 'Animation speed multiplier (default 1).' },
      opacity: { type: Type.NUMBER, description: 'Overall opacity 0-1 (default 0.8).' },
      blendMode: { type: Type.STRING, description: 'Blend mode: "normal", "multiply", "screen", "overlay". Default "normal".' },
      positionX: { type: Type.NUMBER, description: 'X position 0-1 (default 0.5 = centered).' },
      positionY: { type: Type.NUMBER, description: 'Y position 0-1 (default 0.5 = centered).' },
      scale: { type: Type.NUMBER, description: 'Size multiplier (default 1).' },
    },
    required: ['from', 'durationInFrames'],
  },
};

// =============================================
// Scene Management Tools
// =============================================

const addScene = {
  name: 'add_scene',
  description: 'CALL THIS when user says "create a scene", "add a scene", "make a slide", or "new section". Creates a new scene (slide) in the composition timeline. Scenes organize video into discrete sections with their own backgrounds and transitions.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Scene name (e.g. "Intro", "Feature 1", "Hook", "Conclusion")' },
      durationInSeconds: { type: Type.NUMBER, description: 'Scene duration in seconds (default: 5). Example: 3 for a 3-second scene.' },
      backgroundColor: { type: Type.STRING, description: 'Scene background color as hex (default: "#000000"). Example: "#1e1b4b" for deep indigo.' },
      transitionType: { type: Type.STRING, description: 'Transition from previous scene: "fade", "slide", "curtain", "wheel", "flip". First scene cannot have a transition.' },
      transitionDuration: { type: Type.NUMBER, description: 'Transition duration in frames. Default: 15 (0.5s at 30fps)' },
      transitionDirection: { type: Type.STRING, description: 'Transition direction: "left", "right", "top", "bottom". Used for slide, curtain, wheel, flip.' },
    },
    required: ['name'],
  },
};

const updateScene = {
  name: 'update_scene',
  description: 'Update an existing scene\'s properties (name, duration, background, transition).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sceneId: { type: Type.STRING, description: 'The scene ID to update' },
      name: { type: Type.STRING, description: 'New scene name' },
      durationInSeconds: { type: Type.NUMBER, description: 'New duration in seconds' },
      backgroundColor: { type: Type.STRING, description: 'New background color (hex)' },
      transitionType: { type: Type.STRING, description: 'Transition type: "fade", "slide", "curtain", "wheel", "flip", or "none" to remove transition' },
      transitionDuration: { type: Type.NUMBER, description: 'Transition duration in frames' },
      transitionDirection: { type: Type.STRING, description: 'Transition direction: "left", "right", "top", "bottom"' },
    },
    required: ['sceneId'],
  },
};

const removeScene = {
  name: 'remove_scene',
  description: 'Remove a scene from the composition. Items assigned to the scene will be unassigned but not deleted.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sceneId: { type: Type.STRING, description: 'The scene ID to remove' },
    },
    required: ['sceneId'],
  },
};

const assignItemToScene = {
  name: 'assign_item_to_scene',
  description: 'Assign a timeline item to a specific scene. The item\'s start frame becomes relative to the scene\'s start.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackId: { type: Type.STRING, description: 'The track ID containing the item' },
      itemId: { type: Type.STRING, description: 'The item ID to assign' },
      sceneId: { type: Type.STRING, description: 'The scene ID to assign the item to. Use null or empty string to unassign.' },
    },
    required: ['trackId', 'itemId'],
  },
};

const listScenes = {
  name: 'list_scenes',
  description: 'List all scenes in the composition with their IDs, names, and durations.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

// =============================================
// Fast Scene Builder Tool
// =============================================

const buildScene = {
  name: 'build_scene',
  description: 'FAST: Build a complete scene with all its visual elements in ONE call. Use this when the user describes a scene with multiple elements (background, text, shapes, etc.). This is 5-10x faster than calling individual tools. Creates the scene AND all content inside it.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      // Scene settings
      name: { type: Type.STRING, description: 'Scene name (e.g. "Intro", "Feature 1", "Hook")' },
      durationInSeconds: { type: Type.NUMBER, description: 'Scene duration in seconds (default: 5)' },

      // Background - can be solid color OR gradient
      backgroundColor: { type: Type.STRING, description: 'Solid background color as hex (e.g. "#1e1b4b"). Ignored if gradient is provided.' },
      gradient: {
        type: Type.OBJECT,
        description: 'Gradient background (overrides backgroundColor)',
        properties: {
          type: { type: Type.STRING, description: '"linear", "radial", or "conic"' },
          colors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                color: { type: Type.STRING },
                position: { type: Type.NUMBER },
              },
            },
          },
          angle: { type: Type.NUMBER, description: 'Gradient angle in degrees (default 135)' },
          animate: { type: Type.BOOLEAN, description: 'Animate the gradient' },
        },
      },

      // Text overlays - array of text elements
      texts: {
        type: Type.ARRAY,
        description: 'Array of text overlays to add to the scene',
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: 'The text content' },
            role: { type: Type.STRING, description: '"title", "subtitle", "description", "label", or "cta". Sets appropriate defaults.' },
            positionX: { type: Type.NUMBER, description: 'X position 0-1 (default 0.5)' },
            positionY: { type: Type.NUMBER, description: 'Y position 0-1 (default 0.5)' },
            fontSize: { type: Type.NUMBER, description: 'Font size in px (auto-set based on role if not provided)' },
            color: { type: Type.STRING, description: 'Text color as hex (default #ffffff)' },
            fontWeight: { type: Type.NUMBER, description: 'Font weight 100-900' },
            delay: { type: Type.NUMBER, description: 'Delay in seconds before text appears (for staggered reveals)' },
            animation: { type: Type.STRING, description: 'Animation preset: "fade-in", "slide-in-up", "slide-in-left", "bounce", "typewriter"' },
            letterAnimation: { type: Type.BOOLEAN, description: 'Enable per-letter animation for dynamic reveals' },
            letterAnimationType: { type: Type.STRING, description: '"fade", "slide-up", "scale", "blur", "typewriter"' },
          },
          required: ['text'],
        },
      },

      // Shapes - array of shape elements
      shapes: {
        type: Type.ARRAY,
        description: 'Array of shapes (rectangles, circles, badges) to add',
        items: {
          type: Type.OBJECT,
          properties: {
            shapeType: { type: Type.STRING, description: '"rectangle", "circle", "badge", "line"' },
            width: { type: Type.NUMBER, description: 'Width 0-1 relative' },
            height: { type: Type.NUMBER, description: 'Height 0-1 relative' },
            positionX: { type: Type.NUMBER, description: 'X position 0-1' },
            positionY: { type: Type.NUMBER, description: 'Y position 0-1' },
            fill: { type: Type.STRING, description: 'Fill color (hex)' },
            stroke: { type: Type.STRING, description: 'Stroke color (hex)' },
            borderRadius: { type: Type.NUMBER, description: 'Border radius in px' },
            opacity: { type: Type.NUMBER, description: 'Opacity 0-1' },
            text: { type: Type.STRING, description: 'Text inside badge' },
            delay: { type: Type.NUMBER, description: 'Delay in seconds before shape appears' },
          },
          required: ['shapeType', 'width', 'height'],
        },
      },

      // Particles - optional particle effect
      particles: {
        type: Type.OBJECT,
        description: 'Add particle effect to the scene',
        properties: {
          type: { type: Type.STRING, description: '"confetti", "sparks", "snow", "bubbles", "stars", "dust"' },
          emitterX: { type: Type.NUMBER, description: 'Emitter X position 0-1' },
          emitterY: { type: Type.NUMBER, description: 'Emitter Y position 0-1' },
          count: { type: Type.NUMBER, description: 'Number of particles' },
          colors: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },

      // Transition from previous scene
      transitionType: { type: Type.STRING, description: 'Transition from previous scene: "fade", "slide", "curtain", "wheel", "flip"' },
      transitionDuration: { type: Type.NUMBER, description: 'Transition duration in frames (default 15)' },
    },
    required: ['name'],
  },
};

export const compositionTools = [
  { functionDeclarations: [
    updateItemDuration,
    addTextOverlay,
    removeItem,
    moveItem,
    updateItemProps,
    addTransition,
    addComponent,
    addCustomHtml,
    addShape,
    addKeyframes,
    addCursor,
    addMedia,
    addSvg,
    clearComposition,
    removeTrack,
    reorderTrack,
    generateProductVideo,
    generateComposition,
    // Advanced animation tools
    applyAnimationPreset,
    addCameraMovement,
    addStaggerAnimation,
    addMotionPath,
    addParticles,
    addGradient,
    // Visual effects tools
    addFilmGrain,
    addVignette,
    addColorGrade,
    addBlob,
    // Scene management tools
    addScene,
    updateScene,
    removeScene,
    assignItemToScene,
    listScenes,
    // Fast builder tools
    buildScene,
  ]},
];

// =============================================
// Tool Call Executor
// =============================================

type ToolHandler = (args: Record<string, unknown>, store: CompositionStoreApi) => unknown;

const handlers = new Map<string, ToolHandler>([
  ['update_item_duration', (args, store) => {
    store.updateItem(
      args.trackId as string,
      args.itemId as string,
      { durationInFrames: args.durationInFrames as number }
    );
    return { success: true };
  }],

  ['add_text_overlay', (args, store) => {
    const text = args.text as string;
    const trackName = text.length > 30 ? text.slice(0, 27) + '...' : text;
    const newTrack = addTrackAndGet(store, { name: trackName, type: 'text', locked: false, visible: true, items: [] });

    // Build letter/word animation config if enabled
    let letterAnimation: LetterAnimation | undefined = undefined;
    if (args.letterAnimation) {
      letterAnimation = {
        enabled: true,
        type: (args.letterAnimationType as LetterAnimationType) ?? 'fade',
        mode: (args.letterAnimationMode as LetterAnimation['mode']) ?? 'letter',
        staggerFrames: (args.letterStagger as number) ?? 2,
        durationPerLetter: (args.letterDuration as number) ?? 10,
        direction: (args.letterAnimationDirection as LetterAnimation['direction']) ?? 'forward',
        easing: (args.letterEasing as LetterAnimation['easing']) ?? 'ease-out',
      };
    }

    store.addItem(newTrack.id, {
      type: 'text',
      text,
      fontSize: (args.fontSize as number) ?? 48,
      fontFamily: 'Inter',
      color: (args.color as string) ?? '#ffffff',
      fontWeight: (args.fontWeight as number) ?? undefined,
      backgroundColor: (args.backgroundColor as string) ?? undefined,
      padding: (args.padding as number) ?? undefined,
      borderRadius: (args.borderRadius as number) ?? undefined,
      textShadow: (args.textShadow as string) ?? undefined,
      letterSpacing: (args.letterSpacing as number) ?? undefined,
      lineHeight: (args.lineHeight as number) ?? undefined,
      textAlign: (args.textAlign as 'left' | 'center' | 'right') ?? undefined,
      maxWidth: (args.maxWidth as number) ?? undefined,
      noWrap: (args.noWrap as boolean) ?? undefined,
      letterAnimation,
      position: {
        x: (args.positionX as number) ?? 0.5,
        y: (args.positionY as number) ?? 0.5,
      },
      from: args.from as number,
      durationInFrames: args.durationInFrames as number,
    } as Omit<TextItem, 'id'>);
    return { success: true };
  }],

  ['remove_item', (args, store) => {
    store.removeItem(args.trackId as string, args.itemId as string);
    return { success: true };
  }],

  ['move_item', (args, store) => {
    store.moveItem(
      args.trackId as string,
      args.trackId as string,
      args.itemId as string,
      args.newFrom as number
    );
    return { success: true };
  }],

  ['update_item_props', (args, store) => {
    store.updateItem(
      args.trackId as string,
      args.itemId as string,
      args.props as Record<string, unknown>
    );
    return { success: true };
  }],

  ['add_transition', (args, store) => {
    const transitionType = args.type as 'fade' | 'slide';
    store.updateItem(
      args.trackId as string,
      args.itemId as string,
      {
        transitionIn: {
          type: transitionType,
          direction: args.direction as 'left' | 'right' | 'top' | 'bottom' | undefined,
          durationInFrames: args.durationInFrames as number,
        },
      }
    );
    return { success: true };
  }],

  ['add_component', (args, store) => {
    const trackName = (args.componentName as string) ?? 'Component';
    const componentTrack = addTrackAndGet(store, { name: trackName, type: 'component', locked: false, visible: true, items: [] });
    store.addItem(componentTrack.id, {
      type: 'component',
      componentId: args.componentId as string,
      props: (args.props as Record<string, unknown>) ?? {},
      from: (args.from as number) ?? 0,
      durationInFrames: (args.durationInFrames as number) ?? 150,
      displaySize: (args.displaySize as 'phone' | 'laptop' | 'full') ?? 'laptop',
      ...(args.containerWidth != null && { containerWidth: args.containerWidth as number }),
      ...(args.containerHeight != null && { containerHeight: args.containerHeight as number }),
      ...(args.objectPosition != null && { objectPosition: args.objectPosition as string }),
    } as Omit<ComponentItem, 'id'>);
    return { success: true, componentName: args.componentName };
  }],

  ['add_custom_html', (args, store) => {
    const trackName = (args.customComponentName as string) ?? 'Custom HTML';
    const htmlTrack = addTrackAndGet(store, { name: trackName, type: 'custom-html', locked: false, visible: true, items: [] });
    store.addItem(htmlTrack.id, {
      type: 'custom-html',
      customComponentId: args.customComponentId as string,
      html: '', // Will be populated from the database at render time
      from: (args.from as number) ?? 0,
      durationInFrames: (args.durationInFrames as number) ?? 150,
      displaySize: (args.displaySize as 'phone' | 'laptop' | 'full') ?? 'laptop',
      ...(args.containerWidth != null && { containerWidth: args.containerWidth as number }),
      ...(args.containerHeight != null && { containerHeight: args.containerHeight as number }),
      ...(args.objectFit != null && { objectFit: args.objectFit as 'contain' | 'cover' | 'fill' }),
      ...(args.objectPosition != null && { objectPosition: args.objectPosition as string }),
      ...(args.positionX != null || args.positionY != null) && {
        position: {
          x: (args.positionX as number) ?? 0.5,
          y: (args.positionY as number) ?? 0.5
        }
      },
      ...(args.backgroundColor != null && { backgroundColor: args.backgroundColor as string }),
    } as Omit<import('@/lib/composition/types').CustomHtmlItem, 'id'>);
    return { success: true, customComponentName: args.customComponentName };
  }],

  ['add_keyframes', (args, store) => {
    let keyframes = args.keyframes as Array<{
      frame: number;
      values: Record<string, number>;
      easing?: string;
      springPreset?: string;
      springConfig?: { mass?: number; stiffness?: number; damping?: number };
    }>;

    // Safety check: if first keyframe frame is > 60, the AI likely used absolute video frames
    // instead of relative item frames. Auto-correct by shifting all frames down.
    if (keyframes.length > 0) {
      const minFrame = Math.min(...keyframes.map(kf => kf.frame));
      if (minFrame > 60) {
        // Shift all keyframes so the minimum starts at 0
        console.warn(`[add_keyframes] Auto-correcting: keyframes started at frame ${minFrame}, shifting to 0`);
        keyframes = keyframes.map(kf => ({
          ...kf,
          frame: kf.frame - minFrame,
        }));
      }
    }

    // Transform keyframes to include spring physics if provided
    const processedKeyframes: PropertyKeyframe[] = keyframes.map(kf => ({
      frame: kf.frame,
      values: kf.values,
      easing: (kf.easing as PropertyKeyframe['easing']) ?? 'ease-out',
      springPreset: kf.springPreset as SpringPreset | undefined,
      springConfig: kf.springConfig ? {
        mass: kf.springConfig.mass ?? 1,
        stiffness: kf.springConfig.stiffness ?? 100,
        damping: kf.springConfig.damping ?? 10,
        velocity: 0,
      } : undefined,
    }));

    store.updateItem(
      args.trackId as string,
      args.itemId as string,
      { keyframes: processedKeyframes } as any
    );
    return { success: true, corrected: keyframes[0]?.frame === 0 };
  }],

  ['add_shape', (args, store) => {
    const shapeType = args.shapeType as string;
    const trackName = shapeType.charAt(0).toUpperCase() + shapeType.slice(1);
    const shapeTrack = addTrackAndGet(store, { name: trackName, type: 'shape', locked: false, visible: true, items: [] });
    store.addItem(shapeTrack.id, {
      type: 'shape',
      shapeType: shapeType as ShapeItem['shapeType'],
      width: args.width as number,
      height: args.height as number,
      position: {
        x: (args.positionX as number) ?? 0.5,
        y: (args.positionY as number) ?? 0.5,
      },
      from: args.from as number,
      durationInFrames: args.durationInFrames as number,
      fill: (args.fill as string) ?? undefined,
      stroke: (args.stroke as string) ?? undefined,
      strokeWidth: (args.strokeWidth as number) ?? undefined,
      borderRadius: (args.borderRadius as number) ?? undefined,
      opacity: (args.opacity as number) ?? undefined,
      gradientFrom: (args.gradientFrom as string) ?? undefined,
      gradientTo: (args.gradientTo as string) ?? undefined,
      gradientDirection: (args.gradientDirection as number) ?? undefined,
      text: (args.text as string) ?? undefined,
      fontSize: (args.fontSize as number) ?? undefined,
      color: (args.color as string) ?? undefined,
    } as Omit<ShapeItem, 'id'>);
    return { success: true };
  }],

  ['add_cursor', (args, store) => {
    const cursorTrack = addTrackAndGet(store, { name: 'Cursor', type: 'cursor', locked: false, visible: true, items: [] });
    // Composition dimensions for relative position conversion (fallback only)
    const compWidth = store.width;
    const compHeight = store.height;

    const keyframes = (args.keyframes as Array<{
      frame: number;
      // Target-based (PREFERRED)
      target?: string;
      targetOffset?: { x: number; y: number };
      action?: string;
      value?: string;
      speed?: number;
      holdDuration?: number;
      // Legacy manual position (fallback)
      x?: number;
      y?: number;
      relX?: number;
      relY?: number;
      click?: boolean;
      // Legacy interaction object
      interaction?: { selector: string; action: string; value?: string; speed?: number; holdDuration?: number };
    }>).map(k => {
      // NEW: Target-based positioning - cursor auto-positions to element
      if (k.target) {
        return {
          frame: k.frame,
          target: k.target,
          ...(k.targetOffset && { targetOffset: k.targetOffset }),
          ...(k.click && { click: true }),
          // Create interaction from target + action (new simplified API)
          interaction: {
            selector: k.target,
            action: (k.action ?? 'click') as 'click' | 'hover' | 'type' | 'focus' | 'select' | 'check',
            ...(k.value ? { value: k.value } : {}),
            ...(k.speed != null ? { speed: k.speed } : {}),
            ...(k.holdDuration != null ? { holdDuration: k.holdDuration } : {}),
          },
          // Fallback coordinates (used if target resolution fails)
          ...(k.x != null && { x: k.x }),
          ...(k.y != null && { y: k.y }),
          ...(k.relX != null && { x: k.relX * compWidth }),
          ...(k.relY != null && { y: k.relY * compHeight }),
        };
      }

      // LEGACY: Manual coordinate positioning
      const pixelX = k.relX != null ? k.relX * compWidth : (k.x ?? compWidth / 2);
      const pixelY = k.relY != null ? k.relY * compHeight : (k.y ?? compHeight / 2);

      return {
        frame: k.frame,
        x: pixelX,
        y: pixelY,
        ...(k.click && { click: true }),
        ...(k.interaction ? {
          // Also set target from interaction selector for auto-positioning
          target: k.interaction.selector,
          interaction: {
            selector: k.interaction.selector,
            action: k.interaction.action as 'click' | 'hover' | 'type' | 'focus' | 'select' | 'check',
            ...(k.interaction.value ? { value: k.interaction.value } : {}),
            ...(k.interaction.speed != null ? { speed: k.interaction.speed } : {}),
            ...(k.interaction.holdDuration != null ? { holdDuration: k.interaction.holdDuration } : {}),
          },
        } : {}),
      };
    });

    store.addItem(cursorTrack.id, {
      type: 'cursor',
      from: args.from as number,
      durationInFrames: args.durationInFrames as number,
      keyframes,
      cursorStyle: (args.cursorStyle as CursorItem['cursorStyle']) ?? 'default',
      clickEffect: (args.clickEffect as CursorItem['clickEffect']) ?? 'ripple',
      scale: (args.scale as number) ?? 1,
    } as Omit<CursorItem, 'id'>);
    return { success: true };
  }],

  ['add_svg', (args, store) => {
    const track = addTrackAndGet(store, { name: 'SVG', type: 'shape', locked: false, visible: true, items: [] });
    const drawDuration = (args.drawDuration as number) ?? 60;
    // Auto-generate progress keyframes for draw-on animation
    const keyframes = [
      { frame: 0, values: { progress: 0 }, easing: 'ease-out' as const },
      { frame: drawDuration, values: { progress: 1 }, easing: 'ease-out' as const },
    ];
    store.addItem(track.id, {
      type: 'shape',
      shapeType: 'svg',
      svgContent: args.svgContent as string,
      viewBox: (args.viewBox as string) ?? undefined,
      width: (args.width as number) ?? 0.5,
      height: (args.height as number) ?? 0.4,
      position: {
        x: (args.positionX as number) ?? 0.5,
        y: (args.positionY as number) ?? 0.5,
      },
      from: args.from as number,
      durationInFrames: args.durationInFrames as number,
      fill: (args.fill as string) ?? undefined,
      keyframes,
    } as Omit<ShapeItem, 'id'>);
    return { success: true };
  }],

  ['add_media', (args, store) => {
    const mediaType = args.mediaType as string;
    const isImage = mediaType === 'image';
    const trackName = isImage ? 'Image' : 'Video';
    const track = addTrackAndGet(store, { name: trackName, type: isImage ? 'image' : 'video', locked: false, visible: true, items: [] });
    const position = (args.positionX != null || args.positionY != null)
      ? { x: (args.positionX as number) ?? 0.5, y: (args.positionY as number) ?? 0.5 }
      : undefined;
    if (isImage) {
      store.addItem(track.id, {
        type: 'image',
        src: args.src as string,
        from: args.from as number,
        durationInFrames: args.durationInFrames as number,
        ...(position && { position }),
        ...(args.width != null && { width: args.width as number }),
        ...(args.height != null && { height: args.height as number }),
        ...(args.clipShape ? { clipShape: args.clipShape as ImageItem['clipShape'] } : {}),
      } as Omit<ImageItem, 'id'>);
    } else {
      store.addItem(track.id, {
        type: 'video',
        src: args.src as string,
        volume: (args.volume as number) ?? 1,
        startFrom: 0,
        from: args.from as number,
        durationInFrames: args.durationInFrames as number,
        ...(position && { position }),
        ...(args.width != null && { width: args.width as number }),
        ...(args.height != null && { height: args.height as number }),
        ...(args.clipShape ? { clipShape: args.clipShape as MediaItem['clipShape'] } : {}),
      } as Omit<MediaItem, 'id'>);
    }
    return { success: true };
  }],

  ['clear_composition', (_args, store) => {
    const trackIds = store.tracks.map(t => t.id);
    for (const id of trackIds) {
      store.removeTrack(id);
    }
    // Also clear all scenes
    const sceneIds = store.scenes.map(s => s.id);
    for (const id of sceneIds) {
      store.removeScene(id);
    }
    return { success: true, tracksRemoved: trackIds.length, scenesRemoved: sceneIds.length };
  }],

  ['remove_track', (args, store) => {
    store.removeTrack(args.trackId as string);
    return { success: true };
  }],

  ['reorder_track', (args, store) => {
    const trackId = args.trackId as string;
    const newIndex = args.newIndex as number;
    store.reorderTrack(trackId, newIndex);
    const tracks = useCompositionStore.getState().tracks;
    const trackNames = tracks.map((t, i) => `${i}: ${t.name} (${t.type})`);
    return { success: true, trackOrder: trackNames };
  }],

  ['generate_product_video', (args) => {
    // Return args as-is; the route handler manages the generation flow
    return args;
  }],

  ['generate_composition', (args) => {
    // Return args as-is; the route handler manages the generation flow
    return args;
  }],

  // =============================================
  // Advanced Animation Tool Handlers
  // =============================================

  ['apply_animation_preset', (args, store) => {
    const trackId = args.trackId as string;
    const itemId = args.itemId as string;
    const presetName = args.preset as string;
    const durationInFrames = args.durationInFrames as number | undefined;
    const intensity = args.intensity as number | undefined;

    try {
      // Find the item to get its current position
      const track = store.tracks.find(t => t.id === trackId);
      const item = track?.items.find(i => i.id === itemId) as any;
      const itemPosX = item?.position?.x ?? 0.5;
      const itemPosY = item?.position?.y ?? 0.5;

      const keyframes = applyPreset(presetName, { durationInFrames, intensity });

      // Offset position keyframes relative to item's current position
      // Presets assume center (0.5), so adjust based on item's actual position
      const adjustedKeyframes = keyframes.map(kf => {
        const adjustedValues = { ...kf.values };
        if ('positionX' in adjustedValues) {
          // Calculate the offset from center (0.5) and apply to item's position
          const offsetX = adjustedValues.positionX - 0.5;
          adjustedValues.positionX = itemPosX + offsetX;
        }
        if ('positionY' in adjustedValues) {
          const offsetY = adjustedValues.positionY - 0.5;
          adjustedValues.positionY = itemPosY + offsetY;
        }
        return { ...kf, values: adjustedValues };
      });

      store.updateItem(trackId, itemId, { keyframes: adjustedKeyframes } as any);
      return { success: true, preset: presetName, keyframeCount: adjustedKeyframes.length };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }],

  ['add_camera_movement', (args, store) => {
    const type = args.type as string;
    const itemIds = args.itemIds as Array<{ trackId: string; itemId: string }> | undefined;
    const intensity = (args.intensity as number) ?? 0.5;
    const durationInFrames = args.durationInFrames as number;
    const startFrame = args.startFrame as number;
    const easing = (args.easing as string) ?? 'ease-out';

    // If no itemIds provided, get all items from all tracks
    const targets = itemIds ?? store.tracks.flatMap(track =>
      track.items.map(item => ({ trackId: track.id, itemId: item.id }))
    );

    // Generate camera movement keyframes based on type, with item position support
    const generateCameraKeyframes = (itemPosX: number, itemPosY: number): PropertyKeyframe[] => {
      const baseIntensity = intensity * 0.1; // Scale down for subtle effect

      switch (type) {
        case 'zoom-in':
          return [
            { frame: 0, values: { scale: 1 }, easing: easing as any },
            { frame: durationInFrames, values: { scale: 1 + baseIntensity }, easing: easing as any },
          ];
        case 'zoom-out':
          return [
            { frame: 0, values: { scale: 1 }, easing: easing as any },
            { frame: durationInFrames, values: { scale: 1 - baseIntensity }, easing: easing as any },
          ];
        case 'pan-left':
          return [
            { frame: 0, values: { positionX: itemPosX }, easing: easing as any },
            { frame: durationInFrames, values: { positionX: itemPosX - baseIntensity }, easing: easing as any },
          ];
        case 'pan-right':
          return [
            { frame: 0, values: { positionX: itemPosX }, easing: easing as any },
            { frame: durationInFrames, values: { positionX: itemPosX + baseIntensity }, easing: easing as any },
          ];
        case 'pan-up':
          return [
            { frame: 0, values: { positionY: itemPosY }, easing: easing as any },
            { frame: durationInFrames, values: { positionY: itemPosY - baseIntensity }, easing: easing as any },
          ];
        case 'pan-down':
          return [
            { frame: 0, values: { positionY: itemPosY }, easing: easing as any },
            { frame: durationInFrames, values: { positionY: itemPosY + baseIntensity }, easing: easing as any },
          ];
        case 'shake':
          const shakeAmount = baseIntensity * 0.5;
          return [
            { frame: 0, values: { positionX: itemPosX }, easing: 'linear' as any },
            { frame: Math.round(durationInFrames * 0.2), values: { positionX: itemPosX - shakeAmount }, easing: 'linear' as any },
            { frame: Math.round(durationInFrames * 0.4), values: { positionX: itemPosX + shakeAmount }, easing: 'linear' as any },
            { frame: Math.round(durationInFrames * 0.6), values: { positionX: itemPosX - shakeAmount * 0.5 }, easing: 'linear' as any },
            { frame: Math.round(durationInFrames * 0.8), values: { positionX: itemPosX + shakeAmount * 0.5 }, easing: 'linear' as any },
            { frame: durationInFrames, values: { positionX: itemPosX }, easing: 'ease-out' as any },
          ];
        case 'drift':
          return [
            { frame: 0, values: { positionX: itemPosX - baseIntensity * 0.5, positionY: itemPosY }, easing: 'linear' as any },
            { frame: durationInFrames, values: { positionX: itemPosX + baseIntensity * 0.5, positionY: itemPosY }, easing: 'linear' as any },
          ];
        case 'ken-burns':
          return [
            { frame: 0, values: { scale: 1, positionX: itemPosX - baseIntensity * 0.5 }, easing: 'linear' as any },
            { frame: durationInFrames, values: { scale: 1 + baseIntensity, positionX: itemPosX + baseIntensity * 0.5 }, easing: 'linear' as any },
          ];
        default:
          return [];
      }
    };

    let appliedCount = 0;

    for (const { trackId, itemId } of targets) {
      // Find the item to check if it overlaps with the camera movement timeframe
      const track = store.tracks.find(t => t.id === trackId);
      const item = track?.items.find(i => i.id === itemId) as any;

      if (item) {
        // Get item's current position (default to center if not set)
        const itemPosX = item.position?.x ?? 0.5;
        const itemPosY = item.position?.y ?? 0.5;

        // Generate keyframes using item's position
        const keyframes = generateCameraKeyframes(itemPosX, itemPosY);

        // Adjust keyframes to be relative to item's start
        const adjustedKeyframes = keyframes.map(kf => ({
          ...kf,
          frame: Math.max(0, kf.frame + startFrame - item.from),
        }));

        // Merge with existing keyframes
        const existingKeyframes = item.keyframes ?? [];
        const mergedKeyframes = [...existingKeyframes, ...adjustedKeyframes];

        store.updateItem(trackId, itemId, { keyframes: mergedKeyframes } as any);
        appliedCount++;
      }
    }

    return { success: true, type, appliedTo: appliedCount };
  }],

  ['add_stagger_animation', (args, store) => {
    const items = args.items as Array<{ trackId: string; itemId: string }>;
    const animation = args.animation as {
      property: string;
      from: number;
      to: number;
      durationPerItem: number;
      easing?: string;
    };
    const staggerDelay = args.staggerDelay as number;
    const direction = (args.direction as string) ?? 'forward';

    // Reorder items based on direction
    let orderedItems = [...items];
    switch (direction) {
      case 'reverse':
        orderedItems.reverse();
        break;
      case 'center-out':
        const mid = Math.floor(orderedItems.length / 2);
        const result: typeof items = [];
        for (let i = 0; i <= mid; i++) {
          if (mid + i < orderedItems.length) result.push(orderedItems[mid + i]);
          if (mid - i >= 0 && mid - i !== mid + i) result.push(orderedItems[mid - i]);
        }
        orderedItems = result;
        break;
      case 'random':
        orderedItems.sort(() => Math.random() - 0.5);
        break;
      // 'forward' is default - no change needed
    }

    const easing = (animation.easing ?? 'ease-out') as PropertyKeyframe['easing'];
    let appliedCount = 0;

    orderedItems.forEach(({ trackId, itemId }, index) => {
      const startOffset = index * staggerDelay;

      const keyframes: PropertyKeyframe[] = [
        { frame: startOffset, values: { [animation.property]: animation.from }, easing },
        { frame: startOffset + animation.durationPerItem, values: { [animation.property]: animation.to }, easing },
      ];

      // Get existing item and merge keyframes
      const track = store.tracks.find(t => t.id === trackId);
      const item = track?.items.find(i => i.id === itemId);

      if (item) {
        const existingKeyframes = (item as any).keyframes ?? [];
        const mergedKeyframes = [...existingKeyframes, ...keyframes];
        store.updateItem(trackId, itemId, { keyframes: mergedKeyframes } as any);
        appliedCount++;
      }
    });

    return { success: true, direction, appliedTo: appliedCount, staggerDelay };
  }],

  ['add_motion_path', (args, store) => {
    const trackId = args.trackId as string;
    const itemId = args.itemId as string;
    const presetName = args.preset as MotionPathPreset | undefined;
    const customPath = args.path as PathPoint[] | undefined;
    const durationInFrames = args.durationInFrames as number;
    const autoRotate = (args.autoRotate as boolean) ?? false;
    const easing = (args.easing as string) ?? 'ease-out';

    // Get path from preset or custom
    let motionPath: MotionPath;
    if (presetName) {
      try {
        motionPath = { ...getMotionPathPreset(presetName), autoRotate };
      } catch {
        return { success: false, error: `Unknown preset: ${presetName}` };
      }
    } else if (customPath && customPath.length >= 2) {
      motionPath = { points: customPath, autoRotate };
    } else {
      return { success: false, error: 'Must provide either a preset name or a custom path with at least 2 points' };
    }

    // Convert path to keyframes
    const keyframes = pathToKeyframes(motionPath, durationInFrames, {
      easing,
      includeRotation: autoRotate,
    });

    // Get existing item and merge keyframes
    const track = store.tracks.find(t => t.id === trackId);
    const item = track?.items.find(i => i.id === itemId);

    if (!item) {
      return { success: false, error: `Item not found: ${trackId}/${itemId}` };
    }

    const existingKeyframes = (item as any).keyframes ?? [];
    const mergedKeyframes = [...existingKeyframes, ...keyframes];
    store.updateItem(trackId, itemId, { keyframes: mergedKeyframes } as any);

    return {
      success: true,
      preset: presetName,
      pathPoints: motionPath.points.length,
      keyframeCount: keyframes.length,
      autoRotate,
    };
  }],

  ['add_particles', (args, store) => {
    const particleType = args.particleType as ParticleType;
    const from = args.from as number;
    const durationInFrames = args.durationInFrames as number;
    const emitterX = (args.emitterX as number) ?? 0.5;
    const emitterY = (args.emitterY as number) ?? 0.5;
    const emitterWidth = (args.emitterWidth as number) ?? 0;
    const emitterHeight = (args.emitterHeight as number) ?? 0;
    const particleCount = (args.particleCount as number) ?? 50;
    const speed = (args.speed as number) ?? 1;
    const gravity = (args.gravity as number) ?? 1;
    const spread = (args.spread as number) ?? 180;
    const particleSize = (args.particleSize as number) ?? 1;
    const fadeOut = (args.fadeOut as boolean) ?? true;

    // Default colors based on particle type
    let colors = args.colors as string[] | undefined;
    if (!colors || colors.length === 0) {
      switch (particleType) {
        case 'confetti':
          colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
          break;
        case 'sparks':
          colors = ['#fbbf24', '#f97316', '#ef4444', '#fde68a'];
          break;
        case 'snow':
          colors = ['#ffffff', '#f0f9ff', '#e0f2fe'];
          break;
        case 'bubbles':
          colors = ['#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];
          break;
        case 'stars':
          colors = ['#fcd34d', '#fde68a', '#fef3c7', '#ffffff'];
          break;
        case 'dust':
          colors = ['#a8a29e', '#d6d3d1', '#e7e5e4'];
          break;
        default:
          colors = ['#ffffff'];
      }
    }

    const particleItem: Omit<ParticleItem, 'id'> = {
      type: 'particles',
      particleType,
      from,
      durationInFrames,
      emitterPosition: { x: emitterX, y: emitterY },
      emitterSize: emitterWidth > 0 || emitterHeight > 0
        ? { width: emitterWidth, height: emitterHeight }
        : undefined,
      particleCount,
      colors,
      speed,
      gravity,
      spread,
      particleSize,
      fadeOut,
      rotation: true,
    };

    // Create a new track for particles (empty first, then add item to get proper ID)
    const trackName = `${particleType.charAt(0).toUpperCase() + particleType.slice(1)} Particles`;
    const newTrack = addTrackAndGet(store, {
      name: trackName,
      type: 'particles',
      locked: false,
      visible: true,
      items: [],
    });

    // Use addItem to properly assign an ID to the particle item
    store.addItem(newTrack.id, particleItem);

    // Get the fresh track with the item that now has an ID
    const freshTrack = useCompositionStore.getState().tracks.find(t => t.id === newTrack.id);

    return {
      success: true,
      trackId: newTrack.id,
      itemId: freshTrack?.items[0]?.id,
      particleType,
      particleCount,
    };
  }],

  ['add_gradient', (args, store) => {
    const gradientType = (args.gradientType as GradientItem['gradientType']) ?? 'linear';
    const from = args.from as number;
    const durationInFrames = args.durationInFrames as number;

    // Parse colors - ensure at least 2 stops
    let colors = args.colors as GradientColorStop[] | undefined;
    if (!colors || colors.length < 2) {
      colors = [
        { color: '#6366f1', position: 0 },
        { color: '#06b6d4', position: 100 },
      ];
    }

    const gradientItem: Omit<GradientItem, 'id'> = {
      type: 'gradient',
      gradientType,
      colors,
      from,
      durationInFrames,
      angle: (args.angle as number) ?? 135,
      centerX: (args.centerX as number) ?? 0.5,
      centerY: (args.centerY as number) ?? 0.5,
      animate: (args.animate as boolean) ?? false,
      animateAngle: (args.animateAngle as boolean) ?? false,
      animateColors: (args.animateColors as boolean) ?? false,
      speed: (args.speed as number) ?? 1,
      position: {
        x: (args.positionX as number) ?? 0.5,
        y: (args.positionY as number) ?? 0.5,
      },
      width: (args.width as number) ?? 1,
      height: (args.height as number) ?? 1,
    };

    // Create track for gradient
    const trackName = `${gradientType.charAt(0).toUpperCase() + gradientType.slice(1)} Gradient`;
    const newTrack = addTrackAndGet(store, {
      name: trackName,
      type: 'gradient',
      locked: false,
      visible: true,
      items: [],
    });

    store.addItem(newTrack.id, gradientItem);

    const freshTrack = useCompositionStore.getState().tracks.find(t => t.id === newTrack.id);

    return {
      success: true,
      trackId: newTrack.id,
      itemId: freshTrack?.items[0]?.id,
      gradientType,
      colorCount: colors.length,
    };
  }],

  // =============================================
  // Visual Effects Tool Handlers
  // =============================================

  ['add_film_grain', (args, store) => {
    const from = args.from as number;
    const durationInFrames = args.durationInFrames as number;

    const filmGrainItem: Omit<FilmGrainItem, 'id'> = {
      type: 'film-grain',
      from,
      durationInFrames,
      intensity: (args.intensity as number) ?? 0.3,
      speed: (args.speed as number) ?? 1,
      size: (args.size as number) ?? 0.5,
      colored: (args.colored as boolean) ?? false,
      blendMode: (args.blendMode as FilmGrainItem['blendMode']) ?? 'overlay',
    };

    const newTrack = addTrackAndGet(store, {
      name: 'Film Grain',
      type: 'film-grain',
      locked: false,
      visible: true,
      items: [],
    });

    store.addItem(newTrack.id, filmGrainItem);
    const freshTrack = useCompositionStore.getState().tracks.find(t => t.id === newTrack.id);

    return {
      success: true,
      trackId: newTrack.id,
      itemId: freshTrack?.items[0]?.id,
    };
  }],

  ['add_vignette', (args, store) => {
    const from = args.from as number;
    const durationInFrames = args.durationInFrames as number;

    const vignetteItem: Omit<VignetteItem, 'id'> = {
      type: 'vignette',
      from,
      durationInFrames,
      intensity: (args.intensity as number) ?? 0.5,
      size: (args.size as number) ?? 0.4,
      softness: (args.softness as number) ?? 0.5,
      color: (args.color as string) ?? '#000000',
      shape: (args.shape as VignetteItem['shape']) ?? 'circular',
    };

    const newTrack = addTrackAndGet(store, {
      name: 'Vignette',
      type: 'vignette',
      locked: false,
      visible: true,
      items: [],
    });

    store.addItem(newTrack.id, vignetteItem);
    const freshTrack = useCompositionStore.getState().tracks.find(t => t.id === newTrack.id);

    return {
      success: true,
      trackId: newTrack.id,
      itemId: freshTrack?.items[0]?.id,
    };
  }],

  ['add_color_grade', (args, store) => {
    const from = args.from as number;
    const durationInFrames = args.durationInFrames as number;
    const preset = args.preset as ColorGradePreset;

    const colorGradeItem: Omit<ColorGradeItem, 'id'> = {
      type: 'color-grade',
      from,
      durationInFrames,
      preset,
      intensity: (args.intensity as number) ?? 1,
      brightness: (args.brightness as number) ?? undefined,
      contrast: (args.contrast as number) ?? undefined,
      saturation: (args.saturation as number) ?? undefined,
      temperature: (args.temperature as number) ?? undefined,
      tint: (args.tint as number) ?? undefined,
      shadows: (args.shadows as string) ?? undefined,
      highlights: (args.highlights as string) ?? undefined,
    };

    const newTrack = addTrackAndGet(store, {
      name: `Color Grade (${preset})`,
      type: 'color-grade',
      locked: false,
      visible: true,
      items: [],
    });

    store.addItem(newTrack.id, colorGradeItem);
    const freshTrack = useCompositionStore.getState().tracks.find(t => t.id === newTrack.id);

    return {
      success: true,
      trackId: newTrack.id,
      itemId: freshTrack?.items[0]?.id,
      preset,
    };
  }],

  ['add_blob', (args, store) => {
    const from = args.from as number;
    const durationInFrames = args.durationInFrames as number;

    const colors = (args.colors as string[]) ?? ['#6366f1', '#8b5cf6', '#a855f7'];

    const blobItem: Omit<BlobItem, 'id'> = {
      type: 'blob',
      from,
      durationInFrames,
      colors,
      blobCount: (args.blobCount as number) ?? 3,
      complexity: (args.complexity as number) ?? 0.5,
      animationStyle: (args.animationStyle as BlobAnimationStyle) ?? 'morph',
      speed: (args.speed as number) ?? 1,
      opacity: (args.opacity as number) ?? 0.8,
      blendMode: (args.blendMode as BlobItem['blendMode']) ?? 'normal',
      position: {
        x: (args.positionX as number) ?? 0.5,
        y: (args.positionY as number) ?? 0.5,
      },
      scale: (args.scale as number) ?? 1,
    };

    const newTrack = addTrackAndGet(store, {
      name: 'Blob Effect',
      type: 'blob',
      locked: false,
      visible: true,
      items: [],
    });

    store.addItem(newTrack.id, blobItem);
    const freshTrack = useCompositionStore.getState().tracks.find(t => t.id === newTrack.id);

    return {
      success: true,
      trackId: newTrack.id,
      itemId: freshTrack?.items[0]?.id,
      blobCount: blobItem.blobCount,
      animationStyle: blobItem.animationStyle,
    };
  }],

  // =============================================
  // Scene Management Tool Handlers
  // =============================================

  ['add_scene', (args, store) => {
    const name = args.name as string;
    const durationInSeconds = (args.durationInSeconds as number) ?? 5;
    const fps = store.fps;
    const durationInFrames = Math.round(durationInSeconds * fps);
    const backgroundColor = (args.backgroundColor as string) ?? '#000000';

    // Calculate start frame based on existing scenes
    const scenes = useCompositionStore.getState().scenes;
    const lastScene = scenes[scenes.length - 1];
    const startFrame = lastScene
      ? lastScene.startFrame + lastScene.durationInFrames
      : 0;

    // Build transition config if not first scene
    let transition = undefined;
    if (scenes.length > 0 && args.transitionType) {
      transition = {
        type: args.transitionType as SceneTransitionType,
        durationInFrames: (args.transitionDuration as number) ?? 15,
        direction: args.transitionDirection as 'left' | 'right' | 'top' | 'bottom' | undefined,
      };
    }

    const sceneId = store.addScene({
      name,
      startFrame,
      durationInFrames,
      backgroundColor,
      transition,
    });

    return {
      success: true,
      sceneId,
      name,
      startFrame,
      durationInFrames,
    };
  }],

  ['update_scene', (args, store) => {
    const sceneId = args.sceneId as string;
    const fps = store.fps;
    const updates: Partial<Scene> = {};

    if (args.name) updates.name = args.name as string;
    if (args.backgroundColor) updates.backgroundColor = args.backgroundColor as string;
    if (args.durationInSeconds) {
      updates.durationInFrames = Math.round((args.durationInSeconds as number) * fps);
    }

    // Update scene basic properties
    if (Object.keys(updates).length > 0) {
      store.updateScene(sceneId, updates);
    }

    // Handle transition updates
    if (args.transitionType !== undefined) {
      if (args.transitionType === 'none' || args.transitionType === null) {
        store.setSceneTransition(sceneId, undefined);
      } else {
        const currentScene = useCompositionStore.getState().scenes.find(s => s.id === sceneId);
        store.setSceneTransition(sceneId, {
          type: args.transitionType as SceneTransitionType,
          durationInFrames: (args.transitionDuration as number) ?? currentScene?.transition?.durationInFrames ?? 15,
          direction: (args.transitionDirection as 'left' | 'right' | 'top' | 'bottom') ?? currentScene?.transition?.direction,
        });
      }
    }

    return { success: true, sceneId };
  }],

  ['remove_scene', (args, store) => {
    const sceneId = args.sceneId as string;
    store.removeScene(sceneId);
    return { success: true, sceneId };
  }],

  ['assign_item_to_scene', (args, store) => {
    const trackId = args.trackId as string;
    const itemId = args.itemId as string;
    const sceneId = args.sceneId as string | undefined;

    store.assignItemToScene(trackId, itemId, sceneId || undefined);
    return { success: true, trackId, itemId, sceneId: sceneId || null };
  }],

  ['list_scenes', (_args, _store) => {
    const scenes = useCompositionStore.getState().scenes;
    const fps = useCompositionStore.getState().fps;

    return {
      success: true,
      count: scenes.length,
      scenes: scenes.map(s => ({
        id: s.id,
        name: s.name,
        startFrame: s.startFrame,
        durationInFrames: s.durationInFrames,
        durationInSeconds: (s.durationInFrames / fps).toFixed(2),
        backgroundColor: s.backgroundColor,
        hasTransition: !!s.transition,
        transitionType: s.transition?.type,
      })),
    };
  }],

  // =============================================
  // Fast Scene Builder Handler
  // =============================================

  ['build_scene', (args, store) => {
    const name = args.name as string;
    const durationInSeconds = (args.durationInSeconds as number) ?? 5;
    const fps = store.fps;
    const durationInFrames = Math.round(durationInSeconds * fps);
    const backgroundColor = (args.backgroundColor as string) ?? '#000000';

    // Calculate start frame based on existing scenes
    const existingScenes = useCompositionStore.getState().scenes;
    const lastScene = existingScenes[existingScenes.length - 1];
    const startFrame = lastScene
      ? lastScene.startFrame + lastScene.durationInFrames
      : 0;

    // Build transition config if not first scene
    let transition = undefined;
    if (existingScenes.length > 0 && args.transitionType) {
      transition = {
        type: args.transitionType as SceneTransitionType,
        durationInFrames: (args.transitionDuration as number) ?? 15,
      };
    }

    // 1. Create the scene
    const sceneId = store.addScene({
      name,
      startFrame,
      durationInFrames,
      backgroundColor,
      transition,
    });

    const createdItems: Array<{ type: string; trackId: string; itemId?: string }> = [];

    // 2. Add gradient background if specified
    const gradientConfig = args.gradient as {
      type?: string;
      colors?: Array<{ color: string; position: number }>;
      angle?: number;
      animate?: boolean;
    } | undefined;

    if (gradientConfig && gradientConfig.colors && gradientConfig.colors.length >= 2) {
      const gradientItem: Omit<GradientItem, 'id'> = {
        type: 'gradient',
        gradientType: (gradientConfig.type as GradientItem['gradientType']) ?? 'linear',
        colors: gradientConfig.colors as GradientColorStop[],
        from: startFrame,
        durationInFrames,
        angle: gradientConfig.angle ?? 135,
        centerX: 0.5,
        centerY: 0.5,
        animate: gradientConfig.animate ?? false,
        animateAngle: gradientConfig.animate ?? false,
        animateColors: false,
        speed: 1,
        position: { x: 0.5, y: 0.5 },
        width: 1,
        height: 1,
        sceneId,
      };

      const gradientTrack = addTrackAndGet(store, {
        name: `${name} - Gradient`,
        type: 'gradient',
        locked: false,
        visible: true,
        items: [],
      });

      store.addItem(gradientTrack.id, gradientItem);
      const freshTrack = useCompositionStore.getState().tracks.find(t => t.id === gradientTrack.id);
      createdItems.push({ type: 'gradient', trackId: gradientTrack.id, itemId: freshTrack?.items[0]?.id });
    }

    // 3. Add text overlays
    const texts = args.texts as Array<{
      text: string;
      role?: string;
      positionX?: number;
      positionY?: number;
      fontSize?: number;
      color?: string;
      fontWeight?: number;
      delay?: number;
      animation?: string;
      letterAnimation?: boolean;
      letterAnimationType?: string;
    }> | undefined;

    if (texts && texts.length > 0) {
      for (const textConfig of texts) {
        // Set defaults based on role
        let fontSize = textConfig.fontSize;
        let fontWeight = textConfig.fontWeight;
        let posY = textConfig.positionY ?? 0.5;

        if (!fontSize) {
          switch (textConfig.role) {
            case 'title': fontSize = 72; fontWeight = fontWeight ?? 700; break;
            case 'subtitle': fontSize = 36; fontWeight = fontWeight ?? 500; break;
            case 'description': fontSize = 24; fontWeight = fontWeight ?? 400; break;
            case 'label': fontSize = 18; fontWeight = fontWeight ?? 600; break;
            case 'cta': fontSize = 28; fontWeight = fontWeight ?? 700; break;
            default: fontSize = 32; break;
          }
        }

        const delayFrames = Math.round((textConfig.delay ?? 0) * fps);

        // Build letter animation config
        let letterAnimation: LetterAnimation | undefined = undefined;
        if (textConfig.letterAnimation) {
          letterAnimation = {
            enabled: true,
            type: (textConfig.letterAnimationType as LetterAnimationType) ?? 'fade',
            mode: 'letter',
            staggerFrames: 2,
            durationPerLetter: 10,
            direction: 'forward',
            easing: 'ease-out',
          };
        }

        const textItem: Omit<TextItem, 'id'> = {
          type: 'text',
          text: textConfig.text,
          fontSize: fontSize!,
          fontFamily: 'Inter',
          color: textConfig.color ?? '#ffffff',
          fontWeight: fontWeight,
          position: {
            x: textConfig.positionX ?? 0.5,
            y: posY,
          },
          from: startFrame + delayFrames,
          durationInFrames: durationInFrames - delayFrames,
          sceneId,
          letterAnimation,
        };

        const trackName = textConfig.text.length > 20 ? textConfig.text.slice(0, 17) + '...' : textConfig.text;
        const textTrack = addTrackAndGet(store, {
          name: trackName,
          type: 'text',
          locked: false,
          visible: true,
          items: [],
        });

        store.addItem(textTrack.id, textItem);
        const freshTrack = useCompositionStore.getState().tracks.find(t => t.id === textTrack.id);
        const itemId = freshTrack?.items[0]?.id;

        // Apply animation preset if specified
        if (textConfig.animation && itemId) {
          try {
            const keyframes = applyPreset(textConfig.animation, { durationInFrames: 30 });
            store.updateItem(textTrack.id, itemId, { keyframes } as any);
          } catch (e) {
            // Ignore preset errors
          }
        }

        createdItems.push({ type: 'text', trackId: textTrack.id, itemId });
      }
    }

    // 4. Add shapes
    const shapes = args.shapes as Array<{
      shapeType: string;
      width: number;
      height: number;
      positionX?: number;
      positionY?: number;
      fill?: string;
      stroke?: string;
      borderRadius?: number;
      opacity?: number;
      text?: string;
      delay?: number;
    }> | undefined;

    if (shapes && shapes.length > 0) {
      for (const shapeConfig of shapes) {
        const delayFrames = Math.round((shapeConfig.delay ?? 0) * fps);

        const shapeItem: Omit<ShapeItem, 'id'> = {
          type: 'shape',
          shapeType: shapeConfig.shapeType as ShapeItem['shapeType'],
          width: shapeConfig.width,
          height: shapeConfig.height,
          position: {
            x: shapeConfig.positionX ?? 0.5,
            y: shapeConfig.positionY ?? 0.5,
          },
          from: startFrame + delayFrames,
          durationInFrames: durationInFrames - delayFrames,
          fill: shapeConfig.fill,
          stroke: shapeConfig.stroke,
          borderRadius: shapeConfig.borderRadius,
          opacity: shapeConfig.opacity,
          text: shapeConfig.text,
          sceneId,
        };

        const shapeTrack = addTrackAndGet(store, {
          name: `${shapeConfig.shapeType}`,
          type: 'shape',
          locked: false,
          visible: true,
          items: [],
        });

        store.addItem(shapeTrack.id, shapeItem);
        const freshTrack = useCompositionStore.getState().tracks.find(t => t.id === shapeTrack.id);
        createdItems.push({ type: 'shape', trackId: shapeTrack.id, itemId: freshTrack?.items[0]?.id });
      }
    }

    // 5. Add particles if specified
    const particlesConfig = args.particles as {
      type: string;
      emitterX?: number;
      emitterY?: number;
      count?: number;
      colors?: string[];
    } | undefined;

    if (particlesConfig && particlesConfig.type) {
      const particleType = particlesConfig.type as ParticleType;

      // Default colors based on particle type
      let colors = particlesConfig.colors;
      if (!colors || colors.length === 0) {
        switch (particleType) {
          case 'confetti':
            colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
            break;
          case 'sparks':
            colors = ['#fbbf24', '#f97316', '#ef4444', '#fde68a'];
            break;
          case 'snow':
            colors = ['#ffffff', '#f0f9ff', '#e0f2fe'];
            break;
          case 'bubbles':
            colors = ['#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];
            break;
          case 'stars':
            colors = ['#fcd34d', '#fde68a', '#fef3c7', '#ffffff'];
            break;
          case 'dust':
            colors = ['#a8a29e', '#d6d3d1', '#e7e5e4'];
            break;
          default:
            colors = ['#ffffff'];
        }
      }

      const particleItem: Omit<ParticleItem, 'id'> = {
        type: 'particles',
        particleType,
        from: startFrame,
        durationInFrames,
        emitterPosition: {
          x: particlesConfig.emitterX ?? 0.5,
          y: particlesConfig.emitterY ?? 0.5,
        },
        particleCount: particlesConfig.count ?? 50,
        colors,
        speed: 1,
        gravity: 1,
        spread: 180,
        particleSize: 1,
        fadeOut: true,
        rotation: true,
        sceneId,
      };

      const particleTrack = addTrackAndGet(store, {
        name: `${particleType.charAt(0).toUpperCase() + particleType.slice(1)} Particles`,
        type: 'particles',
        locked: false,
        visible: true,
        items: [],
      });

      store.addItem(particleTrack.id, particleItem);
      const freshTrack = useCompositionStore.getState().tracks.find(t => t.id === particleTrack.id);
      createdItems.push({ type: 'particles', trackId: particleTrack.id, itemId: freshTrack?.items[0]?.id });
    }

    return {
      success: true,
      sceneId,
      sceneName: name,
      startFrame,
      durationInFrames,
      durationInSeconds,
      itemsCreated: createdItems.length,
      items: createdItems,
    };
  }],
]);

export function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  store: CompositionStoreApi
): unknown {
  const handler = handlers.get(name);
  if (!handler) {
    throw new Error(`Unknown tool call: ${name}`);
  }
  return handler(args, store);
}
